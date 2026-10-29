"""
B2B Delivery API Router (Unified into Gamestore)
Eliminates b2b.db: Uses gamestore.db as the single source of truth.
Handles delivery orders, catalog and wallet queries directly against gamestore.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field, ConfigDict
import hashlib, hmac, base64, json, uuid, time, os, asyncio, aiosqlite, logging, re, httpx
from datetime import datetime, timezone
from typing import Any, Optional

import sys
from pathlib import Path
BOT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BOT_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_ROOT))

import config
import database as db

log = logging.getLogger("b2b_delivery_api")

router = APIRouter(tags=["B2B Delivery API"])

# ─── MASTER KEY & OPAQUE IDS (Deterministic reproduction of B2B IDs) ───
MASTER_KEY_HEX = "f4cc64a9edc3a03a609fba4cd74f8daa501c0be03484e96fb3e492e3832e37e3"
MASTER_KEY = bytes.fromhex(MASTER_KEY_HEX)
MASTER_HASH = hashlib.sha256(MASTER_KEY).digest()

def _b64_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')

def opaque_id(namespace: str, *parts: str, prefix: str) -> str:
    material = '\x00'.join((namespace, *parts)).encode()
    digest = hmac.new(MASTER_HASH, material, hashlib.sha256).digest()[:18]
    return f"{prefix}_{_b64_encode(digest)}"

def product_public_id(provider_type: str, category_id: str) -> str:
    return opaque_id("catalog-product", provider_type, category_id, prefix="prd")

def offer_public_id(public_product_id: str, internal_offer_id: str) -> str:
    return opaque_id("catalog-offer", public_product_id, internal_offer_id, prefix="off")

# ─── AUTHENTICATION DEPENDENCY ───
async def get_b2b_api_context(
    request: Request,
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> dict:
    raw_key = (x_api_key or "").strip()
    if not raw_key and authorization and authorization.startswith("Bearer "):
        raw_key = authorization[7:].strip()
    if not raw_key:
        raise HTTPException(401, "API key ausente o inválida")

    raw_sha256 = hashlib.sha256(raw_key.encode()).hexdigest()
    pepper = (os.getenv("RESELLER_API_KEY_PEPPER") or config.BOT_TOKEN or "francho-shop-api").encode("utf-8")
    key_hmac = hmac.new(pepper, raw_key.encode("utf-8"), hashlib.sha256).hexdigest()

    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM reseller_api_keys WHERE (key_hash=? OR key_hash=?) AND status='active'",
            (raw_sha256, key_hmac)
        ) as cur:
            row = await cur.fetchone()
        
        if not row:
            raise HTTPException(401, "API key ausente, revocada o inválida")
        
        key = dict(row)
        user_id = int(key["user_id"])
        
        # Validar regla estricta de depósitos de API (mínimo 50 USDT no acumulables en cada recarga)
        from .main import check_user_api_deposit_eligibility
        ok_api, reason_api = await check_user_api_deposit_eligibility(user_id)
        if not ok_api:
            raise HTTPException(403, f"Acceso a la API suspendido: {reason_api}")
        
        # Actualizar last_used_at
        now = time.time()
        await conn.execute("UPDATE reseller_api_keys SET last_used_at=? WHERE id=?", (now, key["id"]))
        await conn.commit()

    scopes = {s.strip() for s in str(key.get("scopes") or "").split(",") if s.strip()}
    return {**key, "user_id": user_id, "scopes_set": scopes}


# ─── MODELS ───
class B2BOrderRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    product_id: str
    offer_id: str
    quantity: int = 1
    fields: dict[str, Any] = Field(default_factory=dict)


# ─── 1. ROOT & WALLET ENDPOINTS ───
@router.get("", tags=["General"])
async def b2b_root(context: dict = Depends(get_b2b_api_context)):
    return {
        "data": {
            "name": "Francho Shop B2B API",
            "version": "1.0.0",
            "currency": "USDT",
            "money_format": "decimal_string",
            "capabilities": ["catalog", "orders", "wallet", "wallet_movements"],
            "processing_review_after_minutes": 30,
        }
    }


@router.get("/wallet")
async def b2b_wallet(context: dict = Depends(get_b2b_api_context)):
    user_id = context["user_id"]
    user = await db.get_user(user_id)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    balance = float(user.get("balance") or 0)
    return {
        "data": {
            "currency": "USDT",
            "balance": f"{balance:.4f}",
            "reserved": "0.0000",
            "available": f"{balance:.4f}",
            "plan": "reseller"
        }
    }


@router.get("/wallet/movements")
async def b2b_wallet_movements(
    limit: int = Query(default=25, ge=1, le=100),
    context: dict = Depends(get_b2b_api_context)
):
    user_id = context["user_id"]
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM balance_log WHERE user_id=? ORDER BY id DESC LIMIT ?",
            (user_id, limit)
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

    data = [
        {
            "id": f"mov_{r['id']}",
            "type": r["type"],
            "amount": f"{float(r['amount']):.4f}",
            "balance_after": "0.0000",
            "currency": "USDT",
            "reference": str(r.get("ref_id") or ""),
            "description": str(r.get("note") or ""),
            "created_at": datetime.fromtimestamp(r["created_at"], tz=timezone.utc).isoformat().replace("+00:00", "Z") if r.get("created_at") else None,
        }
        for r in rows
    ]
    return {"data": data, "meta": {"limit": limit, "has_more": False}}


def resolve_b2b_product_image_url(r: dict) -> str:
    raw_img = str(r.get("image_url") or "").strip()
    pub_id = r.get("category_id") or r.get("public_id") or ""
    if not raw_img and not pub_id:
        return ""
    # Servimos imágenes de forma marca blanca oficial sin exponer URLs externas
    if "fazercards" in raw_img:
        return f"https://franchoshop.com/v1/catalog/products/{pub_id}/image"
    if raw_img.startswith("/"):
        return f"https://franchoshop.com{raw_img}"
    # Si es de Steam oficial (steamstatic) o CDN público
    if raw_img:
        return raw_img
    return f"https://franchoshop.com/v1/catalog/products/{pub_id}/image" if pub_id else ""


# ─── 2. CATALOG PRODUCTS ───
@router.get("/catalog/products")
async def b2b_catalog_products(
    limit: int = Query(default=100, ge=1, le=100),
    cursor: str | None = Query(default=None),
    search: str | None = Query(default=None),
    group: str | None = Query(default=None),
    available: bool | None = Query(default=None),
    context: dict = Depends(get_b2b_api_context)
):
    where = ["available = 1"]
    params = []
    search_str = search.strip() if isinstance(search, str) else None
    if search_str:
        where.append("name LIKE ?")
        params.append(f"%{search_str}%")
    group_str = group.strip() if isinstance(group, str) else None
    if group_str:
        where.append("catalog_group = ?")
        params.append(group_str)
    
    query = f"SELECT * FROM catalog_products WHERE {' AND '.join(where)} ORDER BY name ASC"
    
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(query, params) as cur:
            all_rows = [dict(r) for r in await cur.fetchall()]

    # Paginación sencilla en memoria
    offset = 0
    if cursor and isinstance(cursor, str):
        try:
            offset = int(base64.urlsafe_b64decode(cursor.encode()).decode())
        except Exception:
            offset = 0
            
    paged = all_rows[offset : offset + limit]
    has_more = (offset + limit) < len(all_rows)
    next_cursor = base64.urlsafe_b64encode(str(offset + limit).encode()).decode() if has_more else None

    items = [
        {
            "id": r.get("category_id") or r.get("public_id"),
            "category_id": r.get("category_id") or r.get("public_id"),
            "public_id": r.get("public_id"),
            "name": r["name"],
            "group": r.get("catalog_group") or "service_topup",
            "type": r.get("provider_type") or "topup",
            "provider_type": r.get("provider_type") or "topup",
            "available": bool(r.get("available", 1)),
            "image_url": resolve_b2b_product_image_url(r)
        }
        for r in paged
    ]
    return {
        "data": items,
        "meta": {"limit": limit, "has_more": has_more, "next_cursor": next_cursor, "total": len(all_rows)}
    }


@router.api_route("/catalog/products/{product_id}/image", methods=["GET", "HEAD"])
async def b2b_product_image(product_id: str):
    """Sirve la carátula oficial del producto de forma 100% marca blanca (sin exponer URLs de proveedores)."""
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT name, image_url FROM catalog_products WHERE public_id=? OR category_id=?", (product_id, product_id)) as cur:
            row = await cur.fetchone()
    
    if not row:
        raise HTTPException(404, "Imagen no encontrada")
    
    # 1. Buscar en carátulas locales (game-covers)
    p_name = str(row["name"] or "").lower()
    covers_dir = BOT_ROOT / "webapp" / "frontend" / "public" / "game-covers"
    
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", p_name).strip("_")
    for ext in (".png", ".webp", ".jpg", ".jpeg"):
        local_f = covers_dir / f"{slug}{ext}"
        if local_f.exists():
            return FileResponse(str(local_f), headers={"Cache-Control": "public, max-age=604800"})
            
    # 2. Si hay URL remota
    remote_url = row["image_url"]
    if not remote_url:
        logo_path = BOT_ROOT / "webapp" / "frontend" / "public" / "franchoshop-logo.png"
        return FileResponse(str(logo_path))
        
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(remote_url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                media_type = resp.headers.get("content-type") or "image/jpeg"
                return Response(content=resp.content, media_type=media_type, headers={"Cache-Control": "public, max-age=604800"})
    except Exception as e:
        log.warning("No se pudo obtener imagen remota para %s: %s", product_id, e)
        
    logo_path = BOT_ROOT / "webapp" / "frontend" / "public" / "franchoshop-logo.png"
    return FileResponse(str(logo_path))


async def get_b2b_markup_multiplier(user_id: int | None) -> float:
    if not user_id:
        return 1.14
    from .main import get_user_max_single_paid_deposit, get_reseller_tier_info, get_user_role
    role = await get_user_role(user_id)
    if role in ("admin",) or user_id in config.ADMIN_IDS:
        return 1.07
    max_dep = await get_user_max_single_paid_deposit(user_id)
    tier = get_reseller_tier_info(max_dep)
    return max(1.0, 1.0 + (tier.get("markup_pct", 14.0) / 100.0))


# ─── 3. CATALOG OFFERS ───
@router.get("/catalog/products/{product_id}/offers")
async def b2b_catalog_product_offers(
    product_id: str,
    context: dict = Depends(get_b2b_api_context)
):
    from .main import fzr_cards
    user_id = context.get("user_id")
    markup_mult = await get_b2b_markup_multiplier(user_id)
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM catalog_products WHERE public_id=? OR category_id=?", (product_id, product_id)) as cur:
            p_row = await cur.fetchone()
    
    if not p_row:
        raise HTTPException(404, "Producto no encontrado en el catálogo")
    
    cat_id = p_row["category_id"]
    p_type = p_row["provider_type"]
    pub_prod_id = p_row["public_id"]

    offers_data = []
    if p_type == "telegram":
        try:
            if cat_id == "telegram_premium":
                res = await fzr_cards.telegram_premium()
                for plan in res.get("plans") or []:
                    m = int(plan.get("months") or 0)
                    if m <= 0:
                        continue
                    cost = float(plan.get("price_usd") or 0)
                    price = round(cost * markup_mult, 4)
                    raw_id = f"{m}m"
                    off_pub = offer_public_id(pub_prod_id, raw_id)
                    offers_data.append({
                        "id": raw_id,
                        "offer_id": raw_id,
                        "public_id": off_pub,
                        "name": f"Telegram Premium {m} Meses",
                        "price": f"{price:.4f}",
                        "price_usdt": f"{price:.4f}",
                        "currency": "USDT",
                        "min_quantity": 1,
                        "max_quantity": 1,
                        "available": True,
                        "internal_id": raw_id,
                        "required_fields": [
                            {"key": "username", "label": "Usuario de Telegram (@usuario)", "required": True, "type": "text"}
                        ]
                    })
            elif cat_id == "telegram_stars":
                res = await fzr_cards.telegram_stars()
                price_per_star = float(res.get("price_per_star") or 0)
                for qty in [50, 75, 100, 150, 250, 350, 500, 750, 1000, 1500, 2500, 3500, 5000, 10000]:
                    cost = price_per_star * qty
                    price = round(cost * markup_mult, 4)
                    raw_id = str(qty)
                    off_pub = offer_public_id(pub_prod_id, raw_id)
                    offers_data.append({
                        "id": raw_id,
                        "offer_id": raw_id,
                        "public_id": off_pub,
                        "name": f"{qty} Stars",
                        "price": f"{price:.4f}",
                        "price_usdt": f"{price:.4f}",
                        "currency": "USDT",
                        "min_quantity": 1,
                        "max_quantity": 1,
                        "available": True,
                        "internal_id": raw_id,
                        "required_fields": [
                            {"key": "username", "label": "Usuario de Telegram (@usuario)", "required": True, "type": "text"}
                        ]
                    })
        except Exception as e:
            log.warning("Error fetching telegram offers for %s: %s", cat_id, e)
        return {
            "data": offers_data,
            "product": {
                "id": cat_id or pub_prod_id,
                "category_id": cat_id,
                "public_id": pub_prod_id,
                "name": p_row["name"],
                "image_url": resolve_b2b_product_image_url(dict(p_row))
            }
        }

    try:
        from .main import fzr_live_catalog_offers
        mapping, raw_offers = await fzr_live_catalog_offers(p_type, cat_id, user_id)
        for o in raw_offers:
            raw_id = str(o.get("offer_id") or o.get("id"))
            cost = float(o.get("cost_usdt") or o.get("price_usd") or 0)
            price_val = o.get("price_usdt")
            if price_val is not None:
                price = float(price_val)
            else:
                price = round(cost * markup_mult, 4)
            if price < cost: price = cost

            off_pub = offer_public_id(pub_prod_id, raw_id)
            offers_data.append({
                "id": raw_id,
                "offer_id": raw_id,
                "public_id": off_pub,
                "name": o.get("name") or raw_id,
                "price": f"{price:.4f}",
                "price_usdt": f"{price:.4f}",
                "currency": "USDT",
                "min_quantity": int(o.get("min_quantity") or 1),
                "max_quantity": int(o.get("max_quantity") or 1),
                "available": bool(o.get("is_available", True)),
                "internal_id": raw_id,
                "required_fields": o.get("required_fields") or []
            })
    except Exception as e:
        log.warning("Error fetching live offers for %s (%s): %s", cat_id, p_type, e)
        offers_data.append({
            "id": "standard",
            "offer_id": "standard",
            "public_id": offer_public_id(pub_prod_id, "standard"),
            "name": p_row["name"],
            "price": "1.0000",
            "currency": "USDT",
            "min_quantity": 1,
            "max_quantity": 100,
            "available": True,
            "internal_id": "standard"
        })

    return {
        "data": offers_data,
        "product": {
            "id": cat_id or pub_prod_id,
            "category_id": cat_id,
            "public_id": pub_prod_id,
            "name": p_row["name"],
            "image_url": resolve_b2b_product_image_url(dict(p_row))
        }
    }


# ─── 4. CREATE ORDER ───
@router.post("/orders", status_code=201)
async def b2b_create_order(
    req: B2BOrderRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    context: dict = Depends(get_b2b_api_context)
):
    from .main import fzr_cards
    if idempotency_key:
        idempotency_key = idempotency_key.strip()
    if not idempotency_key:
        idempotency_key = f"b2b_{uuid.uuid4().hex}"
    elif len(idempotency_key) < 8 or len(idempotency_key) > 128:
        raise HTTPException(422, "Idempotency-Key debe tener entre 8 y 128 caracteres")
    
    # Extraer campos de entrega (soporta fields y atributos de nivel superior)
    req_fields = dict(req.fields or {})
    extra_data = getattr(req, "__pydantic_extra__", None) or {}
    for k, v in extra_data.items():
        if k not in ("product_id", "offer_id", "quantity", "fields") and k not in req_fields:
            req_fields[k] = v
    
    user_id = context["user_id"]

    # 1. Verificar idempotencia en gamestore.db
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM orders WHERE (merchant_order_id=? OR buffpin_order_id=?) AND user_id=?",
            (idempotency_key, idempotency_key, user_id)
        ) as cur:
            existing = await cur.fetchone()
        if existing:
            erow = dict(existing)
            status_str = "completed" if erow.get("order_status") == 2 else "processing"
            return {
                "data": {
                    "id": erow["merchant_order_id"],
                    "status": status_str,
                    "product": {"id": req.product_id, "name": erow.get("product_name")},
                    "offer": {"id": req.offer_id, "name": erow.get("product_name")},
                    "quantity": erow.get("quantity") or 1,
                    "total": f"{float(erow.get('sell_price') or 0):.4f}",
                    "currency": "USDT",
                    "idempotent_replay": True
                }
            }

    # 2. Resolver producto
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM catalog_products WHERE public_id=? OR category_id=?",
            (req.product_id, req.product_id)
        ) as cur:
            p_row = await cur.fetchone()
    
    if not p_row:
        raise HTTPException(404, "El producto no existe en el catálogo")

    cat_id = p_row["category_id"]
    p_type = p_row["provider_type"]
    pub_prod_id = p_row["public_id"]
    prod_name = p_row["name"]

    # 3. Resolver oferta y precio
    internal_offer_id = req.offer_id
    offer_name = req.offer_id
    unit_price = 0.0
    markup_mult = await get_b2b_markup_multiplier(user_id)

    if p_type == "topup":
        res = await fzr_cards.topup_offers(cat_id)
        raw_offers = res.get("offers") or []
        target_offer = None
        for o in raw_offers:
            oid = str(o.get("offer_id") or o.get("id"))
            if offer_public_id(pub_prod_id, oid) == req.offer_id or oid == req.offer_id:
                target_offer = o
                internal_offer_id = oid
                break
        
        if not target_offer:
            raise HTTPException(404, f"La oferta '{req.offer_id}' no existe para este producto")
        
        cost = float(target_offer.get("price_usd") or target_offer.get("cost_usdt") or 0)
        offer_name = target_offer.get("name") or internal_offer_id
        unit_price = round(cost * markup_mult, 4)
    elif p_type == "giftcard":
        res = await fzr_cards.giftcard_cards(cat_id)
        raw_offers = res.get("cards") or []
        target_offer = None
        for o in raw_offers:
            oid = str(o.get("card_id") or o.get("id"))
            if offer_public_id(pub_prod_id, oid) == req.offer_id or oid == req.offer_id:
                target_offer = o
                internal_offer_id = oid
                break
        if not target_offer:
            raise HTTPException(404, f"La oferta '{req.offer_id}' no existe para este producto")
        cost = float(target_offer.get("price_usd") or target_offer.get("cost_usdt") or 0)
        offer_name = target_offer.get("name") or internal_offer_id
        unit_price = round(cost * markup_mult, 4)
    elif p_type == "telegram":
        username = str(req_fields.get("username") or req_fields.get("telegram_username") or req_fields.get("user") or "").strip().lstrip("@")
        if not username:
            raise HTTPException(400, "Campo 'username' (@usuario de Telegram) es requerido en fields")
        if cat_id == "telegram_premium":
            res = await fzr_cards.telegram_premium()
            target_plan = None
            m = 0
            for p in res.get("plans") or []:
                pm = int(p.get("months") or 0)
                if offer_public_id(pub_prod_id, f"{pm}m") == req.offer_id or f"{pm}m" == req.offer_id or str(pm) == req.offer_id:
                    target_plan = p
                    m = pm
                    break
            if not target_plan:
                raise HTTPException(404, f"La oferta '{req.offer_id}' no existe para este producto")
            cost = float(target_plan.get("price_usd") or 0)
            offer_name = f"Telegram Premium {m} Meses"
            unit_price = round(cost * markup_mult, 4)
            internal_offer_id = f"{m}m"
        elif cat_id == "telegram_stars":
            res = await fzr_cards.telegram_stars()
            price_per_star = float(res.get("price_per_star") or 0)
            qty = 0
            for q in [50, 75, 100, 150, 250, 350, 500, 750, 1000, 1500, 2500, 3500, 5000, 10000]:
                if offer_public_id(pub_prod_id, str(q)) == req.offer_id or str(q) == req.offer_id:
                    qty = q
                    break
            if not qty and req.offer_id.isdigit():
                qty = int(req.offer_id)
            if qty <= 0:
                raise HTTPException(404, f"La oferta '{req.offer_id}' no existe para este producto")
            cost = price_per_star * qty
            offer_name = f"{qty} Stars"
            unit_price = round(cost * markup_mult, 4)
            internal_offer_id = str(qty)
        else:
            raise HTTPException(400, "Producto de Telegram no reconocido")
    else:
        raise HTTPException(400, "Tipo de producto no soportado directamente en este canal")

    total_price = round(unit_price * req.quantity, 4)

    # 4. Validar saldo en gamestore.db
    user = await db.get_user(user_id)
    current_balance = float(user.get("balance") or 0)
    if current_balance < total_price:
        raise HTTPException(400, f"Saldo insuficiente. Saldo actual: ${current_balance:.2f} USDT, requerido: ${total_price:.2f} USDT")

    # 5. Generar ID único
    b2b_order_id = f"FSB2B-{uuid.uuid4().hex.upper()[:16]}"
    now_ts = time.time()

    # 6. Descontar saldo directamente en gamestore.db
    spend_ok = await db.spend_balance(
        user_id,
        total_price,
        ref_id=f"fzr_{b2b_order_id}",
        note=f"B2B {prod_name} · {offer_name}"
    )
    if not spend_ok:
        raise HTTPException(400, "No se pudo debitar el saldo de tu cuenta")

    # 7. Ejecutar entrega
    provider_res = None
    provider_order_id = ""
    provider_status = "processing"
    try:
        if p_type == "telegram":
            if cat_id == "telegram_premium":
                provider_res = await fzr_cards.buy_telegram_premium(username, m, b2b_order_id)
            else:
                provider_res = await fzr_cards.buy_telegram_stars(username, qty, b2b_order_id)
        elif p_type == "giftcard":
            provider_res = await fzr_cards.buy_giftcard(cat_id, internal_offer_id, req.quantity, b2b_order_id)
        else:
            provider_res = await fzr_cards.buy_topup(cat_id, internal_offer_id, req_fields, b2b_order_id)
        data = provider_res.get("order") if isinstance(provider_res, dict) and isinstance(provider_res.get("order"), dict) else provider_res
        provider_order_id = str((data or {}).get("order_id") or (data or {}).get("id") or "")
        provider_status = str((data or {}).get("status") or "processing")
    except Exception as e:
        log.error("FZR buy_topup exception: %s", e)
        provider_status = "failed"
        provider_res = {"error": str(e)}

    # Si fue rechazado inmediatamente, reembolsar
    if provider_status in {"failed", "rejected", "error"}:
        await db.add_balance(
            user_id,
            total_price,
            "refund",
            ref_id=f"refund_{b2b_order_id}",
            note=f"Reembolso B2B automático: rechazo en {prod_name}"
        )
        err_msg = provider_res.get("error") if isinstance(provider_res, dict) else provider_status
        raise HTTPException(502, f"La orden no pudo ser procesada: {err_msg}")

    # 8. Guardar orden en gamestore.db (orders y fzr_orders)
    order_status_num = 2 if provider_status == "completed" else 1
    input_json = json.dumps(req_fields, ensure_ascii=False)
    raw_res_str = json.dumps(provider_res, ensure_ascii=False) if provider_res else ""

    async with aiosqlite.connect(config.DB_PATH) as conn:
        # En fzr_orders
        await conn.execute(
            """INSERT INTO fzr_orders
            (user_id, provider_order_id, product_type, product_name, target, quantity, cost_price, sell_price, provider_status, status, raw_response, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, provider_order_id, p_type, f"{prod_name} · {offer_name}", input_json, req.quantity, cost, total_price, provider_status, provider_status, raw_res_str, now_ts, now_ts)
        )
        # En orders
        await conn.execute(
            """INSERT INTO orders
            (merchant_order_id, buffpin_order_id, product_id, user_id, user_role, product_name, quantity, cost_price, sell_price, currency,
             order_status, recharge_config, provider_code, provider_type, provider_order_id, provider_category_id,
             provider_offer_id, provider_status, sales_channel, created_at, updated_at)
            VALUES (?, ?, 0, ?, 'reseller', ?, ?, ?, ?, 'USDT', ?, ?, 'fzr', ?, ?, ?, ?, ?, 'b2b_api', ?, ?)""",
            (b2b_order_id, idempotency_key, user_id, f"{prod_name} · {offer_name}", req.quantity, cost, total_price, order_status_num, input_json, p_type, provider_order_id, cat_id, internal_offer_id, provider_status, now_ts, now_ts)
        )
        await conn.commit()

    return {
        "data": {
            "id": b2b_order_id,
            "status": provider_status,
            "product": {"id": cat_id or pub_prod_id, "name": prod_name},
            "offer": {"id": internal_offer_id or req.offer_id, "name": offer_name},
            "quantity": req.quantity,
            "unit_price": f"{unit_price:.4f}",
            "total": f"{total_price:.4f}",
            "currency": "USDT",
            "delivery": {
                "type": p_type,
                "status": provider_status,
                "destination": req_fields
            }
        }
    }


# ─── 5. GET ORDER BY ID ───
@router.get("/orders/{order_id}")
async def b2b_get_order(
    order_id: str,
    context: dict = Depends(get_b2b_api_context)
):
    from .main import fzr_cards
    user_id = context["user_id"]
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM orders WHERE (merchant_order_id=? OR id=?) AND user_id=?",
            (order_id, order_id, user_id)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(404, "Pedido no encontrado")

    r = dict(row)
    status_str = "completed" if r.get("order_status") == 2 else ("refunded" if r.get("order_status") == 4 else "processing")
    
    # Si está en processing y tiene provider_order_id, consultar estado en vivo al proveedor
    prov_ord_id = r.get("provider_order_id")
    if status_str == "processing" and prov_ord_id:
        try:
            live = await fzr_cards.request("GET", f"/api/v2/orders/{prov_ord_id}")
            live_status = str((live.get("order") or live).get("status") or "")
            if live_status in {"completed", "success"}:
                status_str = "completed"
                async with aiosqlite.connect(config.DB_PATH) as conn:
                    await conn.execute("UPDATE orders SET order_status=2, provider_status='completed', updated_at=? WHERE id=?", (time.time(), r["id"]))
                    await conn.execute("UPDATE fzr_orders SET status='completed', provider_status='completed', updated_at=? WHERE provider_order_id=?", (time.time(), prov_ord_id))
                    await conn.commit()
            elif live_status in {"failed", "rejected", "cancelled", "canceled", "refunded", "refund"}:
                status_str = "refunded"
                now_ts = time.time()
                async with aiosqlite.connect(config.DB_PATH) as conn:
                    await conn.execute("UPDATE orders SET order_status=4, provider_status=?, updated_at=? WHERE id=?", (live_status, now_ts, r["id"]))
                    await conn.execute("UPDATE fzr_orders SET status='refunded', provider_status=?, refunded_at=?, updated_at=? WHERE provider_order_id=?", (live_status, now_ts, now_ts, prov_ord_id))
                    await conn.commit()
                # Reembolso
                sell_p = float(r.get("sell_price") or 0)
                if sell_p > 0:
                    await db.add_balance(user_id, sell_p, "refund", ref_id=f"refund_{order_id}", note="Reembolso B2B")
        except Exception:
            pass

    fields = {}
    try:
        fields = json.loads(r.get("recharge_config") or "{}")
    except Exception:
        pass

    return {
        "data": {
            "id": r["merchant_order_id"] or str(r["id"]),
            "status": status_str,
            "product": {"name": r.get("product_name") or ""},
            "offer": {"name": r.get("provider_offer_id") or ""},
            "quantity": r.get("quantity") or 1,
            "total": f"{float(r.get('sell_price') or 0):.4f}",
            "currency": "USDT",
            "delivery": {
                "type": r.get("provider_type") or "topup",
                "status": status_str,
                "destination": fields
            }
        }
    }


# ─── 6. LIST ORDERS ───
@router.get("/orders")
async def b2b_list_orders(
    limit: int = Query(default=25, ge=1, le=100),
    context: dict = Depends(get_b2b_api_context)
):
    user_id = context["user_id"]
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        ) as cur:
            rows = await cur.fetchall()

    items = []
    for row in rows:
        r = dict(row)
        is_completed = (r.get("order_status") == 2 or str(r.get("provider_status") or "").lower() in {"completed", "complete", "delivered", "success"})
        is_refunded = (r.get("order_status") == 4 or str(r.get("provider_status") or "").lower() in {"failed", "rejected", "cancelled", "canceled", "refunded", "refund"})
        status_str = "completed" if is_completed else ("refunded" if is_refunded else "processing")
        fields = {}
        try:
            fields = json.loads(r.get("recharge_config") or "{}")
        except Exception:
            pass
        items.append({
            "id": r["merchant_order_id"] or str(r["id"]),
            "status": status_str,
            "product": {"name": r.get("product_name") or ""},
            "offer": {"name": r.get("provider_offer_id") or ""},
            "quantity": r.get("quantity") or 1,
            "total": f"{float(r.get('sell_price') or 0):.4f}",
            "currency": "USDT",
            "created_at": r.get("created_at"),
            "delivery": {
                "type": r.get("provider_type") or "topup",
                "status": status_str,
                "destination": fields
            }
        })
    return {"data": items, "meta": {"limit": limit, "has_more": False}}


# ─── 7. DOCS REDIRECTS ───
@router.get("/docs", include_in_schema=False)
async def b2b_docs_redirect():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/docs")


@router.get("/openapi.json", include_in_schema=False)
async def b2b_openapi_redirect():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/docs/openapi.json")

