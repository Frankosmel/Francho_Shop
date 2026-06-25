"""🛍 Francho Shop — FastAPI backend v2 (bugs arreglados)."""
import json
import html
import logging
import asyncio
import re
import sys
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path

# FIX #1: path robusto al root del bot
BOT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BOT_ROOT))

# FIX CRÍTICO: forzar DB_PATH absoluto ANTES de importar config/database
# Esto evita que la API cree su propia DB vacía en webapp/api/gamestore.db
import os
import time
import uuid
_db_env = os.environ.get("DB_PATH", "")
if not _db_env or not os.path.isabs(_db_env):
    # Buscar la DB del bot principal
    _bot_db = str(BOT_ROOT / "gamestore.db")
    os.environ["DB_PATH"] = _bot_db

from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
import database as db
from buffpin_client import BuffPinClient, BuffPinError
from oxapay_client import OxaPayClient, OxaPayError
from modules import settings, pricing

# Import auth: funciona tanto como módulo (webapp.api.main) como script directo
try:
    from webapp.api.auth import get_current_user
    from webapp.api import web_auth
except ImportError:
    from auth import get_current_user
    import web_auth

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("franchoshop")
buffpin = BuffPinClient()
oxapay = OxaPayClient()
BOT_INFO_CACHE = {"username": None}
RECENT_PURCHASE_KEYS = {}
CATALOG_CACHE = {}
CATALOG_CACHE_TTL = int(os.getenv("CATALOG_CACHE_TTL", "300") or 300)


def catalog_cache_get(key):
    item = CATALOG_CACHE.get(key)
    if not item:
        return None
    expires_at, value = item
    if expires_at <= time.time():
        CATALOG_CACHE.pop(key, None)
        return None
    return value


def catalog_cache_set(key, value, ttl: int | None = None):
    CATALOG_CACHE[key] = (time.time() + int(ttl or CATALOG_CACHE_TTL), value)
    return value


def invalidate_catalog_cache():
    CATALOG_CACHE.clear()


def parse_recharge_details(raw):
    details = []
    if not raw:
        return details
    try:
        data = json.loads(raw)
    except Exception:
        return details
    if not isinstance(data, list):
        return details
    for item in data:
        if not isinstance(item, dict):
            continue
        label = item.get("name") or item.get("filedName") or "Dato"
        value = item.get("value")
        if isinstance(value, dict):
            shown = value.get("serverName") or value.get("name") or value.get("serverId") or ""
        else:
            shown = value
        if shown is None or str(shown).strip() == "":
            continue
        key = str(item.get("filedName") or label or "").lower()
        kind = "region" if "server" in key or "region" in key else "id" if "id" in key or "player" in key or "uid" in key else "field"
        details.append({"label": str(label), "value": str(shown), "kind": kind})
    return details


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    await db.init_manual_products()
    await settings.init_settings()

    # Crear tabla de iconos por juego (configurable desde admin)
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS game_icons (
                game_name   TEXT PRIMARY KEY,
                emoji       TEXT,
                icon_url    TEXT,
                display_name TEXT,
                sort_order  INTEGER DEFAULT 100,
                is_hidden   INTEGER DEFAULT 0,
                retail_markup REAL,
                reseller_markup REAL,
                updated_at  REAL DEFAULT (unixepoch())
            )
        """)
        async with conn.execute("PRAGMA table_info(game_icons)") as c:
            cols = {r[1] for r in await c.fetchall()}
        for col, defn in [
            ("retail_markup", "REAL"),
            ("reseller_markup", "REAL"),
            ("description", "TEXT"),
            ("instructions", "TEXT"),
        ]:
            if col not in cols:
                await conn.execute(f"ALTER TABLE game_icons ADD COLUMN {col} {defn}")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS internal_sellers (
                user_id       INTEGER PRIMARY KEY,
                max_products  INTEGER DEFAULT 10,
                is_active     INTEGER DEFAULT 1,
                can_create_products INTEGER DEFAULT 1,
                can_sell_recharges INTEGER DEFAULT 0,
                commission_pct REAL DEFAULT 0,
                recharge_commission_pct REAL DEFAULT 50,
                notes         TEXT,
                created_by    INTEGER,
                created_at    REAL DEFAULT (unixepoch()),
                updated_at    REAL DEFAULT (unixepoch())
            )
        """)
        async with conn.execute("PRAGMA table_info(internal_sellers)") as c:
            seller_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [
            ("can_create_products", "INTEGER DEFAULT 1"),
            ("can_sell_recharges", "INTEGER DEFAULT 0"),
            ("commission_pct", "REAL DEFAULT 0"),
            ("recharge_commission_pct", "REAL DEFAULT 50"),
            ("notes", "TEXT"),
        ]:
            if col not in seller_cols:
                await conn.execute(f"ALTER TABLE internal_sellers ADD COLUMN {col} {defn}")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS account_seller_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                store_name TEXT NOT NULL,
                store_slug TEXT NOT NULL UNIQUE,
                store_description TEXT,
                store_image TEXT,
                banner_image TEXT,
                whatsapp_url TEXT,
                social_url_1 TEXT,
                social_url_2 TEXT,
                allow_external_links INTEGER DEFAULT 1,
                status TEXT DEFAULT 'active',
                max_active_products INTEGER DEFAULT 10,
                commission_percent REAL DEFAULT 10,
                total_sales REAL DEFAULT 0,
                total_orders INTEGER DEFAULT 0,
                rating REAL,
                seller_type TEXT DEFAULT 'account',
                created_by INTEGER,
                created_at REAL DEFAULT (unixepoch()),
                updated_at REAL DEFAULT (unixepoch())
            )
        """)
        async with conn.execute("PRAGMA table_info(account_seller_profiles)") as c:
            profile_cols = {r[1] for r in await c.fetchall()}
        if "seller_type" not in profile_cols:
            await conn.execute("ALTER TABLE account_seller_profiles ADD COLUMN seller_type TEXT DEFAULT 'account'")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_account_seller_profiles_type ON account_seller_profiles(seller_type)")
        await conn.execute("""
            INSERT OR IGNORE INTO account_seller_profiles
            (user_id, store_name, store_slug, store_description, status, max_active_products, commission_percent, seller_type, created_by, updated_at)
            SELECT s.user_id,
                   COALESCE(NULLIF(u.first_name, ''), NULLIF(u.username, ''), NULLIF(u.email, ''), 'Tienda ' || s.user_id) AS store_name,
                   'vendedor-' || s.user_id AS store_slug,
                   'Productos publicados por vendedor verificado dentro de Francho Shop.',
                   CASE WHEN s.is_active=1 THEN 'active' ELSE 'suspended' END,
                   COALESCE(s.max_products, 10),
                   COALESCE(s.commission_pct, 0),
                   'general',
                   s.created_by,
                   unixepoch()
            FROM internal_sellers s
            LEFT JOIN users u ON u.user_id = s.user_id
        """)
        async with conn.execute("PRAGMA table_info(users)") as c:
            user_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [
            ("internal_note", "TEXT"),
            ("risk_tag", "TEXT"),
        ]:
            if col not in user_cols:
                await conn.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")
        await conn.commit()

    log.info("✅ Francho Shop API v2 listo | BOT_ROOT=%s", BOT_ROOT)
    yield
    await buffpin.close()
    await oxapay.close()


app = FastAPI(title="Francho Shop API", version="2.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])

NUMBERS_API_BASE = os.getenv("NUMBERS_API_BASE", "http://127.0.0.1:8095").rstrip("/")
NUMBERS_API_KEY = (os.getenv("NUMBERS_WEB_API_KEY") or os.getenv("NUMBERS_API_KEY") or "").strip()
NUMBERS_API_TIMEOUT = float(os.getenv("NUMBERS_API_TIMEOUT", "20"))

# Directorio de iconos
ICONS_DIR = BOT_ROOT / "data" / "game_icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)
DELIVERY_DIR = BOT_ROOT / "data" / "delivery_files"
DELIVERY_DIR.mkdir(parents=True, exist_ok=True)

# Endpoint explícito para servir iconos (en vez de StaticFiles mount que falla con Nginx proxy)
from fastapi.responses import FileResponse, Response

@app.get("/api/icons/{filename}")
async def serve_icon(filename: str):
    """Sirve archivos de iconos desde data/game_icons/."""
    # Sanear filename para evitar path traversal
    clean = filename.replace("/", "").replace("\\", "").replace("..", "")
    filepath = ICONS_DIR / clean
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(404, "Icono no encontrado")
    return FileResponse(
        str(filepath),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},  # cachear 1h
    )


@app.get("/api/delivery-files/{filename}")
async def serve_delivery_file(filename: str):
    """Sirve archivos digitales de entrega automática con nombre aleatorio."""
    clean = filename.replace("/", "").replace("\\", "").replace("..", "")
    filepath = DELIVERY_DIR / clean
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(404, "Archivo no encontrado")
    return FileResponse(str(filepath), headers={"Cache-Control": "private, max-age=3600"})


@app.post("/api/admin/upload-delivery-file")
async def admin_upload_delivery_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Sube un archivo para entrega automática: txt, pdf, imagen o comprimido."""
    await ensure_manual_manager(user["id"])
    content_type = (file.content_type or "application/octet-stream").lower()
    allowed_ext = {
        "text/plain": ".txt",
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "application/zip": ".zip",
        "application/x-zip-compressed": ".zip",
        "application/x-rar-compressed": ".rar",
        "application/vnd.rar": ".rar",
    }
    original = file.filename or "entrega"
    suffix = Path(original).suffix.lower()
    ext = allowed_ext.get(content_type) or (suffix if suffix in {".txt", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".zip", ".rar"} else "")
    if not ext:
        raise HTTPException(400, "Formato no permitido. Usa TXT, PDF, imagen, ZIP o RAR")
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, "Archivo demasiado grande. Máximo 25 MB")
    safe_name = f"delivery-{int(time.time())}-{uuid.uuid4().hex[:12]}{ext}"
    (DELIVERY_DIR / safe_name).write_bytes(raw)
    await audit_json(user["id"], "delivery_file.upload", "delivery_file", safe_name, {"filename": original, "size": len(raw), "content_type": content_type})
    return {"ok": True, "url": f"/api/delivery-files/{safe_name}", "filename": original, "content_type": content_type, "size": len(raw)}


@app.post("/api/admin/upload-icon")
async def admin_upload_icon(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Sube una imagen para usarla como icono/portada de productos manuales."""
    await ensure_manual_manager(user["id"])

    content_type = (file.content_type or "").lower()
    allowed = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    ext = allowed.get(content_type)
    if not ext:
        raise HTTPException(400, "Formato no permitido. Usa JPG, PNG, WEBP o GIF")

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(400, "Imagen demasiado grande. Máximo 10 MB")

    safe_name = f"manual-{int(time.time())}-{uuid.uuid4().hex[:8]}{ext}"
    filepath = ICONS_DIR / safe_name
    filepath.write_bytes(raw)
    return {"ok": True, "url": f"/api/icons/{safe_name}"}


# Handler global: cualquier excepción no manejada se loguea Y devuelve JSON con detalle
from fastapi import Request
from fastapi.responses import JSONResponse
import traceback as tb_module

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_detail = {
        "detail": f"{type(exc).__name__}: {str(exc)}",
        "path": str(request.url.path),
        "traceback": tb_module.format_exc().splitlines()[-5:],  # últimas 5 líneas
    }
    log.error("UNHANDLED ERROR on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content=error_detail)


def clean_chinese(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r"\([^)]*[\u4e00-\u9fff]+[^)]*\)", "", name)
    name = re.sub(r"[\u4e00-\u9fff]+", "", name)
    # Normalizar paréntesis chinos / Full-width
    name = name.replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", " ", name).strip()


def get_ca(product: dict) -> str:
    """
    Obtiene el campo 'ca' (categoría) del producto.
    Viene en el raw_json de BuffPin que guardamos cacheado.
    """
    ca = product.get("ca")
    if ca:
        return ca
    raw = product.get("raw_json")
    if raw:
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
            return parsed.get("ca", "") or ""
        except (json.JSONDecodeError, TypeError):
            pass
    return ""


# Patrones de detección: el PRIMER match gana. Ordenar más específicos primero.
GAME_PATTERNS = [
    # ─── CONSOLA / JUEGOS DE CONSOLA: antes de gift cards para no mezclar Xbox Global Games ───
    ("🎮 Xbox Games", ["xbox global games", "xbox:"]),
    ("🎮 Nintendo Games", ["nintendo games", "pokemon sword&shield", "expansion pass", "happy home paradise", "booster course pass"]),
    ("➕ PlayStation Plus", ["playstation plus", "ps plus", "plus brand"]),
    ("🎟️ Xbox Game Pass", ["xbox game pass", "xbox gpu", "game pass ultimate", "game pass core", "xbox live gold"]),
    ("🕹️ Nintendo Switch Online", ["nintendo membership", "nintendo switch online", "nintendo switch 12m", "nintendo switch 3m", "nintendo 12 months", "nintendo 3 months", "nintendo switch family", "nintendo switch individual"]),

    # ─── GIFT CARDS / TARJETAS ───
    ("🍎 Apple Gift Card", ["apple", "app store", "itunes"]),
    ("▶️ Google Play Gift Card", ["google play", "googleplay"]),
    ("🎁 Steam Gift Card", ["steam"]),
    ("🎬 Netflix Gift Card", ["netflix"]),
    ("🎵 Spotify Gift Card", ["spotify"]),
    ("🎮 PlayStation Gift Card", ["playstation", "psn", "sony esd wallet"]),
    ("🎮 Xbox Gift Card", ["xbox live", "xbox game pass", "xbox subscriptions", "xbox usa", "xbox uk", "xbox au", "xbox ca", "xbox de", "xbox fr", "xbox mx", "xbox br", "xbox sg", "xbox uae", "xbox ksa", "xbox turkey", "xbox live gold", "xbox singapore", "xbox norway", "xbox poland", "xbox colombia", "xbox hong kong", "xbox new zealand", "xbox south africa", "xbox"]),
    ("🎮 Nintendo eShop Gift Card", ["nintendo eshop", "nintendo e-shop", "nintendo gift", "nintendo usa", "nintendo se", "nintendo pl", "nintendo no", "nintendo uk", "nintendo eu", "nintendo mx", "nintendo jp", "nintendo hk", "nintendo be", "nintendo at", "nintendo nl", "nintendo pt", "nintendo it", "nintendo ie", "nintendo fr", "nintendo de", "nintendo es", "nintendo fi", "nintendo ch", "nintendo ca", "nintendo br", "nintendo dk", "nintendo canada", "nintendo brazil", "nintendo switzerland", "nintendo germany", "nintendo denmark", "nintendo spain", "nintendo finland", "nintendo france", "nintendo hong kong", "nintendo ireland", "nintendo italy", "nintendo japan", "nintendo mexico", "nintendo netherlands", "nintendo norway", "nintendo poland", "nintendo portugal", "nintendo sweden", "nintendo austria", "nintendo belgium", "nintendo uk"]),
    ("🛒 Amazon Gift Card", ["amazon"]),
    ("🎟️ Eneba Gift Card", ["eneba gift card", "eneba"]),
    ("🛍️ JD.com Gift Card", ["jd.com", "jdcom"]),
    ("💚 Razer Gold", ["razer gold", "razer th"]),
    ("🔥 Garena Shells", ["garena shells", "garena shell"]),
    ("💳 Visa Gift Card", ["visa vanilla", "vanilla visa", "rewarble visa", "my prepaid center visa"]),
    ("💳 Mastercard Gift Card", ["mastercard", "rewarble mastercard", "transcash"]),
    ("🍒 Cherry Credits", ["cherry credits"]),
    ("💳 PayPal Top Up", ["paypal instant top up", "paypal top up", "rewarble paypal", "rewarble paypal", "paypal"]),
    ("💳 Neosurf", ["neosurf"]),
    ("🎟️ Culture Land", ["culture land"]),
    ("💳 Payeer", ["payeer"]),
    ("🛒 Walmart Gift Card", ["walmart"]),
    ("📶 Airalo eSIM", ["airalo", "esim"]),
    ("💬 Discord Nitro", ["discord nitro"]),

    # ─── JUEGOS ───
    ("🔥 Free Fire", ["free fire", "freefire", "ff diamonds"]),
    ("⚔️ Mobile Legends", ["mobile legends", "mlbb"]),
    ("🎯 PUBG Mobile", ["pubg"]),
    ("🚂 Honkai Star Rail", ["honkai star rail", "star rail"]),
    ("💫 Honkai Impact", ["honkai impact"]),
    ("⭐ Genshin Impact", ["genshin"]),
    ("💥 Arena Breakout", ["arena breakout"]),
    ("🩸 Blood Strike", ["blood strike"]),
    ("🔫 Call of Duty", ["call of duty", "cod mobile", "codm"]),
    ("⚡ Delta Force", ["delta force"]),
    ("👑 Honor of Kings", ["honor of kings"]),
    ("🏰 Clash of Clans", ["clash of clans"]),
    ("👑 Clash Royale", ["clash royale"]),
    ("⭐ Brawl Stars", ["brawl stars"]),
    ("🎮 Roblox", ["roblox"]),
    ("🎯 Valorant", ["valorant"]),
    ("🏹 League of Legends", ["wild rift", "league of legends"]),
    ("⚽ eFootball", ["efootball"]),
    ("🏎 Asphalt", ["asphalt"]),
    ("🗡 Identity V", ["identity v"]),
    ("🌊 LifeAfter", ["lifeafter"]),
    ("⚔️ Rise of Kingdoms", ["rise of kingdoms"]),
    ("🏰 Lords Mobile", ["lords mobile"]),
]


def detect_game(product: dict | str) -> str:
    """
    Detecta el juego usando el campo 'ca' como fuente principal,
    con fallback al goodsName.
    Acepta dict (producto) o str (solo goods_name, para compatibilidad).
    """
    if isinstance(product, dict):
        ca = re.sub(r"\s+", " ", get_ca(product)).lower().strip()
        name = re.sub(r"\s+", " ", (product.get("goods_name") or product.get("goodsName") or "")).lower().strip()
        if any(p in name for p in ["playstation plus", "ps plus", "plus brand"]):
            return "➕ PlayStation Plus"
        if any(p in name for p in ["xbox game pass", "xbox gpu", "game pass ultimate", "game pass core", "xbox live gold"]):
            return "🎟️ Xbox Game Pass"
        if ca.startswith("xbox") and not name.startswith(("xbox", "xbox live")):
            return "🎮 Xbox Games"
        if any(p in name for p in ["nintendo switch online", "nintendo switch 12m", "nintendo switch 3m", "nintendo 12 months", "nintendo 3 months"]):
            return "🕹️ Nintendo Switch Online"
        sources = [ca, name]
    else:
        sources = [(product or "").lower()]

    for src in sources:
        if not src:
            continue
        for game, patterns in GAME_PATTERNS:
            for p in patterns:
                if p in src:
                    return game
    return "📦 Otros"


# Marcar qué juegos son gift cards para el frontend
GIFT_CARD_GAMES = {
    "🍎 Apple Gift Card", "▶️ Google Play Gift Card", "🎁 Steam Gift Card",
    "🎬 Netflix Gift Card", "🎵 Spotify Gift Card",
    "🎮 PlayStation Gift Card", "🎮 Xbox Gift Card", "🎮 Nintendo eShop Gift Card",
    "🛒 Amazon Gift Card", "🎟️ Eneba Gift Card", "🛍️ JD.com Gift Card",
    "💚 Razer Gold", "🔥 Garena Shells",
    "💳 Visa Gift Card", "💳 Mastercard Gift Card",
    "🍒 Cherry Credits", "💳 PayPal Top Up", "💳 Neosurf",
    "🎟️ Culture Land", "💳 Payeer", "🛒 Walmart Gift Card",
}



SERVICE_GAMES = {"📶 Airalo eSIM"}
SUBSCRIPTION_GAMES = {"💬 Discord Nitro"}
CONSOLE_GAMES = {"🎮 Xbox Games", "🎮 Nintendo Games"}
GAME_CARD_GAMES = {
    "🎮 PlayStation Gift Card", "➕ PlayStation Plus",
    "🎮 Xbox Gift Card", "🎟️ Xbox Game Pass", "🎮 Nintendo eShop Gift Card",
    "🕹️ Nintendo Switch Online", "💚 Razer Gold", "🔥 Garena Shells",
}


def has_required_player_fields(product: dict) -> bool:
    raw = product.get("platform_config") or product.get("platformConfig") or ""
    if not raw:
        return False
    try:
        fields = json.loads(raw) if isinstance(raw, str) else raw
    except (json.JSONDecodeError, TypeError):
        return False
    return isinstance(fields, list) and len(fields) > 0


def detect_catalog_type(game: str, items: list[dict] | None = None) -> str:
    if game in SERVICE_GAMES:
        return "digital-service"
    if game in SUBSCRIPTION_GAMES:
        return "subscription"
    if game in CONSOLE_GAMES:
        return "game-console"
    if game in GAME_CARD_GAMES:
        return "game-cards"
    if game in GIFT_CARD_GAMES:
        return "card"
    if items and any(has_required_player_fields(p) for p in items):
        return "direct-topup"
    return "game"


def extract_regions(platform_config_raw: str) -> list[dict]:
    """Devuelve [{serverId, serverName}, ...] desde platform_config."""
    if not platform_config_raw:
        return []
    try:
        cfg = json.loads(platform_config_raw)
    except (json.JSONDecodeError, TypeError):
        return []
    regions = []
    for field in cfg:
        if isinstance(field, dict) and field.get("selected") == 1:
            for v in field.get("values", []):
                name = v.get("serverName") or v.get("name")
                sid = v.get("serverId") or v.get("id", "")
                if name:
                    regions.append({"serverName": name, "serverId": str(sid)})
    return regions


# Patrones de región en el nombre (cuando platform_config no los tiene)
NAME_REGION_PATTERNS = [
    ("Brazil", r"\bbrazil\b|\bbrasil\b|\(br\)"),
    ("Turkey", r"\bturkey\b|\(tr\)"),
    ("Indonesia", r"\bindonesia\b|\(id\)"),
    ("Singapore", r"\bsingapore\b|\(sg\)"),
    ("Malaysia", r"\bmalaysia\b|\(my\)"),
    ("Philippines", r"\bphilippines\b|\(ph\)"),
    ("Thailand", r"\bthailand\b|\(th\)"),
    ("Vietnam", r"\bvietnam\b|\(vn\)"),
    ("Russia", r"\brussia\b|\(ru\)"),
    ("Global", r"\bglobal\b"),
    ("Europe", r"\beurope\b|\beuropa\b|\(eu\)"),
    ("America", r"\bamerica\b|\bamérica\b|\(us\)|\blatam\b"),
    ("Mexico", r"\bmexico\b|\bméxico\b|\(mx\)"),
    ("India", r"\bindia\b|\(in\)"),
    ("Japan", r"\bjapan\b|\bjapón\b|\(jp\)"),
    ("Korea", r"\bkorea\b|\(kr\)"),
    ("Asia", r"\basia\b"),
]


def detect_region_from_name(name: str) -> str | None:
    """Fallback: detecta región desde el nombre cuando platform_config no la tiene."""
    n = (name or "").lower()
    for region, pattern in NAME_REGION_PATTERNS:
        if re.search(pattern, n):
            return region
    return None


# ═══════════════════════════════════════════
#  Detección de país para Gift Cards
# ═══════════════════════════════════════════

# Mapeo de códigos de país (ISO 2 letras) y nombres comunes → país completo + emoji
GIFT_COUNTRY_MAP = {
    # Europa
    "uk": ("🇬🇧 Reino Unido", "GB"),
    "gb": ("🇬🇧 Reino Unido", "GB"),
    "de": ("🇩🇪 Alemania", "DE"),
    "fr": ("🇫🇷 Francia", "FR"),
    "es": ("🇪🇸 España", "ES"),
    "it": ("🇮🇹 Italia", "IT"),
    "be": ("🇧🇪 Bélgica", "BE"),
    "nl": ("🇳🇱 Países Bajos", "NL"),
    "pl": ("🇵🇱 Polonia", "PL"),
    "pt": ("🇵🇹 Portugal", "PT"),
    "at": ("🇦🇹 Austria", "AT"),
    "ch": ("🇨🇭 Suiza", "CH"),
    "se": ("🇸🇪 Suecia", "SE"),
    "no": ("🇳🇴 Noruega", "NO"),
    "fi": ("🇫🇮 Finlandia", "FI"),
    "dk": ("🇩🇰 Dinamarca", "DK"),
    "ie": ("🇮🇪 Irlanda", "IE"),
    "gr": ("🇬🇷 Grecia", "GR"),
    # América
    "usa": ("🇺🇸 Estados Unidos", "US"),
    "us": ("🇺🇸 Estados Unidos", "US"),
    "ca": ("🇨🇦 Canadá", "CA"),
    "mx": ("🇲🇽 México", "MX"),
    "br": ("🇧🇷 Brasil", "BR"),
    "ar": ("🇦🇷 Argentina", "AR"),
    "cl": ("🇨🇱 Chile", "CL"),
    "co": ("🇨🇴 Colombia", "CO"),
    # Asia/Oceanía
    "jp": ("🇯🇵 Japón", "JP"),
    "kr": ("🇰🇷 Corea", "KR"),
    "cn": ("🇨🇳 China", "CN"),
    "hk": ("🇭🇰 Hong Kong", "HK"),
    "tw": ("🇹🇼 Taiwán", "TW"),
    "sg": ("🇸🇬 Singapur", "SG"),
    "my": ("🇲🇾 Malasia", "MY"),
    "id": ("🇮🇩 Indonesia", "ID"),
    "th": ("🇹🇭 Tailandia", "TH"),
    "ph": ("🇵🇭 Filipinas", "PH"),
    "vn": ("🇻🇳 Vietnam", "VN"),
    "in": ("🇮🇳 India", "IN"),
    "au": ("🇦🇺 Australia", "AU"),
    "nz": ("🇳🇿 Nueva Zelanda", "NZ"),
    # Oriente Medio
    "uae": ("🇦🇪 Emiratos Árabes", "AE"),
    "ae": ("🇦🇪 Emiratos Árabes", "AE"),
    "sa": ("🇸🇦 Arabia Saudita", "SA"),
    "tr": ("🇹🇷 Turquía", "TR"),
    "il": ("🇮🇱 Israel", "IL"),
    # Especiales
    "global": ("🌍 Global", "GLOBAL"),
    "europe": ("🇪🇺 Europa", "EU"),
    "eu": ("🇪🇺 Europa", "EU"),
}


def detect_giftcard_country(name: str) -> tuple[str, str] | None:
    """
    Detecta país de una gift card desde su nombre.
    Ej: "Apple USA 50 USD" → ("🇺🇸 Estados Unidos", "US")
        "Google Play UAE 30 AED" → ("🇦🇪 Emiratos Árabes", "AE")
        "Apple GBP 10 GBP" → detectar UK por la moneda GBP
        "PL 100 PLN" → ("🇵🇱 Polonia", "PL")
        "BE 40 EUR" → ("🇧🇪 Bélgica", "BE")
    """
    if not name:
        return None
    n_low = name.lower()

    # Intento 1: palabras separadas (ej "Apple USA", "Google Play UAE")
    words = re.findall(r"\b[a-z]{2,4}\b", n_low)
    for w in words:
        if w in GIFT_COUNTRY_MAP:
            return GIFT_COUNTRY_MAP[w]

    # Intento 2: monedas comunes → país
    currency_to_country = {
        "gbp": "gb", "usd": "us", "eur": "eu", "jpy": "jp",
        "cad": "ca", "aud": "au", "mxn": "mx", "brl": "br",
        "aed": "ae", "sar": "sa", "try": "tr", "ils": "il",
        "krw": "kr", "cny": "cn", "hkd": "hk", "twd": "tw",
        "sgd": "sg", "myr": "my", "idr": "id", "thb": "th",
        "php": "ph", "vnd": "vn", "inr": "in", "nzd": "nz",
        "pln": "pl", "czk": "cz", "huf": "hu", "ron": "ro",
        "sek": "se", "nok": "no", "dkk": "dk", "chf": "ch",
    }
    for curr, code in currency_to_country.items():
        if curr in n_low and code in GIFT_COUNTRY_MAP:
            return GIFT_COUNTRY_MAP[code]

    return None


def extract_region_from_ca(ca: str, game: str) -> str | None:
    """
    Extrae la región del campo 'ca' quitando el nombre del juego.
    Ej: "Mobile Legends Indonesia (O)" → "Indonesia"
        "Apple Belgium" → "Belgium"
        "Google Play Germany" → "Germany"
        "Arena Breakout (USD)" → "USD"
        "Free Fire Diamonds (LATAM)" → "LATAM"
        "Mobile Legends Global (exec ID, MY, PH, RU, SG, TR) (O)" → "Global"
        "Delta Force‌ USD" → "USD"
    """
    if not ca:
        return None
    # Normalizar caracteres unicode invisibles (U+200C zero-width non-joiner)
    n = ca.replace("\u200c", "").strip()
    # Normalizar paréntesis full-width
    n = n.replace("（", "(").replace("）", ")")

    if game == "🍎 Apple Gift Card":
        n2 = n
        for prefix in ("App Store & iTunes", "app store & itunes", "Apple", "apple", "iTunes", "itunes"):
            if n2.startswith(prefix):
                n2 = n2[len(prefix):].strip()
        if n2.startswith("& iTunes"):
            n2 = n2[8:].strip()
        apple_map = {"HongKong": "Hong Kong", "HK": "Hong Kong", "RU": "Russia", "TRY": "Turkey", "TR": "Turkey", "NZ": "New Zealand", "UAE": "UAE", "TW": "Taiwan"}
        return apple_map.get(n2, n2) or "Estándar"

    if game in {"🎮 Xbox Gift Card", "🎟️ Xbox Game Pass", "🎮 Xbox Games"} and n.lower().startswith(("xbox", "xbox")):
        if game == "🎟️ Xbox Game Pass":
            low = n.lower()
            if re.search(r"\bmx\b", low):
                return "Mexico"
            if re.search(r"\bbr\b", low):
                return "Brazil"
            if re.search(r"\bau\b", low):
                return "Australia"
            if re.search(r"\bca\b|cad\b", low):
                return "Canada"
            if re.search(r"\bnz\b", low):
                return "New Zealand"
            if re.search(r"\buk\b", low):
                return "UK"
            if re.search(r"\busa\b|\bus\b", low):
                return "USA"
            if re.search(r"\bsg\b|singapore", low):
                return "Singapore"
            if re.search(r"\buae\b", low):
                return "UAE"
            if re.search(r"\bksa\b", low):
                return "KSA"
        n2 = re.sub(r"^xbox\s*:?\s*", "", n, flags=re.IGNORECASE).strip()
        n2 = re.sub(r"^game\s+pass\s+(ultimate|core|pc)?\s*", "", n2, flags=re.IGNORECASE).strip()
        n2 = re.sub(r"^live\s+gold\s*", "", n2, flags=re.IGNORECASE).strip()
        xbox_map = {
            "AU": "Australia", "Australia": "Australia", "BR": "Brazil", "Brazil": "Brazil",
            "CA": "Canada", "Canada": "Canada", "CZ": "Czech Republic", "Czech Republic": "Czech Republic",
            "DE": "Germany", "Germany": "Germany", "FR": "France", "France": "France",
            "HU": "Hungary", "Hungary": "Hungary", "KSA": "KSA", "MX": "Mexico", "Mexico": "Mexico",
            "NZ": "New Zealand", "New Zealand": "New Zealand", "NO": "Norway", "Norway": "Norway",
            "PL": "Poland", "Poland": "Poland", "SG": "Singapore", "Singapore": "Singapore",
            "UAE": "UAE", "UK": "UK", "USA": "USA", "ZA": "South Africa", "South Africa": "South Africa",
            "Subscriptions": "Global", "Global": "Global", "Turkey": "Turkey", "Colombia": "Colombia", "Hong Kong": "Hong Kong",
        }
        n2 = xbox_map.get(n2, n2)
        return n2 or "Estándar"

    if game == "➕ PlayStation Plus" and n.lower().startswith("playstation"):
        n2 = re.sub(r"^playstation\s*", "", n, flags=re.IGNORECASE).strip()
        return {"Canada": "Canada", "USA (Promo)": "USA", "USA": "USA"}.get(n2, n2) or "Estándar"

    if game == "🎮 Nintendo eShop Gift Card" and n.lower().startswith("nintendo"):
        n2 = re.sub(r"^nintendo\s+", "", n, flags=re.IGNORECASE).strip()
        return {"EU": "Europa", "HongKong": "Hong Kong"}.get(n2, n2) or "Estándar"

    if game == "🕹️ Nintendo Switch Online" and n.lower().startswith("nintendo"):
        n2 = re.sub(r"^nintendo\s+switch\s+online\s+membership\s*", "", n, flags=re.IGNORECASE).strip()
        n2 = re.sub(r"^nintendo\s+membership\s*", "", n2, flags=re.IGNORECASE).strip()
        n2 = re.sub(r"^nintendo\s+switch\s*", "", n2, flags=re.IGNORECASE).strip()
        n2 = re.sub(r"^nintendo\s*", "", n2, flags=re.IGNORECASE).strip()
        n2 = re.sub(r"^online\s+membership\s*", "", n2, flags=re.IGNORECASE).strip()
        n2 = re.sub(r"^membership\s*", "", n2, flags=re.IGNORECASE).strip()
        return {"EU": "Europa", "HongKong": "Hong Kong"}.get(n2, n2) or "Estándar"

    if game == "🎮 Nintendo Games" and n.lower().startswith("nintendo"):
        n2 = re.sub(r"^nintendo\s+games\s*", "", n, flags=re.IGNORECASE).strip()
        n2 = re.sub(r"^nintendo\s+pokemon\s+expansion\s+pass\s*", "", n2, flags=re.IGNORECASE).strip()
        return {"HongKong": "Hong Kong", "UK": "UK"}.get(n2, n2) or "Estándar"

    # Quitar el nombre del juego: intentar con todas las variantes
    patterns_to_remove = []
    for g, ps in GAME_PATTERNS:
        if g == game:
            patterns_to_remove.extend(ps)
    # Añadir el nombre del juego limpio (sin emoji)
    game_clean = re.sub(r"[^\w\s]", "", game).strip()
    if game_clean:
        patterns_to_remove.append(game_clean)

    # Ordenar por longitud descendente (más específico primero)
    patterns_to_remove.sort(key=len, reverse=True)

    for p in patterns_to_remove:
        if p.lower() in n.lower():
            idx = n.lower().find(p.lower())
            n = (n[:idx] + n[idx + len(p):]).strip()
            break  # solo quitar UNA vez

    # Quitar palabras irrelevantes comunes
    for kw in ["diamonds", "gift card", "card"]:
        n = re.sub(rf"\b{kw}\b", "", n, flags=re.IGNORECASE).strip()

    # Si queda algo entre paréntesis al final SIN región antes, extraer lo de paréntesis
    # Ej: "(USD)" → "USD",  "(LATAM)" → "LATAM"
    if not re.sub(r"[\(\)\s]", "", n).strip():
        return "Estándar"

    m_outside = re.sub(r"\([^)]*\)", "", n).strip()
    if not m_outside:
        # Todo está entre paréntesis, extraerlo
        m = re.search(r"\(([^)]+)\)", n)
        if m:
            n = m.group(1).strip()
    else:
        # Hay texto fuera de paréntesis: preferirlo y descartar detalles entre paréntesis
        # "Global (exec ID, MY, PH, RU, SG, TR)" → "Global"
        n = m_outside

    # Último limpieza
    n = re.sub(r"\s+", " ", n).strip(" -·,")
    n = {"HongKong": "Hong Kong", "EU": "Europa", "USA": "USA"}.get(n, n)

    return n or "Estándar"


def get_regions_for_product(p: dict) -> list[dict]:
    """
    Estrategia híbrida para detectar regiones:
    1. Primero intenta platform_config (para juegos con selector de servidor)
    2. Si no hay, usa el campo 'ca' del producto (fuente limpia de BuffPin)
    3. Fallback al goods_name
    """
    game = detect_game(p)
    if game == "🩸 Blood Strike":
        ca = get_ca(p)
        name = (p.get("goods_name") or p.get("goodsName") or "").lower()
        if "mena" in ca.lower() or "mena" in name:
            return [{"serverName": "MENA", "serverId": ""}]
        return [{"serverName": "Global", "serverId": ""}]

    # 1. platform_config (Arena Breakout, PUBG con selector)
    regs = extract_regions(p.get("platform_config", ""))
    if regs:
        return regs

    game = detect_game(p)
    if game == "📶 Airalo eSIM":
        name = p.get("goods_name", "") or ""
        patterns = [
            ("Hong Kong", r"hong kong|hkmobile"),
            ("South Korea", r"south korea|korea"),
            ("Taiwan", r"taiwan"),
            ("Vietnam", r"vietnam"),
            ("Asia", r"asialink|\basia\b"),
            ("Europe", r"eurolink|\beurope\b"),
            ("Global", r"discover global|\bglobal\b"),
            ("Thailand", r"thailand|dtac"),
            ("Japan", r"japan|moshi moshi"),
            ("Indonesia", r"indonesia|indotel"),
            ("Malaysia", r"malaysia|sambungkan"),
            ("Philippines", r"philippines|alpas"),
        ]
        for region, pattern in patterns:
            if re.search(pattern, name, flags=re.IGNORECASE):
                return [{"serverName": region, "serverId": ""}]

    if game == "💳 PayPal Top Up":
        currency = (p.get("cost_currency") or p.get("costCurrency") or "").upper().strip()
        name = p.get("goods_name", "") or ""
        if not currency:
            m = re.search(r"\b([A-Z]{3})\b\s+\d", name)
            currency = m.group(1).upper() if m else ""
        paypal_currency_regions = {
            "JPY": "Japan", "MXN": "Mexico", "HKD": "Hong Kong", "USD": "USA",
            "EUR": "Europe", "GBP": "UK", "CAD": "Canada", "AUD": "Australia",
            "SGD": "Singapore", "BRL": "Brazil", "TRY": "Turkey", "AED": "UAE",
        }
        region = paypal_currency_regions.get(currency)
        if region:
            return [{"serverName": region, "serverId": ""}]

    # 2. Campo 'ca' (para Mobile Legends, Free Fire, Gift Cards, etc)
    ca = get_ca(p)
    if ca:
        game = detect_game(p)
        region_name = extract_region_from_ca(ca, game)
        if region_name and region_name != "Estándar":
            return [{"serverName": region_name, "serverId": ""}]

    # 3. Fallback: goods_name
    name_region = detect_region_from_name(p.get("goods_name", ""))
    if name_region:
        return [{"serverName": name_region, "serverId": ""}]

    return []


REGION_FLAGS = {
    # Asia
    "asia": "🌏", "indonesia": "🇮🇩", "singapore": "🇸🇬", "malaysia": "🇲🇾",
    "philippines": "🇵🇭", "thailand": "🇹🇭", "vietnam": "🇻🇳", "cambodia": "🇰🇭",
    "japan": "🇯🇵", "korea": "🇰🇷", "india": "🇮🇳", "china": "🇨🇳",
    "tw, hk, mo": "🇹🇼", "taiwan": "🇹🇼", "hong kong": "🇭🇰",
    "my/sg/ph/kh": "🇲🇾", "my/sg": "🇲🇾",
    # Europa
    "europe": "🇪🇺", "europa": "🇪🇺", "eu": "🇪🇺", "uk": "🇬🇧",
    "germany": "🇩🇪", "france": "🇫🇷", "italy": "🇮🇹", "spain": "🇪🇸",
    "belgium": "🇧🇪", "netherlands": "🇳🇱", "portugal": "🇵🇹", "austria": "🇦🇹",
    "switzerland": "🇨🇭", "sweden": "🇸🇪", "norway": "🇳🇴", "finland": "🇫🇮",
    "denmark": "🇩🇰", "ireland": "🇮🇪", "greece": "🇬🇷", "poland": "🇵🇱",
    # América
    "america": "🌎", "us": "🇺🇸", "usa": "🇺🇸", "canada": "🇨🇦",
    "mexico": "🇲🇽", "brazil": "🇧🇷", "brasil": "🇧🇷", "latam": "🌎",
    "argentina": "🇦🇷", "chile": "🇨🇱", "colombia": "🇨🇴",
    # Oceanía
    "australia": "🇦🇺", "new zealand": "🇳🇿",
    # Oriente Medio / África
    "turkey": "🇹🇷", "uae": "🇦🇪", "saudi arabia": "🇸🇦", "mena": "🌍",
    "israel": "🇮🇱", "russia": "🇷🇺",
    # Global / especiales
    "global": "🌍", "world": "🌍", "usd": "💵", "eur": "💶", "gbp": "💷",
}


def region_with_flag(region: str) -> str:
    if not region:
        return "🌐 Estándar"
    return f"{REGION_FLAGS.get(region.lower().strip(), '🌐')} {region}"


def get_product_sort_value_api(name: str) -> float:
    m = re.search(r"\d+(?:[.,]\d+)?", name or "")
    return float(m.group(0).replace(",", ".")) if m else 0.0


def infer_nominal_amount(raw_amount: float) -> int | None:
    if raw_amount <= 0:
        return None
    candidates = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1500, 2000, 2500, 3000, 5000, 10000, 20000, 50000]
    best = min(candidates, key=lambda c: abs(c - raw_amount) / max(c, 1))
    if abs(best - raw_amount) / max(best, 1) <= 0.08:
        return best
    return None


def clean_product_name(product: dict, game: str) -> str:
    name = clean_name(product.get("goods_name", "?"), game)
    if game == "🍎 Apple Gift Card":
        currency = (product.get("cost_currency") or product.get("costCurrency") or "").upper().strip()
        raw = product.get("goods_name", "") or name
        point_currency = "HKD" if "HongKong" in raw or "Hong Kong" in raw else (currency or "HKD")
        raw = raw.replace("點", point_currency)
        cleaned = clean_chinese(raw)
        for prefix in ("App Store & iTunes", "App Store & iTune", "iTunes", "iTune", "Apple"):
            if cleaned.lower().startswith(prefix.lower()):
                cleaned = cleaned[len(prefix):].strip()
        if cleaned.startswith("&"):
            cleaned = cleaned[1:].strip()
        for prefix in ("iTunes", "iTune"):
            if cleaned.lower().startswith(prefix.lower()):
                cleaned = cleaned[len(prefix):].strip()
        parts = cleaned.split()
        region_codes = {"HONGKONG", "HONG", "KONG", "TRY", "TR", "IN", "RU", "NZ", "UAE", "TW", "DK", "CA", "AU", "AT", "BE", "FR", "FI", "DE", "IT", "ES", "UK", "GB", "US", "USA", "JP", "MX", "NO", "PL", "PT", "SE", "CH", "IE", "CN", "BR", "SAR", "AED", "DKK"}
        while parts and parts[0].upper() in region_codes and len(parts) > 1:
            parts.pop(0)
        if len(parts) == 1 and currency:
            parts.append(currency)
        if len(parts) >= 3 and parts[0].upper() == parts[-1].upper() and parts[0].isalpha():
            parts = parts[1:]
        return " ".join(parts).strip() or name
    if game == "🎮 Xbox Games":
        return re.sub(r"\s+(SA|AE)$", "", name, flags=re.IGNORECASE).strip()
    if re.search(r"\d", name or ""):
        if game == "🎮 Xbox Gift Card":
            name = re.sub(r"^SA\s+(\d+\s+SAR)$", r"\1", name, flags=re.IGNORECASE).strip()
            name = re.sub(r"^USD\s+(\d+)\s+SA$", r"\1 USD", name, flags=re.IGNORECASE).strip()
            name = re.sub(r"^[A-Z]{2}\s+(\d+\s+[A-Z]{3})$", r"\1", name, flags=re.IGNORECASE).strip()
        return name
    currency = (product.get("cost_currency") or product.get("costCurrency") or "").upper().strip()
    raw_name = product.get("goods_name", "") or ""
    if game == "🎮 Xbox Gift Card" and re.search(r"\bSAR\b|\bKSA\b", raw_name, flags=re.IGNORECASE):
        currency = "SAR"
    if not currency:
        return name
    raw_amount = float(product.get("pay_price", 0) or 0)
    nominal = infer_nominal_amount(raw_amount)
    if not nominal:
        return name
    prefix = name.strip()
    if prefix.upper() in {currency, "UAE", "SA", "SAR", "USD", "CAD", "VIRTUAL CAD"}:
        return f"{nominal:g} {currency}"
    if prefix.lower() in {"amazon.com.au", ".com.au"}:
        return f"{nominal:g} {currency}"
    if prefix.lower().startswith("virtual") and currency:
        return f"Virtual {nominal:g} {currency}"
    return f"{prefix} {nominal:g} {currency}"


def get_product_info_sections(product: dict, game: str) -> dict:
    raw_name = product.get("goods_name", "") or ""
    name_l = raw_name.lower()

    if "rewarble" in name_l or "paypal" in name_l or game == "💳 PayPal Top Up":
        return {
            "description": (
                "Rewarble Pay Gift Card es un producto digital para recargar saldo en Rewarble y usarlo en servicios compatibles. "
                "Después de la compra recibirás un código digital que puedes redimir en Rewarble. El saldo se puede utilizar, según disponibilidad de Rewarble, "
                "para billeteras digitales, pagos en línea, entretenimiento y otras plataformas asociadas.\n\n"
                "La entrega es digital y el producto se procesa de forma automática cuando el pago y la orden quedan confirmados. "
                "Antes de comprar, revisa bien la moneda y denominación seleccionada porque cada región o moneda puede tener condiciones diferentes."
            ),
            "instructions": (
                "1. Compra la denominación correcta en Francho Shop.\n"
                "2. Cuando recibas el código, entra a https://www.rewarble.com e inicia sesión en tu cuenta.\n"
                "3. Toca la opción Redeem o Canjear en Rewarble.\n"
                "4. Ingresa el código recibido exactamente como aparece.\n"
                "5. Confirma el canje y espera a que el saldo se agregue a tu cuenta Rewarble.\n"
                "6. Usa el saldo dentro de Rewarble para el servicio compatible que necesites.\n\n"
                "Importante: no compartas el código con nadie. Si el código fue redimido correctamente, el uso posterior depende de las reglas y disponibilidad de Rewarble."
            ),
        }

    return {"description": "", "instructions": ""}


def merge_product_info_sections(product: dict, game: str, override: dict | None = None) -> dict:
    info = get_product_info_sections(product, game)
    override = override or {}
    description = override.get("description")
    instructions = override.get("instructions")
    return {
        "description": description if description is not None else info.get("description", ""),
        "instructions": instructions if instructions is not None else info.get("instructions", ""),
    }

def clean_name(name: str, game: str = "", ca: str = "") -> str:
    """
    Limpia el nombre del producto quitando:
    - El nombre del juego (ej: "Apple USA 50 USD" → quitar "Apple")
    - Prefijos de región/país (ej: "BE 40 EUR" → "40 EUR")
    - Caracteres chinos y paréntesis raros
    - Palabras redundantes (Diamonds cuando se ve claro)
    """
    if not name:
        return "?"
    n = clean_chinese(name)

    if game == "➕ PlayStation Plus":
        n = re.sub(r"^playstation\s+plus\s+", "", n, flags=re.IGNORECASE).strip()
        n = re.sub(r"^playstation\s+", "", n, flags=re.IGNORECASE).strip()
        n = re.sub(r"^plus\s+brand\s+", "", n, flags=re.IGNORECASE).strip()
        n = re.sub(r"^brand\s+", "", n, flags=re.IGNORECASE).strip()
        return re.sub(r"\s+", " ", n).strip() or name
    if game in {"🎟️ Xbox Game Pass", "🎮 Xbox Gift Card"}:
        n = re.sub(r"^xbox\s+", "", n, flags=re.IGNORECASE).strip()
        n = re.sub(r"^live\s+", "", n, flags=re.IGNORECASE).strip() if game == "🎮 Xbox Gift Card" else n
        if game == "🎮 Xbox Gift Card":
            n = re.sub(r"^SA\s+", "", n, flags=re.IGNORECASE).strip()
            n = re.sub(r"\s+(KSA|SA)$", "", n, flags=re.IGNORECASE).strip()
            n = re.sub(r"^USD\s+(\d+(?:[.,]\d+)?)$", r"\1 USD", n, flags=re.IGNORECASE).strip()
        return re.sub(r"\s+", " ", n).strip() or name
    if game == "📶 Airalo eSIM":
        n = re.sub(r"^airalo\s+", "", n, flags=re.IGNORECASE).strip()
        n = re.sub(r"\s+eSIM$", "", n, flags=re.IGNORECASE).strip()
        return re.sub(r"\s+", " ", n).strip() or name
    if game == "🎮 Nintendo eShop Gift Card":
        n = re.sub(r"^nintendo\s+", "", n, flags=re.IGNORECASE).strip()
    elif game == "🕹️ Nintendo Switch Online":
        n = re.sub(r"^nintendo\s+switch\s+online\s+membership\s*", "", n, flags=re.IGNORECASE).strip()
        n = re.sub(r"^nintendo\s+membership\s*", "", n, flags=re.IGNORECASE).strip()
        n = re.sub(r"^nintendo\s+switch\s*", "", n, flags=re.IGNORECASE).strip()
        n = re.sub(r"^nintendo\s*", "", n, flags=re.IGNORECASE).strip()
        return re.sub(r"\s+", " ", n).strip() or name
    elif game == "🎮 Nintendo Games":
        n = re.sub(r"^nintendo\s+", "", n, flags=re.IGNORECASE).strip()
        return re.sub(r"\s+", " ", n).strip() or name

    # Quitar el nombre del juego (intentando varias variantes)
    if game:
        patterns_to_remove = []
        for g, ps in GAME_PATTERNS:
            if g == game:
                patterns_to_remove.extend(ps)
        game_clean = re.sub(r"[^\w\s]", "", game).strip()
        if game_clean:
            patterns_to_remove.append(game_clean)
            first_word = game_clean.split()[0]
            if first_word:
                patterns_to_remove.append(first_word)

        patterns_to_remove.sort(key=len, reverse=True)
        for p in patterns_to_remove:
            if n.lower().startswith(p.lower()):
                n = n[len(p):].strip()
                break

    # Quitar prefijos de región tipo "Brazil (O)", "Turkey (O)"
    n = re.sub(
        r"^(Brazil|Turkey|Indonesia|Singapore|Malaysia|Philippines|Thailand|"
        r"Vietnam|Russia|Global|Europe|America|Mexico|India|Japan|Korea|Asia|"
        r"LATAM|MENA|Cambodia|Philippines)"
        r"\s*\([^)]*\)\s*",
        "", n, flags=re.IGNORECASE,
    )

    # Quitar prefijos cortos de país/moneda al inicio: "USA", "UK", "BE", "PL", "UAE", "GBP", etc.
    n = re.sub(
        r"^(USA|US|UK|GB|DE|FR|ES|IT|BE|NL|PL|PT|AT|CH|SE|NO|FI|DK|IE|GR|"
        r"CA|MX|BR|AR|CL|CO|JP|KR|CN|HK|TW|SG|MY|ID|TH|PH|VN|IN|AU|NZ|"
        r"UAE|AE|SA|TR|IL|EU|GBP|EUR|USD|USDT|JPY|MXN|HKD|CAD|AUD|SGD|BRL|PLN|AED|SAR|NOK|CZK|HUF|MENA|LATAM)\s+",
        "", n, flags=re.IGNORECASE,
    )

    # Quitar paréntesis vacíos o con solo espacios
    n = re.sub(r"\(\s*\)", "", n)
    # Quitar prefijo "(O)" suelto
    n = re.sub(r"^\(O\)\s*", "", n)
    # Limpiar residuos de marcas con punto, ej: Amazon.pt EUR 5000 EUR -> 5000 EUR
    n = re.sub(r"^\.(?:com\.au|pt|sg|ae|sa)\s+", "", n, flags=re.IGNORECASE)
    n = re.sub(
        r"^(USA|US|UK|GB|DE|FR|ES|IT|BE|NL|PL|PT|AT|CH|SE|NO|FI|DK|IE|GR|"
        r"CA|MX|BR|AR|CL|CO|JP|KR|CN|HK|TW|SG|MY|ID|TH|PH|VN|IN|AU|NZ|"
        r"UAE|AE|SA|TR|IL|EU|GBP|EUR|USD|USDT|JPY|MXN|HKD|CAD|AUD|SGD|BRL|PLN|AED|SAR|NOK|CZK|HUF|MENA|LATAM)\s+",
        "", n, flags=re.IGNORECASE,
    )
    # Evitar moneda duplicada al inicio y al final: CAD 5000 CAD -> 5000 CAD
    currency_codes = r"USD|EUR|GBP|CAD|AUD|MXN|BRL|PLN|AED|SAR|SGD|NOK|ZAR|NZD|HKD|COP|TRY|CZK|HUF|DKK|INR|RUB|JPY|CNY|TWD"
    n = re.sub(
        rf"^({currency_codes})\s+(\d+(?:[.,]\d+)?)\s+\1$",
        r"\2 \1",
        n,
        flags=re.IGNORECASE,
    )
    n = re.sub(
        rf"^(Virtual)\s+({currency_codes})\s+(\d+(?:[.,]\d+)?)\s+\2$",
        r"\1 \3 \2",
        n,
        flags=re.IGNORECASE,
    )
    # Colapsar espacios
    n = re.sub(r"\s+", " ", n).strip()

    return n or name


async def get_user_role(user_id: int) -> str:
    if user_id in config.ADMIN_IDS:
        return "admin"
    return await db.get_user_role(user_id)


async def get_reseller_min_deposit() -> float:
    return max(50.0, await settings.get_float("reseller_min_deposit", 50.0))


async def get_effective_pricing_role(user_id: int) -> str:
    role = await get_user_role(user_id)
    if role != "reseller":
        return role
    user_row = await db.get_user(user_id) or {}
    total_deposit = float(user_row.get("total_deposit", 0) or 0)
    return "reseller" if total_deposit >= await get_reseller_min_deposit() else "user"


@app.get("/api/sms/health")
async def sms_health():
    return await numbers_api_request("GET", "/api/health")


@app.get("/api/sms/countries")
async def sms_countries_proxy(user: dict = Depends(get_current_user)):
    return await numbers_api_request("GET", "/api/sms/countries")


@app.get("/api/sms/services")
async def sms_services_proxy(country: str, user: dict = Depends(get_current_user)):
    country = (country or "").strip().lower()
    if not country:
        raise HTTPException(400, "country requerido")
    return await numbers_api_request("GET", "/api/sms/services", params={"country": country})


@app.get("/api/sms/operators")
async def sms_operators_proxy(country: str, service: str, user: dict = Depends(get_current_user)):
    country = (country or "").strip().lower()
    service = (service or "").strip().lower()
    if not country or not service:
        raise HTTPException(400, "country y service son requeridos")
    return await numbers_api_request("GET", "/api/sms/operators", params={"country": country, "service": service})


@app.post("/api/sms/order/create")
async def sms_order_create_proxy(payload: dict, user: dict = Depends(get_current_user)):
    body = {
        "user_id": int(user["id"]),
        "country": str((payload or {}).get("country") or "").strip().lower(),
        "service": str((payload or {}).get("service") or "").strip().lower(),
        "operator": str((payload or {}).get("operator") or "any").strip().lower(),
    }
    if not body["country"] or not body["service"]:
        raise HTTPException(400, "country y service son requeridos")
    return await numbers_api_request("POST", "/api/sms/order/create", json_body=body)


@app.get("/api/sms/order/status")
async def sms_order_status_proxy(id: str | None = None, order_id: str | None = None, id_5sim: str | None = None, user: dict = Depends(get_current_user)):
    lookup = id or order_id or id_5sim
    if not lookup:
        raise HTTPException(400, "id requerido")
    result = await numbers_api_request("GET", "/api/sms/order/status", params={"id": lookup})
    order = (result or {}).get("order") or {}
    if order and int(order.get("user_id") or 0) != int(user["id"]):
        raise HTTPException(403, "No puedes ver esta orden")
    return result


@app.post("/api/sms/order/cancel")
async def sms_order_cancel_proxy(payload: dict, user: dict = Depends(get_current_user)):
    lookup = (payload or {}).get("id") or (payload or {}).get("order_id") or (payload or {}).get("id_5sim")
    if not lookup:
        raise HTTPException(400, "id requerido")
    status_result = await numbers_api_request("GET", "/api/sms/order/status", params={"id": lookup})
    order = (status_result or {}).get("order") or {}
    if order and int(order.get("user_id") or 0) != int(user["id"]):
        raise HTTPException(403, "No puedes cancelar esta orden")
    return await numbers_api_request("POST", "/api/sms/order/cancel", json_body={"id": lookup})


async def ensure_manual_manager(user_id: int) -> str:
    role = await get_user_role(user_id)
    if role not in ("admin", "seller"):
        raise HTTPException(403, "Solo admin o vendedor autorizado")
    return role


async def get_seller_permissions(user_id: int) -> dict:
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM internal_sellers WHERE user_id=? AND is_active=1",
            (user_id,),
        ) as c:
            row = await c.fetchone()
            return dict(row) if row else {}


async def get_seller_limit(user_id: int) -> int:
    perms = await get_seller_permissions(user_id)
    return int(perms.get("max_products") or 0)


def make_store_slug(value: str, fallback: str = "tienda") -> str:
    raw = str(value or fallback).lower().strip()
    raw = re.sub(r"[^a-z0-9]+", "-", raw)
    raw = re.sub(r"-+", "-", raw).strip("-")
    return (raw or fallback)[:64]


def clean_external_url(value: str) -> str:
    url = str(value or "").strip()
    if not url:
        return ""
    url = re.sub(r"^https?:///api/", "/api/", url, flags=re.I)
    if url.startswith("/api/") or url.startswith("/"):
        return url[:500]
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url[:500]


def account_seller_public_payload(profile: dict | None) -> dict | None:
    if not profile:
        return None
    allow_links = bool(profile.get("allow_external_links", 1))
    return {
        "user_id": profile.get("user_id"),
        "store_name": profile.get("store_name") or "Vendedor Francho Shop",
        "store_slug": profile.get("store_slug") or "",
        "store_description": profile.get("store_description") or "",
        "store_image": clean_external_url(profile.get("store_image")),
        "banner_image": clean_external_url(profile.get("banner_image")),
        "whatsapp_url": clean_external_url(profile.get("whatsapp_url")) if allow_links else "",
        "social_url_1": clean_external_url(profile.get("social_url_1")) if allow_links else "",
        "social_url_2": clean_external_url(profile.get("social_url_2")) if allow_links else "",
        "status": profile.get("status") or "active",
        "seller_type": profile.get("seller_type") or "account",
        "rating": profile.get("rating"),
        "total_orders": int(profile.get("total_orders") or 0),
        "total_sales": float(profile.get("total_sales") or 0),
        "verified": True,
    }


async def attach_account_seller_profiles(products: list[dict]) -> list[dict]:
    seller_ids = sorted({int(p.get("created_by") or 0) for p in products if int(p.get("created_by") or 0) > 0})
    profiles = {}
    for seller_id in seller_ids:
        profile = await db.get_account_seller_profile(user_id=seller_id, active_only=True)
        if profile:
            profiles[seller_id] = account_seller_public_payload(profile)
    for product in products:
        sid = int(product.get("created_by") or 0)
        if sid in profiles:
            product["seller_store"] = profiles[sid]
    return products


async def get_recharge_seller(seller_id: int) -> dict:
    if not seller_id:
        return {}
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM internal_sellers WHERE user_id=? AND is_active=1 AND can_sell_recharges=1",
            (int(seller_id),),
        ) as c:
            row = await c.fetchone()
            return dict(row) if row else {}


async def get_valid_recharge_seller_id(seller_id: int | None, buyer_id: int) -> int | None:
    try:
        sid = int(seller_id or 0)
    except Exception:
        return None
    if sid <= 0 or sid == int(buyer_id):
        return None
    return sid if await get_recharge_seller(sid) else None


async def assert_can_manage_manual_product(actor_id: int, product_id: int) -> tuple[str, dict]:
    role = await ensure_manual_manager(actor_id)
    product = await db.get_manual_product(product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado")
    if role == "seller" and int(product.get("created_by") or 0) != int(actor_id):
        raise HTTPException(403, "No puedes modificar productos de otro vendedor")
    return role, product


async def audit_json(admin_id: int, action: str, target_type: str = "", target_id: str = "", details: dict | None = None):
    await db.audit(admin_id, action, target_type, str(target_id or ""), json.dumps(details or {}, ensure_ascii=False))


async def prevent_duplicate_purchase(user_id: int, scope: str, product_id: int, payload: dict, ttl: int = 8):
    now = time.time()
    expired = [k for k, until in RECENT_PURCHASE_KEYS.items() if until <= now]
    for k in expired:
        RECENT_PURCHASE_KEYS.pop(k, None)
    raw = json.dumps(payload or {}, sort_keys=True, ensure_ascii=False, default=str)
    key = f"{user_id}:{scope}:{product_id}:{raw}"
    if RECENT_PURCHASE_KEYS.get(key, 0) > now:
        raise HTTPException(429, "Compra duplicada detectada. Espera unos segundos antes de intentar de nuevo.")
    RECENT_PURCHASE_KEYS[key] = now + ttl


async def send_telegram_html(chat_id: int, text: str, timeout: int = 10) -> bool:
    if not config.BOT_TOKEN or not chat_id:
        return False
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage",
                json={"chat_id": int(chat_id), "text": text, "parse_mode": "HTML"},
                timeout=aiohttp.ClientTimeout(total=timeout),
            ) as resp:
                if resp.status >= 400:
                    log.warning("Telegram notify failed %s: %s", resp.status, await resp.text())
                    return False
        return True
    except Exception as e:
        log.warning("Telegram notify error for %s: %s", chat_id, e)
        return False


async def get_admin_notification_targets(extra_ids: list[int] | None = None) -> list[int]:
    targets = {int(x) for x in getattr(config, "ADMIN_IDS", []) if x}
    try:
        import aiosqlite
        async with aiosqlite.connect(config.DB_PATH) as conn:
            async with conn.execute("SELECT user_id FROM users WHERE role='admin' AND user_id > 0") as c:
                targets.update(int(r[0]) for r in await c.fetchall() if r[0])
    except Exception as e:
        log.warning("No se pudieron cargar admins para notificar: %s", e)
    for user_id in extra_ids or []:
        try:
            if int(user_id) > 0:
                targets.add(int(user_id))
        except Exception:
            pass
    return sorted(targets)


async def notify_admins(text: str, extra_ids: list[int] | None = None):
    for chat_id in await get_admin_notification_targets(extra_ids):
        await send_telegram_html(chat_id, text)


async def notify_manual_purchase_pending(order_id: int, product: dict, product_label: str, price: float, buyer_id: int, customer_data: dict):
    buyer = await db.get_user(buyer_id)
    buyer_name = html.escape(str((buyer or {}).get("first_name") or "?"))
    buyer_username = html.escape(str((buyer or {}).get("username") or ""))
    buyer_email = html.escape(str((buyer or {}).get("email") or ""))
    fields = []
    for key, value in (customer_data or {}).items():
        fields.append(f"   {html.escape(str(key))}: <code>{html.escape(str(value))}</code>")
    field_text = "\n".join(fields) if fields else "   Sin datos adicionales"
    seller_id = int(product.get("created_by") or 0)
    text = (
        f"🛒 <b>Nueva compra manual pendiente</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"📦 <b>{html.escape(str(product_label))}</b>\n"
        f"💰 Precio: <b>${price:.2f} USDT</b>\n"
        f"📋 Tipo: {html.escape(str(product.get('delivery_type') or 'manual'))}\n"
        f"🆔 Pedido: <b>#{order_id}</b>\n\n"
        f"👤 <b>Cliente</b>\n"
        f"   ID: <code>{buyer_id}</code>\n"
        f"   Nombre: {buyer_name}\n"
    )
    if buyer_username:
        text += f"   Telegram: @{buyer_username}\n"
    if buyer_email:
        text += f"   Email: {buyer_email}\n"
    text += f"\n🧾 <b>Datos enviados</b>\n{field_text}\n\nAbre el panel admin para entregar o revisar el pedido."
    await notify_admins(text, [seller_id] if seller_id and seller_id != buyer_id else [])


def build_order_ficha_html(
    title: str,
    order_id: int | str,
    price: float,
    *,
    headline: str = "✅ <b>Pedido confirmado</b>",
    status_label: str = "Procesado",
    detail_label: str = "Detalle",
    detail_value: str = "",
    note: str = "",
) -> str:
    safe_title = html.escape(str(title or "?"))
    safe_detail = html.escape(str(detail_value or ""))
    safe_note = html.escape(str(note or ""))
    now = time.strftime("%d/%m/%Y %H:%M", time.localtime())
    text = (
        f"{headline}\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"🧾 <b>Ficha del pedido</b>\n"
        f"📦 <b>{safe_title}</b>\n"
        f"🆔 Pedido: <code>#{order_id}</code>\n"
        f"💰 Precio: <b>${float(price):.2f} USDT</b>\n"
        f"📌 Estado: <b>{html.escape(status_label)}</b>\n"
        f"🕒 {html.escape(now)}\n"
    )
    if detail_value:
        text += f"\n📬 <b>{html.escape(detail_label)}</b>\n<code>{safe_detail}</code>\n"
    if note:
        text += f"\n💬 <b>Nota</b>\n{safe_note}\n"
    text += "\n<i>Guarda esta ficha para tu control.</i>"
    return text


FX_TO_USD = {

    "USD": 1.0, "USDT": 1.0,
    "EUR": 1.08, "GBP": 1.27, "CAD": 0.73, "AUD": 0.66, "NZD": 0.61, "CHF": 1.11,
    "JPY": 0.0064, "CNY": 0.14, "HKD": 0.128, "SGD": 0.74, "TWD": 0.031, "KRW": 0.00073,
    "AED": 0.2723, "SAR": 0.2666, "TRY": 0.031, "ILS": 0.27,
    "MXN": 0.059, "BRL": 0.20, "COP": 0.00027, "ARS": 0.0010, "CLP": 0.0011,
    "PLN": 0.25, "SEK": 0.096, "NOK": 0.095, "DKK": 0.145, "CZK": 0.044, "HUF": 0.0028, "RON": 0.217,
    "ZAR": 0.054, "INR": 0.012, "PHP": 0.017, "MYR": 0.21, "THB": 0.028, "IDR": 0.000064, "VND": 0.000039, "RUB": 0.011,
}


def get_fx_to_usd(currency: str) -> float:
    code = (currency or "USD").upper().strip()
    try:
        overrides = json.loads(os.getenv("BUFFPIN_FX_TO_USD", "{}") or "{}")
        if code in overrides:
            rate = float(overrides[code])
            if rate > 0:
                return rate
    except Exception:
        pass
    return FX_TO_USD.get(code, 1.0)


def convert_product_cost_to_usdt(product: dict) -> float:
    raw_cost = float(product.get("pay_price", 0) or 0)
    currency = (product.get("cost_currency") or product.get("costCurrency") or "USD").upper().strip()
    return round(raw_cost * get_fx_to_usd(currency), 4)


async def get_game_pricing(game_name: str) -> dict:
    import aiosqlite
    try:
        async with aiosqlite.connect(config.DB_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute(
                "SELECT retail_markup, reseller_markup FROM game_icons WHERE game_name=?",
                (game_name,),
            ) as c:
                row = await c.fetchone()
                return dict(row) if row else {}
    except Exception as e:
        log.warning("game pricing fallback: %s", e)
        return {}


async def calculate_product_price(product: dict, role: str) -> dict:
    game_name = detect_game(product)
    game_pricing = await get_game_pricing(game_name)
    if role == "reseller":
        markup_pct = game_pricing.get("reseller_markup")
        if markup_pct is None:
            markup_pct = await settings.get_float("reseller_markup", 8.0)
    else:
        markup_pct = game_pricing.get("retail_markup")
        if markup_pct is None:
            markup_pct = await settings.get_float("retail_markup", 20.0)
    cost = convert_product_cost_to_usdt(product)
    sell_price = round(cost * (1 + float(markup_pct) / 100), 2)
    return {"sell_price": sell_price, "markup_pct": float(markup_pct), "game_name": game_name, "cost_usdt": cost}


class OrderRequest(BaseModel):
    product_id: int
    fields: dict = Field(default_factory=dict)
    seller_id: int | None = None


class DepositCreateRequest(BaseModel):
    amount: float = Field(gt=0)


class ReferralApplyRequest(BaseModel):
    referrer_id: int


class OrderReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = ""




@app.get("/api/reviews/public")
async def public_reviews(product_id: int | None = None, manual_product_id: int | None = None, game_name: str | None = None, limit: int = 10):
    product_ids = None
    if game_name:
        products = await db.get_cached_products()
        product_ids = [int(p.get("id") or 0) for p in products if detect_game(p) == game_name]
    return await db.get_public_reviews(product_id=product_id, manual_product_id=manual_product_id, product_ids=product_ids, limit=limit)


@app.get("/api/public-config")
async def public_config():
    """Config publica para la mini app. El BOT_TOKEN nunca se expone."""
    username = BOT_INFO_CACHE.get("username") or os.getenv("BOT_USERNAME", "")
    if not username and config.BOT_TOKEN:
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"https://api.telegram.org/bot{config.BOT_TOKEN}/getMe",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    data = await resp.json()
                    if data.get("ok") and data.get("result", {}).get("username"):
                        username = data["result"]["username"]
                        BOT_INFO_CACHE["username"] = username
        except Exception as e:
            log.warning("No se pudo obtener username del bot: %s", e)
    return {"bot_username": username or None}

@app.get("/api/health")
async def health():
    """Health check con info de diagnóstico para debugging."""
    import os
    db_path = config.DB_PATH
    db_abs = os.path.abspath(db_path)
    db_exists = os.path.exists(db_abs)
    db_size = os.path.getsize(db_abs) if db_exists else 0

    # Contar productos cacheados
    products_count = 0
    try:
        prods = await db.get_cached_products()
        products_count = len(prods)
    except Exception as e:
        log.error("health: get_cached_products failed: %s", e)

    return {
        "ok": True,
        "service": "Francho Shop",
        "version": "2.0.1",
        "bot_root": str(BOT_ROOT),
        "db_path": db_path,
        "db_abs": db_abs,
        "db_exists": db_exists,
        "db_size_bytes": db_size,
        "products_cached": products_count,
    }


@app.get("/api/diag")
async def diag():
    """Diagnóstico completo — sin auth para debugging."""
    prods = await db.get_cached_products()
    if not prods:
        return {
            "products_cached": 0,
            "warning": "DB vacía — el bot debe refrescar el catálogo con /admin → 🛒 Productos → 🔄 Refrescar",
            "db_path": config.DB_PATH,
        }
    grouped = defaultdict(int)
    for p in prods:
        grouped[detect_game(p)] += 1
    return {
        "products_cached": len(prods),
        "games_detected": dict(grouped),
        "sample_product": {
            "id": prods[0]["id"],
            "name": prods[0].get("goods_name"),
            "cost": prods[0].get("pay_price"),
            "has_platform_config": bool(prods[0].get("platform_config")),
        },
    }


@app.get("/api/diag-icons")
async def diag_icons():
    """Diagnóstico de iconos sin auth."""
    import os
    icons = []
    if ICONS_DIR.exists():
        for f in ICONS_DIR.iterdir():
            if f.is_file():
                icons.append({
                    "name": f.name,
                    "size": f.stat().st_size,
                    "url": f"/api/icons/{f.name}",
                })
    # Leer asociaciones de DB
    import aiosqlite
    associations = []
    try:
        async with aiosqlite.connect(config.DB_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute(
                "SELECT game_name, icon_url FROM game_icons WHERE icon_url IS NOT NULL"
            ) as c:
                for r in await c.fetchall():
                    associations.append(dict(r))
    except Exception as e:
        associations = [{"error": str(e)}]

    return {
        "icons_dir": str(ICONS_DIR),
        "icons_dir_exists": ICONS_DIR.exists(),
        "icons_count": len(icons),
        "icons": icons,
        "db_associations": associations,
    }


@app.get("/api/diag-games")
async def diag_games():
    """Simula /api/games SIN auth — para debug fácil con curl."""
    import traceback
    try:
        prods = await db.get_cached_products()
        grouped = defaultdict(list)
        for p in prods:
            grouped[detect_game(p)].append(p)

        # Probar leer game_icons
        import aiosqlite
        overrides = {}
        try:
            async with aiosqlite.connect(config.DB_PATH) as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS game_icons (
                        game_name TEXT PRIMARY KEY, emoji TEXT, icon_url TEXT,
                        display_name TEXT, sort_order INTEGER DEFAULT 100,
                        is_hidden INTEGER DEFAULT 0,
                        updated_at REAL DEFAULT (unixepoch())
                    )
                """)
                await conn.commit()
                conn.row_factory = aiosqlite.Row
                async with conn.execute(
                    "SELECT game_name, emoji, icon_url, display_name, sort_order, is_hidden, description, instructions FROM game_icons"
                ) as c:
                    for r in await c.fetchall():
                        overrides[r["game_name"]] = dict(r)
        except Exception as e:
            return {"step": "loading_icons", "error": str(e), "tb": traceback.format_exc()}

        result = []
        for game, items in grouped.items():
            override = overrides.get(game, {})
            if override.get("is_hidden"):
                continue
            parts = game.split(" ", 1)
            result.append({
                "name": game,
                "emoji": override.get("emoji") or (parts[0] if len(parts) > 1 else "🎮"),
                "icon_url": override.get("icon_url"),
                "title": override.get("display_name") or (parts[1] if len(parts) > 1 else game),
                "count": len(items),
                "sort_order": override.get("sort_order") or 100,
            })
        result.sort(key=lambda x: (x["name"] == "📦 Otros", x["sort_order"], x["title"]))
        return {"ok": True, "games_count": len(result), "games": result}

    except Exception as e:
        return {
            "step": "general", "error": str(e), "type": type(e).__name__,
            "traceback": traceback.format_exc().splitlines(),
        }



async def load_game_icon_overrides() -> dict:
    cached = catalog_cache_get("game_icon_overrides")
    if cached is not None:
        return cached
    import aiosqlite
    overrides = {}
    try:
        async with aiosqlite.connect(config.DB_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute("SELECT game_name, emoji, icon_url, display_name, sort_order, is_hidden, description, instructions FROM game_icons") as c:
                for r in await c.fetchall():
                    overrides[r["game_name"]] = dict(r)
    except Exception as e:
        log.warning("game_icons fallback: %s", e)
    return catalog_cache_set("game_icon_overrides", overrides)


async def load_catalog_social_stats() -> dict:
    cached = catalog_cache_get("catalog_social_stats")
    if cached is not None:
        return cached
    import aiosqlite
    stats = {
        "auto_orders": {},
        "auto_reviews": {},
        "manual_orders": {},
        "manual_reviews": {},
    }
    try:
        async with aiosqlite.connect(config.DB_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute("""
                SELECT product_id, COUNT(*) AS orders_count
                FROM orders
                WHERE order_status=2 AND product_id IS NOT NULL
                GROUP BY product_id
            """) as cur:
                for row in await cur.fetchall():
                    stats["auto_orders"][int(row["product_id"])] = int(row["orders_count"] or 0)
            async with conn.execute("""
                SELECT o.product_id, COUNT(*) AS rating_count, COALESCE(AVG(r.rating),0) AS avg_rating
                FROM order_reviews r
                JOIN orders o ON r.order_type='auto' AND r.order_id=o.merchant_order_id
                WHERE o.product_id IS NOT NULL
                GROUP BY o.product_id
            """) as cur:
                for row in await cur.fetchall():
                    stats["auto_reviews"][int(row["product_id"])] = {
                        "count": int(row["rating_count"] or 0),
                        "avg": float(row["avg_rating"] or 0),
                    }
            async with conn.execute("""
                SELECT product_id, COUNT(*) AS orders_count
                FROM manual_orders
                WHERE status IN ('completed','delivered') AND product_id IS NOT NULL
                GROUP BY product_id
            """) as cur:
                for row in await cur.fetchall():
                    stats["manual_orders"][int(row["product_id"])] = int(row["orders_count"] or 0)
            async with conn.execute("""
                SELECT mo.product_id, COUNT(*) AS rating_count, COALESCE(AVG(r.rating),0) AS avg_rating
                FROM order_reviews r
                JOIN manual_orders mo ON r.order_type='manual' AND r.order_id=CAST(mo.id AS TEXT)
                WHERE mo.product_id IS NOT NULL
                GROUP BY mo.product_id
            """) as cur:
                for row in await cur.fetchall():
                    stats["manual_reviews"][int(row["product_id"])] = {
                        "count": int(row["rating_count"] or 0),
                        "avg": float(row["avg_rating"] or 0),
                    }
    except Exception as e:
        log.warning("catalog social stats fallback: %s", e)
    return catalog_cache_set("catalog_social_stats", stats)


def summarize_social_stats(ids: list[int], orders_map: dict, reviews_map: dict) -> dict:
    clean_ids = [int(pid) for pid in ids if int(pid or 0) > 0]
    orders_count = sum(int(orders_map.get(pid, 0) or 0) for pid in clean_ids)
    rating_count = 0
    rating_total = 0.0
    for pid in clean_ids:
        review = reviews_map.get(pid) or {}
        count = int(review.get("count") or 0)
        rating_count += count
        rating_total += float(review.get("avg") or 0) * count
    avg_rating = round(rating_total / rating_count, 2) if rating_count else 0
    return {"orders_count": orders_count, "rating_count": rating_count, "avg_rating": avg_rating}


async def build_games_catalog() -> list[dict]:
    cached = catalog_cache_get("games_catalog")
    if cached is not None:
        return cached
    prods = await db.get_cached_products()
    grouped = defaultdict(list)
    for p in prods:
        try:
            grouped[detect_game(p)].append(p)
        except Exception:
            grouped["📦 Otros"].append(p)
    overrides = await load_game_icon_overrides()
    social_stats = await load_catalog_social_stats()
    result = []
    for game, items in grouped.items():
        override = overrides.get(game, {})
        if override.get("is_hidden"):
            continue
        parts = game.split(" ", 1)
        default_emoji = parts[0] if len(parts) > 1 else "🎮"
        default_title = parts[1] if len(parts) > 1 else game
        if game == "🎮 Nintendo eShop Gift Card":
            default_title = "Nintendo eShop Gift Card"
        elif game == "➕ PlayStation Plus":
            default_title = "PlayStation Plus"
        elif game == "🎟️ Xbox Game Pass":
            default_title = "Xbox Game Pass"
        elif game == "🕹️ Nintendo Switch Online":
            default_title = "Nintendo Switch Online"
        category = "giftcard" if game in GIFT_CARD_GAMES else "game"
        game_social = summarize_social_stats([p.get("id") for p in items], social_stats["auto_orders"], social_stats["auto_reviews"])
        result.append({
            "name": game,
            "emoji": override.get("emoji") or default_emoji,
            "icon_url": override.get("icon_url"),
            "title": override.get("display_name") or default_title,
            "count": len(items),
            "sort_order": override.get("sort_order") or 100,
            "category": category,
            "catalog_type": detect_catalog_type(game, items),
            **game_social,
            **merge_product_info_sections(items[0] if items else {}, game, override),
        })
    result.sort(key=lambda x: (x["name"] == "📦 Otros", x["sort_order"], x["title"]))
    return catalog_cache_set("games_catalog", result)


async def build_regions_catalog(game_name: str) -> list[dict]:
    key = f"regions:{game_name}"
    cached = catalog_cache_get(key)
    if cached is not None:
        return cached
    prods = await db.get_cached_products()
    items = [p for p in prods if detect_game(p) == game_name]
    if not items:
        raise HTTPException(404, "Juego no encontrado")
    grouped = defaultdict(list)
    for p in items:
        regs = get_regions_for_product(p)
        if not regs:
            grouped["__standard__"].append(p)
        else:
            for r in regs:
                grouped[r["serverName"]].append(p)
    result = []
    for raw, its in sorted(grouped.items(), key=lambda x: (x[0] == "__standard__", x[0])):
        if raw == "__standard__":
            result.append({"name": "🌐 Estándar", "raw_name": "__standard__", "count": len(its)})
        else:
            result.append({"name": region_with_flag(raw), "raw_name": raw, "count": len(its)})
    return catalog_cache_set(key, result)


async def build_products_catalog(game_name: str, region: str, role: str = "user") -> list[dict]:
    role = role if role in {"admin", "seller", "reseller", "user"} else "user"
    key = f"products:{role}:{game_name}:{region}"
    cached = catalog_cache_get(key)
    if cached is not None:
        return cached
    prods = await db.get_cached_products()
    social_stats = await load_catalog_social_stats()
    result = []
    for p in prods:
        if detect_game(p) != game_name:
            continue
        regs = get_regions_for_product(p)
        region_names = [r["serverName"] for r in regs]
        if region == "__standard__":
            if regs:
                continue
        elif region not in region_names:
            continue
        price = p["custom_price"] if p.get("custom_price") else (await calculate_product_price(p, role))["sell_price"]
        product_social = summarize_social_stats([p.get("id")], social_stats["auto_orders"], social_stats["auto_reviews"])
        result.append({
            "id": p["id"],
            "name": clean_product_name(p, game_name),
            "price": float(price),
            "cost": convert_product_cost_to_usdt(p),
            **product_social,
        })
    deduped = {}
    for item in result:
        key_name = re.sub(r"\s+", " ", item["name"].lower()).strip()
        prev = deduped.get(key_name)
        if not prev or item["price"] < prev["price"]:
            deduped[key_name] = item
    final = sorted(deduped.values(), key=lambda x: (get_product_sort_value_api(x["name"]), x["price"], x["name"]))
    return catalog_cache_set(key, final)


async def build_manual_products_catalog() -> list[dict]:
    cached = catalog_cache_get("manual_products_catalog")
    if cached is not None:
        return cached
    products = await attach_account_seller_profiles(await db.get_manual_products(active_only=True))
    social_stats = await load_catalog_social_stats()
    result = [{
        "id": p["id"],
        "name": p["name"],
        "description": p["description"],
        "category": p["category"],
        "price": float(p["price"]),
        "options": [{"id": o["id"], "name": o["name"], "price": float(o["price"]), "stock": o.get("stock", -1), "sort_order": o.get("sort_order", 100)} for o in p.get("options", []) if o.get("is_active", 1)],
        "fields": [{"id": f["id"], "label": f["label"], "field_type": f.get("field_type", "text"), "placeholder": f.get("placeholder", ""), "is_required": bool(f.get("is_required", 1)), "sort_order": f.get("sort_order", 100)} for f in p.get("fields", []) if f.get("is_active", 1)],
        "icon_url": p.get("icon_url"),
        "delivery_type": p["delivery_type"],
        "stock": p["stock"],
        "seller_store": p.get("seller_store"),
        **summarize_social_stats([p.get("id")], social_stats["manual_orders"], social_stats["manual_reviews"]),
        **account_public_payload(p),
        "instructions": p.get("instructions", ""),
    } for p in products]
    return catalog_cache_set("manual_products_catalog", result)


@app.get("/api/public/games")
async def public_list_games():
    """Catálogo público de juegos sin sesión."""
    if await settings.get_bool("maintenance_mode"):
        raise HTTPException(503, "Mantenimiento en curso")
    return await build_games_catalog()


@app.get("/api/public/games/{game_name}/regions")
async def public_list_regions(game_name: str):
    if await settings.get_bool("maintenance_mode"):
        raise HTTPException(503, "Mantenimiento en curso")
    return await build_regions_catalog(game_name)


@app.get("/api/public/games/{game_name}/regions/{region}/products")
async def public_list_products(game_name: str, region: str):
    if await settings.get_bool("maintenance_mode"):
        raise HTTPException(503, "Mantenimiento en curso")
    return await build_products_catalog(game_name, region, "user")


@app.get("/api/public/products/{product_id}")
async def public_product_detail(product_id: int, region: str = None):
    if await settings.get_bool("maintenance_mode"):
        raise HTTPException(503, "Mantenimiento en curso")
    p = await db.get_cached_product(product_id)
    if not p or p.get("is_hidden"):
        raise HTTPException(404, "Producto no disponible")
    price = p["custom_price"] if p.get("custom_price") else (await calculate_product_price(p, "user"))["sell_price"]
    raw_cfg = p.get("platform_config", "") or "[]"
    try:
        cfg = json.loads(raw_cfg)
    except json.JSONDecodeError:
        cfg = []
    fields = []
    for f in cfg:
        if not isinstance(f, dict):
            continue
        is_select = f.get("selected") == 1
        values = f.get("values", [])
        if is_select and region and region != "__standard__":
            if any(v.get("serverName") == region for v in values):
                continue
        fields.append({"name": f.get("name", "Campo"), "field_name": f.get("filedName") or f.get("name", ""), "tip": f.get("tip", ""), "is_select": is_select, "values": values})
    game = detect_game(p)
    import aiosqlite
    info_override = {}
    try:
        async with aiosqlite.connect(config.DB_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute("SELECT description, instructions, icon_url FROM game_icons WHERE game_name=?", (game,)) as c:
                row = await c.fetchone()
                if row:
                    info_override = dict(row)
    except Exception:
        info_override = {}
    return {
        "id": p["id"],
        "name": clean_product_name(p, game),
        "raw_name": p.get("goods_name", ""),
        "game": game,
        "region": region,
        "price": float(price),
        "cost": convert_product_cost_to_usdt(p),
        "icon_url": info_override.get("icon_url"),
        **merge_product_info_sections(p, game, info_override),
        "fields": fields
    }


@app.get("/api/public/manual-products")
async def public_list_manual_products():
    if await settings.get_bool("maintenance_mode"):
        raise HTTPException(503, "Mantenimiento en curso")
    return await build_manual_products_catalog()


@app.post("/api/deposits")
async def create_web_deposit(req: DepositCreateRequest, user: dict = Depends(get_current_user)):
    """Crea una factura OxaPay desde la web y guarda el depósito pendiente."""
    user_id = user["id"]
    if await db.is_banned(user_id):
        raise HTTPException(403, "Cuenta suspendida")
    min_dep = await settings.get_float("min_deposit")
    amount = round(float(req.amount), 2)
    if amount < min_dep:
        raise HTTPException(400, f"Mínimo {min_dep:.2f} USDT")
    if amount > 10000:
        raise HTTPException(400, "Máximo 10000 USDT")

    callback_url = (
        f"{config.WEBHOOK_HOST}{config.OXAPAY_CALLBACK_PATH}"
        if config.WEBHOOK_HOST else None
    )
    dep_id = db.gen_deposit_id()
    try:
        result = await oxapay.create_invoice(
            amount=amount,
            order_id=dep_id,
            description=f"Francho Shop - Recarga {amount:.2f} USDT",
            callback_url=callback_url,
        )
    except OxaPayError as e:
        raise HTTPException(502, e.message)

    track_id = result.get("track_id") or result.get("trackId") or ""
    pay_link = result.get("pay_link") or result.get("payment_url") or result.get("url") or ""
    if not track_id or not pay_link:
        raise HTTPException(502, "OxaPay no devolvió un enlace válido")

    await db.create_deposit(user_id, amount, track_id, pay_link)
    return {
        "ok": True,
        "deposit_id": dep_id,
        "track_id": track_id,
        "amount": amount,
        "pay_link": pay_link,
        "status": "pending",
    }


@app.get("/api/deposits/{track_id}")
async def check_web_deposit(track_id: str, user: dict = Depends(get_current_user)):
    """Verifica una factura OxaPay y acredita saldo si ya fue pagada."""
    user_id = user["id"]
    dep = await db.get_deposit_by_track(track_id)
    if not dep or dep.get("user_id") != user_id:
        raise HTTPException(404, "Depósito no encontrado")

    if dep.get("status") == "paid":
        return {
            "ok": True,
            "status": "paid",
            "amount": float(dep.get("amount_usd", 0)),
            "balance": float(await db.get_balance(user_id)),
        }

    try:
        info = await oxapay.get_payment(track_id)
    except OxaPayError as e:
        raise HTTPException(502, e.message)

    status = info.get("status", dep.get("status", "pending"))
    if status == "paid":
        await db.update_deposit(track_id, "paid", json.dumps(info, ensure_ascii=False))
        amount = float(dep.get("amount_usd", 0))
        await db.add_balance(user_id, amount, "deposit", track_id, f"Depósito web USDT ${amount:.2f}")
    elif status in ("Paying", "paying", "expired", "failed"):
        await db.update_deposit(track_id, status, json.dumps(info, ensure_ascii=False))

    return {
        "ok": True,
        "status": status,
        "amount": float(dep.get("amount_usd", 0)),
        "balance": float(await db.get_balance(user_id)),
    }

@app.get("/api/me")
async def me(user: dict = Depends(get_current_user)):
    user_id = user["id"]
    await db.upsert_user(user_id, user.get("username"), user.get("first_name"))
    if await db.is_banned(user_id):
        raise HTTPException(403, "Cuenta suspendida")
    role = await get_user_role(user_id)
    effective_role = await get_effective_pricing_role(user_id)
    full = await db.get_user(user_id) or {}
    reseller_min = await get_reseller_min_deposit()
    total_deposit = float(full.get("total_deposit", 0) or 0)
    return {
        "user_id": user_id,
        "name": user.get("first_name", "Usuario"),
        "balance": float(await db.get_balance(user_id)),
        "role": role,
        "pricing_role": effective_role,
        "reseller_min_deposit": reseller_min,
        "reseller_discount_active": role == "reseller" and effective_role == "reseller",
        "reseller_deposit_remaining": max(0.0, round(reseller_min - total_deposit, 2)),
        "retail_markup": await settings.get_float("retail_markup"),
        "reseller_markup": await settings.get_float("reseller_markup"),
    }


@app.get("/api/games")
async def list_games(user: dict = Depends(get_current_user)):
    if await settings.get_bool("maintenance_mode") and user["id"] not in config.ADMIN_IDS:
        raise HTTPException(503, "Mantenimiento en curso")
    try:
        return await build_games_catalog()
    except Exception as e:
        log.error("list_games fallo: %s", e, exc_info=True)
        raise HTTPException(500, f"Error leyendo productos: {e}")


@app.get("/api/admin/game-icons")
async def admin_list_icons(user: dict = Depends(get_current_user)):
    """Listar overrides de iconos (solo admin)."""
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")

    # Obtener todos los juegos disponibles + overrides
    prods = await db.get_cached_products()
    games = set()
    for p in prods:
        games.add(detect_game(p))

    import aiosqlite
    overrides = {}
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM game_icons") as c:
            for r in await c.fetchall():
                overrides[r["game_name"]] = dict(r)

    result = []
    for g in sorted(games):
        override = overrides.get(g, {})
        parts = g.split(" ", 1)
        result.append({
            "game_name": g,
            "emoji": override.get("emoji") or (parts[0] if len(parts) > 1 else "🎮"),
            "icon_url": override.get("icon_url"),
            "display_name": override.get("display_name") or (parts[1] if len(parts) > 1 else g),
            "sort_order": override.get("sort_order") or 100,
            "is_hidden": bool(override.get("is_hidden", 0)),
            "is_customized": g in overrides,
            "description": override.get("description") or "",
            "instructions": override.get("instructions") or "",
        })
    return result


class GameIconUpdate(BaseModel):
    game_name: str
    emoji: str | None = None
    icon_url: str | None = None
    display_name: str | None = None
    sort_order: int | None = 100
    is_hidden: bool | None = False
    description: str | None = None
    instructions: str | None = None


class GamePricingUpdate(BaseModel):
    game_name: str
    retail_markup: float | None = None
    reseller_markup: float | None = None


class ResellerSettingsUpdate(BaseModel):
    reseller_min_deposit: float


class SellerPayoutSettingsUpdate(BaseModel):
    seller_default_commission_pct: float
    seller_min_platform_fee: float
    seller_hold_days_manual: float
    seller_hold_days_auto: float
    seller_new_days: float
    seller_new_hold_days: float
    seller_withdraw_fee_usdt: float = 0.25


class SellerWithdrawalRequest(BaseModel):
    amount: float
    wallet_address: str
    note: str = ""


class SellerWithdrawalDecision(BaseModel):
    txid: str = ""
    note: str = ""


async def get_seller_payout_settings() -> dict:
    return {
        "currency": "USDT",
        "network": "BEP20",
        "seller_default_commission_pct": await settings.get_float("seller_default_commission_pct", 10.0),
        "seller_min_platform_fee": await settings.get_float("seller_min_platform_fee", 0.10),
        "seller_hold_days_manual": await settings.get_float("seller_hold_days_manual", 7.0),
        "seller_hold_days_auto": await settings.get_float("seller_hold_days_auto", 2.0),
        "seller_new_days": await settings.get_float("seller_new_days", 30.0),
        "seller_new_hold_days": await settings.get_float("seller_new_hold_days", 14.0),
        "seller_withdraw_fee_usdt": await settings.get_float("seller_withdraw_fee_usdt", 0.25),
        "min_withdrawal": await settings.get_float("min_withdrawal", 10.0),
    }


@app.get("/api/admin/seller-payout-settings")
async def admin_seller_payout_settings(user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    return await get_seller_payout_settings()


@app.post("/api/admin/seller-payout-settings")
async def admin_update_seller_payout_settings(req: SellerPayoutSettingsUpdate, user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    values = {
        "seller_default_commission_pct": max(0, min(float(req.seller_default_commission_pct), 100)),
        "seller_min_platform_fee": max(0, min(float(req.seller_min_platform_fee), 1000)),
        "seller_hold_days_manual": max(0, min(float(req.seller_hold_days_manual), 365)),
        "seller_hold_days_auto": max(0, min(float(req.seller_hold_days_auto), 365)),
        "seller_new_days": max(0, min(float(req.seller_new_days), 3650)),
        "seller_new_hold_days": max(0, min(float(req.seller_new_hold_days), 365)),
        "seller_withdraw_fee_usdt": max(0, min(float(req.seller_withdraw_fee_usdt), 1000)),
    }
    for key, value in values.items():
        await settings.set_value(key, f"{value:.4f}", user["id"])
    await audit_json(user["id"], "seller_payout.settings_update", "settings", "seller_payout", values)
    return {"ok": True, **(await get_seller_payout_settings())}


@app.get("/api/seller/withdrawals")
async def seller_my_withdrawals(user: dict = Depends(get_current_user)):
    role = await ensure_manual_manager(user["id"])
    await db.release_due_seller_holds(None if role == "admin" else user["id"])
    wallet = await db.get_seller_wallet(user["id"])
    return {
        "wallet": wallet,
        "settings": await get_seller_payout_settings(),
        "items": await db.list_seller_withdrawals(seller_id=user["id"], limit=100),
    }


@app.post("/api/seller/withdrawals")
async def seller_request_withdrawal(req: SellerWithdrawalRequest, user: dict = Depends(get_current_user)):
    await ensure_manual_manager(user["id"])
    await db.release_due_seller_holds(user["id"])
    amount = round(float(req.amount), 8)
    settings_data = await get_seller_payout_settings()
    min_amount = float(settings_data.get("min_withdrawal") or 0)
    fee = float(settings_data.get("seller_withdraw_fee_usdt") or 0)
    address = (req.wallet_address or "").strip()
    if amount < min_amount:
        raise HTTPException(400, f"El mínimo de retiro es {min_amount:.2f} USDT")
    if fee >= amount:
        raise HTTPException(400, "El monto debe ser mayor que el fee de retiro")
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", address):
        raise HTTPException(400, "Dirección BEP20 inválida. Debe iniciar con 0x y tener 42 caracteres")
    try:
        withdrawal = await db.create_seller_withdrawal(user["id"], amount, address, fee_amount=fee, note=req.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await audit_json(user["id"], "seller.withdrawal_request", "seller_withdrawal", withdrawal["id"], {"amount": amount, "network": "BEP20"})
    return {"ok": True, "withdrawal": withdrawal, "wallet": await db.get_seller_wallet(user["id"])}


@app.get("/api/seller/account-finance")
async def seller_account_finance(user: dict = Depends(get_current_user)):
    role = await ensure_manual_manager(user["id"])
    if role != "seller":
        raise HTTPException(403, "Solo vendedores")
    profile = await db.get_account_seller_profile(user_id=user["id"], active_only=False)
    if not profile:
        raise HTTPException(403, "Tu usuario no tiene una tienda de cuentas")
    await db.release_due_seller_holds(user["id"])
    wallet = await db.get_seller_wallet(user["id"])
    sales = await db.list_account_seller_sales(seller_id=user["id"], limit=100)
    withdrawals = await db.list_seller_withdrawals(seller_id=user["id"], limit=50)
    movements = wallet.get("movements") or []
    summary = {
        "orders": len(sales),
        "gross": round(sum(float(s.get("sale_price") or 0) for s in sales), 2),
        "platform_commission": round(sum(float(s.get("platform_commission") or 0) for s in sales), 2),
        "seller_earning": round(sum(float(s.get("seller_earning") or 0) for s in sales), 2),
        "pending": sum(1 for s in sales if s.get("status") == "pending"),
        "completed": sum(1 for s in sales if s.get("status") == "completed"),
        "refunded": sum(1 for s in sales if s.get("status") == "refunded"),
        "canceled": sum(1 for s in sales if s.get("status") == "canceled"),
    }
    return {
        "profile": account_seller_public_payload(profile),
        "wallet": wallet,
        "settings": await get_seller_payout_settings(),
        "summary": summary,
        "sales": sales,
        "withdrawals": withdrawals,
        "movements": movements,
    }


async def sync_oxapay_withdrawal_status(withdrawal: dict, actor_id: int = 0) -> dict:
    status = str(withdrawal.get("provider_status") or "").lower()
    tx_hash = withdrawal.get("tx_hash") or withdrawal.get("txid") or withdrawal.get("tx_hashes") or ""
    track = withdrawal.get("track_id") or withdrawal.get("provider_track_id") or ""
    if status == "confirmed":
        return await db.decide_seller_withdrawal(int(withdrawal["id"]), "approved", actor_id, txid=str(tx_hash or track), note="Confirmado por OxaPay")
    if status in ("rejected", "canceled"):
        return await db.decide_seller_withdrawal(int(withdrawal["id"]), "rejected", actor_id, note=f"OxaPay {status}")
    return withdrawal


@app.get("/api/admin/oxapay-balance")
async def admin_oxapay_balance(currency: str = "USDT", user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    try:
        data = await oxapay.get_account_balance(currency or "USDT")
    except OxaPayError as e:
        raise HTTPException(502, f"OxaPay balance: {e.message}")
    return {"ok": True, "currency": currency or "USDT", "balance": data}


@app.get("/api/admin/seller-withdrawals")
async def admin_seller_withdrawals(status: str = "", user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    await db.release_due_seller_holds()
    return {
        "settings": await get_seller_payout_settings(),
        "items": await db.list_seller_withdrawals(status=status or None, limit=200),
    }


@app.post("/api/admin/seller-withdrawals/{withdrawal_id}/approve")
async def admin_approve_seller_withdrawal(withdrawal_id: int, req: SellerWithdrawalDecision, user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    if not (req.txid or "").strip():
        raise HTTPException(400, "Agrega el TXID/hash del pago USDT BEP20")
    try:
        withdrawal = await db.decide_seller_withdrawal(withdrawal_id, "approved", user["id"], txid=req.txid.strip(), note=req.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not withdrawal:
        raise HTTPException(404, "Retiro no encontrado")
    await audit_json(user["id"], "seller.withdrawal_approve", "seller_withdrawal", withdrawal_id, {"txid": req.txid, "amount": withdrawal.get("amount")})
    return {"ok": True, "withdrawal": withdrawal}


@app.post("/api/admin/seller-withdrawals/{withdrawal_id}/pay-oxapay")
async def admin_pay_seller_withdrawal_oxapay(withdrawal_id: int, req: SellerWithdrawalDecision, user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    withdrawal = await db.get_seller_withdrawal(withdrawal_id)
    if not withdrawal:
        raise HTTPException(404, "Retiro no encontrado")
    if withdrawal.get("status") != "pending":
        raise HTTPException(400, "Solo se puede pagar por OxaPay un retiro pendiente")
    callback_url = f"{config.WEBHOOK_HOST}{config.OXAPAY_PAYOUT_CALLBACK_PATH}" if config.WEBHOOK_HOST else None
    try:
        balance_data = await oxapay.get_account_balance("USDT")
        if isinstance(balance_data, dict):
            balance_value = balance_data.get("USDT", balance_data.get("usdt", balance_data.get("balance", 0)))
        else:
            balance_value = balance_data
        if float(balance_value or 0) + 1e-9 < float(withdrawal.get("net_amount") or 0):
            raise HTTPException(400, f"Saldo OxaPay insuficiente: {float(balance_value or 0):.2f} USDT")
        result = await oxapay.create_payout(
            amount=float(withdrawal.get("net_amount") or 0),
            address=withdrawal.get("wallet_address") or "",
            currency="USDT",
            network="BEP20",
            description=f"Seller withdrawal #{withdrawal_id}",
            callback_url=callback_url,
        )
    except HTTPException:
        raise
    except OxaPayError as e:
        raise HTTPException(502, f"OxaPay payout: {e.message}")
    track_id = str(result.get("track_id") or result.get("trackId") or result.get("id") or "")
    provider_status = str(result.get("status") or "processing")
    try:
        processing = await db.mark_seller_withdrawal_processing(withdrawal_id, track_id, provider_status, json.dumps(result, ensure_ascii=False))
    except ValueError as e:
        raise HTTPException(400, str(e))
    await audit_json(user["id"], "seller.withdrawal_oxapay", "seller_withdrawal", withdrawal_id, {"track_id": track_id, "status": provider_status})
    synced = await sync_oxapay_withdrawal_status({**processing, **result, "id": withdrawal_id, "provider_status": provider_status, "provider_track_id": track_id}, user["id"])
    return {"ok": True, "withdrawal": synced or processing, "oxapay": result}


@app.post("/api/admin/seller-withdrawals/{withdrawal_id}/sync-oxapay")
async def admin_sync_seller_withdrawal_oxapay(withdrawal_id: int, user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    withdrawal = await db.get_seller_withdrawal(withdrawal_id)
    if not withdrawal:
        raise HTTPException(404, "Retiro no encontrado")
    track_id = withdrawal.get("provider_track_id") or ""
    if not track_id:
        raise HTTPException(400, "Este retiro no tiene track_id de OxaPay")
    try:
        result = await oxapay.get_payout(track_id)
    except OxaPayError as e:
        raise HTTPException(502, f"OxaPay payout: {e.message}")
    merged = {**withdrawal, **result, "id": withdrawal_id, "provider_status": str(result.get("status") or withdrawal.get("provider_status") or "")}
    synced = await sync_oxapay_withdrawal_status(merged, user["id"])
    await audit_json(user["id"], "seller.withdrawal_oxapay_sync", "seller_withdrawal", withdrawal_id, {"track_id": track_id, "status": merged.get("provider_status")})
    return {"ok": True, "withdrawal": synced or merged, "oxapay": result}


@app.post("/api/admin/seller-withdrawals/{withdrawal_id}/reject")
async def admin_reject_seller_withdrawal(withdrawal_id: int, req: SellerWithdrawalDecision, user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    try:
        withdrawal = await db.decide_seller_withdrawal(withdrawal_id, "rejected", user["id"], note=req.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not withdrawal:
        raise HTTPException(404, "Retiro no encontrado")
    await audit_json(user["id"], "seller.withdrawal_reject", "seller_withdrawal", withdrawal_id, {"reason": req.note})
    return {"ok": True, "withdrawal": withdrawal}


@app.get("/api/admin/reseller-settings")
async def admin_reseller_settings(user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    return {
        "reseller_min_deposit": await get_reseller_min_deposit(),
        "reseller_markup": await settings.get_float("reseller_markup", 8.0),
        "retail_markup": await settings.get_float("retail_markup", 20.0),
    }


@app.post("/api/admin/reseller-settings")
async def admin_update_reseller_settings(req: ResellerSettingsUpdate, user: dict = Depends(get_current_user)):
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    amount = round(float(req.reseller_min_deposit), 2)
    if amount < 50:
        raise HTTPException(400, "El mínimo de revendedor no puede ser menor a 50 USDT")
    if amount > 100000:
        raise HTTPException(400, "Mínimo demasiado alto")
    await settings.set_value("reseller_min_deposit", f"{amount:.2f}", user["id"])
    await audit_json(user["id"], "reseller.settings_update", "settings", "reseller_min_deposit", {"reseller_min_deposit": amount})
    return {"ok": True, "reseller_min_deposit": amount}


@app.post("/api/admin/game-icons")
async def admin_update_icon(req: GameIconUpdate, user: dict = Depends(get_current_user)):
    """Actualizar icono/nombre/orden de un juego (solo admin)."""
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")

    import aiosqlite, time
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("""
            INSERT INTO game_icons (game_name, emoji, icon_url, display_name, sort_order, is_hidden, description, instructions, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(game_name) DO UPDATE SET
                emoji = excluded.emoji,
                icon_url = excluded.icon_url,
                display_name = excluded.display_name,
                sort_order = excluded.sort_order,
                is_hidden = excluded.is_hidden,
                description = excluded.description,
                instructions = excluded.instructions,
                updated_at = excluded.updated_at
        """, (
            req.game_name, req.emoji, req.icon_url, req.display_name,
            req.sort_order or 100, 1 if req.is_hidden else 0, req.description or "", req.instructions or "", time.time(),
        ))
        await conn.commit()
    invalidate_catalog_cache()
    return {"ok": True}


@app.get("/api/admin/game-pricing")
async def admin_game_pricing(user: dict = Depends(get_current_user)):
    """Lista juegos con margen global efectivo y override opcional por juego."""
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")

    retail_default = await settings.get_float("retail_markup", 20.0)
    reseller_default = await settings.get_float("reseller_markup", 8.0)
    prods = await db.get_cached_products()
    grouped = defaultdict(list)
    for p in prods:
        grouped[detect_game(p)].append(p)

    import aiosqlite
    overrides = {}
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT game_name, emoji, icon_url, display_name, sort_order, is_hidden, retail_markup, reseller_markup, description, instructions FROM game_icons"
        ) as c:
            for r in await c.fetchall():
                overrides[r["game_name"]] = dict(r)

    result = []
    for game_name, items in sorted(grouped.items(), key=lambda x: clean_name(x[0]).lower()):
        override = overrides.get(game_name, {})
        costs = [convert_product_cost_to_usdt(p) for p in items]
        result.append({
            "game_name": game_name,
            "display_name": override.get("display_name") or clean_name(game_name),
            "products_count": len(items),
            "min_cost": min(costs) if costs else 0,
            "max_cost": max(costs) if costs else 0,
            "icon_url": override.get("icon_url"),
            "sort_order": override.get("sort_order") or 100,
            "is_hidden": bool(override.get("is_hidden", 0)),
            "retail_markup": override.get("retail_markup"),
            "reseller_markup": override.get("reseller_markup"),
            "effective_retail_markup": override.get("retail_markup") if override.get("retail_markup") is not None else retail_default,
            "effective_reseller_markup": override.get("reseller_markup") if override.get("reseller_markup") is not None else reseller_default,
            **merge_product_info_sections(items[0] if items else {}, game_name, override),
        })
    return result


@app.post("/api/admin/game-pricing")
async def admin_update_game_pricing(req: GamePricingUpdate, user: dict = Depends(get_current_user)):
    """Guarda márgenes de ganancia por juego para productos BuffPin."""
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    if req.retail_markup is not None and not (0 <= req.retail_markup <= 500):
        raise HTTPException(400, "Ganancia cliente debe estar entre 0 y 500")
    if req.reseller_markup is not None and not (0 <= req.reseller_markup <= 500):
        raise HTTPException(400, "Ganancia revendedor debe estar entre 0 y 500")

    import aiosqlite, time
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("""
            INSERT INTO game_icons (game_name, retail_markup, reseller_markup, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(game_name) DO UPDATE SET
                retail_markup = excluded.retail_markup,
                reseller_markup = excluded.reseller_markup,
                updated_at = excluded.updated_at
        """, (req.game_name, req.retail_markup, req.reseller_markup, time.time()))
        await conn.commit()
    invalidate_catalog_cache()
    return {"ok": True}



@app.post("/api/admin/product-overrides/{product_id}/restore")
async def admin_restore_product_override(product_id: int, user: dict = Depends(get_current_user)):
    """Vuelve a mostrar un producto oculto por override sin borrar otros ajustes."""
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    p = await db.get_cached_product(product_id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    await db.set_product_override(product_id, is_hidden=0, admin_note="")
    invalidate_catalog_cache()
    await audit_json(user["id"], "product_override.restore", "product", product_id, {"product_name": p.get("goods_name", ""), "product_id": product_id})
    return {"ok": True, "product_id": product_id, "is_hidden": False}


@app.post("/api/admin/buffpin-refresh")
async def admin_refresh_buffpin_products(user: dict = Depends(get_current_user)):
    """Refresca el catálogo desde BuffPin y actualiza products_cache."""
    if user["id"] not in config.ADMIN_IDS:
        raise HTTPException(403, "Solo admin")
    try:
        items = await buffpin.get_all_products()
        await db.cache_products(items)
        invalidate_catalog_cache()
    except BuffPinError as e:
        raise HTTPException(502, f"BuffPin: {e.message}")
    await audit_json(user["id"], "buffpin.products_refresh", "products", "all", {"count": len(items)})
    return {"ok": True, "count": len(items)}


@app.get("/api/games/{game_name}/regions")
async def list_regions(game_name: str, user: dict = Depends(get_current_user)):
    if await settings.get_bool("maintenance_mode") and user["id"] not in config.ADMIN_IDS:
        raise HTTPException(503, "Mantenimiento en curso")
    return await build_regions_catalog(game_name)


@app.get("/api/games/{game_name}/regions/{region}/products")
async def list_products(game_name: str, region: str, user: dict = Depends(get_current_user)):
    if await settings.get_bool("maintenance_mode") and user["id"] not in config.ADMIN_IDS:
        raise HTTPException(503, "Mantenimiento en curso")
    role = await get_effective_pricing_role(user["id"])
    return await build_products_catalog(game_name, region, role)


@app.get("/api/products/{product_id}")
async def product_detail(product_id: int, region: str = None, user: dict = Depends(get_current_user)):
    p = await db.get_cached_product(product_id)
    if not p or p.get("is_hidden"):
        raise HTTPException(404, "Producto no disponible")

    role = await get_effective_pricing_role(user["id"])
    price = p["custom_price"] if p.get("custom_price") else (
        await calculate_product_price(p, role))["sell_price"]

    raw_cfg = p.get("platform_config", "") or "[]"
    try:
        cfg = json.loads(raw_cfg)
    except json.JSONDecodeError:
        cfg = []

    fields = []
    for f in cfg:
        if not isinstance(f, dict):
            continue
        is_select = f.get("selected") == 1
        values = f.get("values", [])
        # Si hay región preseleccionada y este field es un server select, omitir
        if is_select and region and region != "__standard__":
            if any(v.get("serverName") == region for v in values):
                continue
        fields.append({
            "name": f.get("name", "Campo"),
            "field_name": f.get("filedName") or f.get("name", ""),
            "tip": f.get("tip", ""),
            "is_select": is_select,
            "values": values,
        })

    game = detect_game(p)
    import aiosqlite
    info_override = {}
    try:
        async with aiosqlite.connect(config.DB_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute("SELECT description, instructions, icon_url FROM game_icons WHERE game_name=?", (game,)) as c:
                row = await c.fetchone()
                if row:
                    info_override = dict(row)
    except Exception:
        info_override = {}
    return {
        "id": p["id"],
        "name": clean_product_name(p, game),
        "raw_name": p.get("goods_name", ""),
        "game": game,
        "region": region,
        "price": float(price),
        "cost": convert_product_cost_to_usdt(p),
        "icon_url": info_override.get("icon_url"),
        **merge_product_info_sections(p, game, info_override),
        "fields": fields,
    }


# ════════════════════════════════════════════════════════════
#  AUTH WEB — endpoints para login fuera de Telegram
# ════════════════════════════════════════════════════════════

import sys
sys.path.insert(0, str(Path(__file__).parent))
try:
    import web_auth
    log.info("✅ web_auth importado correctamente")
except Exception as e:
    web_auth = None
    log.warning("⚠️ web_auth no disponible: %s — auth web deshabilitado", e)


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyEmailRequest(BaseModel):
    email: str
    code: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@app.post("/api/auth/register")
async def auth_register(req: RegisterRequest, request: Request):
    if not web_auth:
        raise HTTPException(503, "Auth web no disponible. Verifica que web_auth.py existe en webapp/api/")
    ok, msg, user_id = await web_auth.register_with_email(req.email, req.password, req.name)
    if not ok:
        raise HTTPException(400, msg)
    return {"ok": True, "message": msg, "user_id": user_id, "email_sent": True}


@app.post("/api/auth/login")
async def auth_login(req: LoginRequest, request: Request):
    if not web_auth:
        raise HTTPException(503, "Auth web no disponible")
    ok, msg, user = await web_auth.login_with_email(req.email, req.password)
    if not ok:
        raise HTTPException(401, msg)
    token = web_auth.generate_session_token()
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:200]
    await db.create_session(token, user["user_id"], ttl_days=30, ip=ip, user_agent=user_agent)
    return {
        "ok": True,
        "token": token,
        "user": {
            "id": user["user_id"],
            "email": user.get("email"),
            "name": user.get("first_name"),
            "email_verified": bool(user.get("email_verified")),
        },
    }


@app.post("/api/auth/logout")
async def auth_logout(authorization: str = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        await db.delete_session(authorization[7:].strip())
    return {"ok": True}


@app.post("/api/auth/verify-email")
async def auth_verify_email(req: VerifyEmailRequest):
    if not web_auth:
        raise HTTPException(503, "Auth web no disponible")
    ok, msg = await web_auth.verify_email(req.email, req.code)
    if not ok:
        raise HTTPException(400, msg)
    return {"ok": True, "message": msg}


@app.post("/api/auth/forgot-password")
async def auth_forgot_password(req: ForgotPasswordRequest):
    if not web_auth:
        raise HTTPException(503, "Auth web no disponible")
    ok, msg = await web_auth.request_password_reset(req.email)
    return {"ok": True, "message": msg}


@app.post("/api/auth/reset-password")
async def auth_reset_password(req: ResetPasswordRequest):
    if not web_auth:
        raise HTTPException(503, "Auth web no disponible")
    ok, msg = await web_auth.reset_password(req.email, req.code, req.new_password)
    if not ok:
        raise HTTPException(400, msg)
    return {"ok": True, "message": msg}


@app.get("/api/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    """Devuelve el usuario autenticado (vía initData o Bearer token)."""
    user_id = user["id"]
    full = await db.get_user(user_id)
    if not full:
        raise HTTPException(404, "Usuario no encontrado")
    return {
        "id": full["user_id"],
        "name": full.get("first_name"),
        "email": full.get("email"),
        "email_verified": bool(full.get("email_verified")),
        "auth_method": full.get("auth_method", "telegram"),
        "balance": float(full.get("balance", 0)),
        "role": full.get("role", "user"),
        "has_password": bool(full.get("password_hash")),
        "has_telegram": full["user_id"] > 0,  # IDs positivos = Telegram, negativos = web-only
    }


@app.post("/api/auth/link-telegram")
async def auth_link_telegram(user: dict = Depends(get_current_user)):
    """Genera un código que el usuario envía al bot de Telegram para vincular cuentas."""
    user_id = user["id"]
    full = await db.get_user(user_id)
    if not full:
        raise HTTPException(404, "Usuario no encontrado")

    if full["user_id"] > 0:
        return {"ok": True, "already_linked": True,
                "message": "Tu cuenta ya está vinculada con Telegram",
                "telegram_id": full["user_id"]}

    email = full.get("email", "")
    code = await db.create_email_code(email, "link_telegram", ttl_minutes=10, user_id=user_id)
    return {
        "ok": True,
        "code": code,
        "expires_minutes": 10,
        "message": f"Envía /vincular al bot de Telegram y luego envía el código: {code}",
    }


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None
    new_password: str


@app.post("/api/auth/change-password")
async def auth_change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Cambiar contraseña (autenticado)."""
    if not web_auth:
        raise HTTPException(503, "Auth web no disponible")
    if len(req.new_password) < 8:
        raise HTTPException(400, "Mínimo 8 caracteres")

    user_id = user["id"]
    full = await db.get_user(user_id)

    # Si ya tiene contraseña, verificar la actual
    if full and full.get("password_hash") and req.current_password:
        if not web_auth.verify_password(req.current_password, full["password_hash"]):
            raise HTTPException(400, "Contraseña actual incorrecta")

    pwd_hash = web_auth.hash_password(req.new_password)
    await db.set_user_password(user_id, pwd_hash)
    return {"ok": True, "message": "Contraseña actualizada"}



@app.post("/oxapay/payout-callback")
async def oxapay_payout_callback(request: Request):
    payload = await request.json()
    track_id = str(payload.get("track_id") or payload.get("trackId") or "")
    status = str(payload.get("status") or "").lower()
    if not track_id:
        raise HTTPException(400, "Callback payout sin track_id")
    withdrawals = await db.list_seller_withdrawals(limit=500)
    withdrawal = next((w for w in withdrawals if str(w.get("provider_track_id") or "") == track_id), None)
    if not withdrawal:
        raise HTTPException(404, "Retiro no encontrado")
    tx_hash = payload.get("tx_hash") or payload.get("txHash") or payload.get("txid") or ""
    merged = {**withdrawal, **payload, "id": withdrawal["id"], "provider_status": status, "provider_track_id": track_id, "tx_hash": tx_hash}
    synced = await sync_oxapay_withdrawal_status(merged, 0)
    await audit_json(0, "oxapay.payout_callback", "seller_withdrawal", withdrawal["id"], {"track_id": track_id, "status": status, "tx_hash": tx_hash})
    return {"ok": True, "withdrawal": synced or merged}


@app.post("/buffpin/callback")
async def buffpin_callback(request: Request):
    payload = await request.json()
    auth_sign = request.headers.get("AuthSign") or request.headers.get("authsign") or request.headers.get("Auth-Sign") or ""
    if auth_sign and not buffpin.verify_callback(payload, auth_sign):
        raise HTTPException(403, "Firma BuffPin inválida")

    merchant_oid = str(payload.get("merchantOrderId") or payload.get("merchant_order_id") or "")
    bp_oid = str(payload.get("orderId") or payload.get("buffpin_order_id") or "")
    status = payload.get("orderStatus", payload.get("status"))
    try:
        status = int(status)
    except Exception:
        status = None

    cards = []
    items = payload.get("orderItemsList") or payload.get("items") or []
    if items and isinstance(items, list):
        cards = items[0].get("orderCardsList", []) if isinstance(items[0], dict) else []
    provider_message = payload.get("errorMessage") or payload.get("message") or ""
    error_message = provider_message if status in (3, 4) else ""

    if not merchant_oid and not bp_oid:
        raise HTTPException(400, "Callback sin ID de orden")

    order = await db.get_order(merchant_oid) if merchant_oid else await db.get_order_by_buffpin_id(bp_oid)
    if not order:
        raise HTTPException(404, "Orden no encontrada")

    await db.update_order_status(
        merchant_order_id=merchant_oid or None,
        buffpin_order_id=None if merchant_oid else bp_oid,
        status=status,
        card_data=json.dumps(cards, ensure_ascii=False) if cards else None,
        error_message=error_message or None,
    )
    invalidate_catalog_cache()

    if status in (3, 4) and int(order.get("refund_status") or 0) == 0:
        await db.add_balance(order["user_id"], float(order.get("sell_price") or 0), "refund", order.get("merchant_order_id") or merchant_oid, "Auto refund BuffPin callback")
        await db.update_order_status(merchant_order_id=order.get("merchant_order_id"), refund_status=1)
        await db.void_auto_seller_sale_hold(order.get("merchant_order_id") or merchant_oid, "Auto refund BuffPin callback")
        await notify_admins(
            f"⚠️ <b>Recarga automática fallida</b>\nPedido: <code>{html.escape(str(order.get('merchant_order_id') or merchant_oid))}</code>\nUsuario: <code>{order.get('user_id')}</code>\nEstado BuffPin: <b>{status}</b>\nSe devolvió ${float(order.get('sell_price') or 0):.2f} USDT."
        )

    await audit_json(0, "buffpin.callback", "order", order.get("merchant_order_id") or merchant_oid, {"status": status, "buffpin_order_id": bp_oid})
    return {"ok": True}


@app.post("/api/order")
async def create_order(req: OrderRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]

    if await db.is_banned(user_id):
        raise HTTPException(403, "Cuenta suspendida")
    if await settings.get_bool("maintenance_mode") and user_id not in config.ADMIN_IDS:
        raise HTTPException(503, "Mantenimiento en curso")

    max_per = await settings.get_int("max_orders_per_hour", 20)
    if await db.count_user_orders_last_hour(user_id) >= max_per:
        raise HTTPException(429, f"Límite: {max_per} compras/hora")
    await prevent_duplicate_purchase(user_id, "buffpin", req.product_id, req.fields)

    p = await db.get_cached_product(req.product_id)
    if not p or p.get("is_hidden"):
        raise HTTPException(404, "Producto no disponible")

    role = await get_user_role(user_id)
    pricing_role = await get_effective_pricing_role(user_id)
    if p.get("custom_price"):
        price, markup_pct = p["custom_price"], 0.0
    else:
        pi = await calculate_product_price(p, pricing_role)
        price, markup_pct = pi["sell_price"], pi["markup_pct"]

    if await db.get_balance(user_id) < price:
        raise HTTPException(402, f"Saldo insuficiente")

    # Reconstruir rechargePlatformConfig según BuffPin docs
    try:
        cfg = json.loads(p.get("platform_config", "") or "[]")
    except json.JSONDecodeError:
        cfg = []

    filled = []
    region_auto = req.fields.get("__region__")

    for field_def in cfg:
        if not isinstance(field_def, dict):
            continue
        fc = dict(field_def)
        field_name = field_def.get("filedName") or field_def.get("name", "")
        is_select = field_def.get("selected") == 1
        values = field_def.get("values", [])
        value_raw = req.fields.get(field_name) or req.fields.get(field_def.get("name", ""))

        if is_select and values:
            selected = None
            if value_raw:
                for v in values:
                    if str(v.get("serverId")) == str(value_raw) or str(v.get("serverName")) == str(value_raw):
                        selected = v
                        break
            if not selected and region_auto and region_auto != "__standard__":
                for v in values:
                    if v.get("serverName") == region_auto:
                        selected = v
                        break
            if not selected:
                raise HTTPException(400, f"Campo '{field_def.get('name')}' requerido")
            fc["value"] = selected
        else:
            if not value_raw:
                raise HTTPException(400, f"Campo '{field_def.get('name')}' requerido")
            fc["value"] = str(value_raw)

        filled.append(fc)

    rcfg_str = json.dumps(filled, ensure_ascii=False, default=str)

    # No bloquear compras por getAccountInfo: BuffPin requiere un type por juego y no
    # todos los productos lo exponen en el catálogo. Validar con type=1 provoca falsos
    # errores de ID en juegos como Delta Force/Blood Strike. La orden final sigue siendo
    # validada por BuffPin en submit_order; si falla, se reembolsa y se guarda el error real.
    player_id, server_id = None, None
    for f in filled:
        fn = (f.get("filedName") or "").lower()
        if "playerid" in fn:
            player_id = str(f.get("value", ""))
        elif fn == "server":
            v = f.get("value", {})
            if isinstance(v, dict):
                server_id = str(v.get("serverId", ""))
    if player_id and len(player_id) > 3:
        try:
            info = await buffpin.validate_user(player_id, server_id=server_id)
            if info.get("exist") == 0:
                log.info("BuffPin getAccountInfo no confirma ID %s para product_id=%s; se continua con submit_order", player_id, req.product_id)
        except Exception as e:
            log.debug("BuffPin getAccountInfo omitido para product_id=%s: %s", req.product_id, e)

    attributed_seller_id = await get_valid_recharge_seller_id(req.seller_id, user_id)

    if not await db.spend_balance(user_id, price):
        raise HTTPException(402, "Saldo insuficiente")

    merchant_oid = await db.create_order(
        user_id=user_id, user_role=pricing_role, product_id=req.product_id,
        product_name=p.get("goods_name", ""), quantity=1,
        cost_price=convert_product_cost_to_usdt(p), sell_price=price, markup_pct=markup_pct,
        recharge_config=rcfg_str,
        seller_id=attributed_seller_id,
        sales_channel="seller_link" if attributed_seller_id else "direct",
    )

    try:
        notify_url = (f"{config.WEBHOOK_HOST}{config.BUFFPIN_CALLBACK_PATH}"
                      if config.WEBHOOK_HOST else None)
        result = await buffpin.submit_order(
            merchant_order_id=merchant_oid, product_id=req.product_id, qty=1,
            recharge_config=rcfg_str, notify_url=notify_url,
        )
        bp_oid = str(result.get("orderId", ""))
        status = result.get("orderStatus", 0)
        await db.update_order_buffpin(merchant_oid, bp_oid, status)
        invalidate_catalog_cache()

        items = result.get("orderItemsList", [])
        if items:
            cards = items[0].get("orderCardsList", [])
            if cards:
                await db.update_order_status(
                    merchant_order_id=merchant_oid,
                    card_data=json.dumps(cards, ensure_ascii=False),
                    status=items[0].get("orderStatus", status))

        seller_hold = None
        if attributed_seller_id and status != 4:
            payout_settings = await get_seller_payout_settings()
            seller_hold = await db.create_auto_seller_sale_hold(
                merchant_oid,
                attributed_seller_id,
                default_commission_pct=50.0,
                hold_days=payout_settings["seller_hold_days_auto"],
                new_seller_days=payout_settings["seller_new_days"],
                new_seller_hold_days=payout_settings["seller_new_hold_days"],
            )
            await audit_json(0, "seller.recharge_sale_hold", "order", merchant_oid, seller_hold or {"seller_id": attributed_seller_id})

        return {
            "ok": True, "order_id": merchant_oid, "status": status,
            "status_text": {0: "pending", 1: "processing", 2: "completed",
                            3: "partial", 4: "failed"}.get(status, "unknown"),
            "message": "Pedido enviado correctamente",
            "product_id": req.product_id,
            "product": p.get("goods_name", ""),
            "price": float(price),
            "created_at": int(time.time()),
            "recharge_details": parse_recharge_details(rcfg_str),
            "seller_id": attributed_seller_id,
            "seller_hold": seller_hold,
        }
    except BuffPinError as e:
        await db.add_balance(user_id, price, "refund", merchant_oid, f"Refund: {e.message}")
        await db.update_order_status(merchant_order_id=merchant_oid, status=4, error_message=str(e))
        await db.void_auto_seller_sale_hold(merchant_oid, f"Error BuffPin: {e.message}")
        provider_message = str(e.message or "")
        is_unavailable = (
            e.code == 6024
            or e.code == 6019
            or "out of stock" in provider_message.lower()
            or "exchange rate configuration" in provider_message.lower()
            or "下架" in provider_message
            or "汇率配置缺失" in provider_message
            or "stock" in provider_message.lower()
        )
        if is_unavailable:
            await db.set_product_override(
                req.product_id,
                is_hidden=1,
                admin_note=f"Ocultado automaticamente por BuffPin: [{e.code}] {provider_message}",
            )
            log.warning(
                "Producto BuffPin ocultado por no disponibilidad product_id=%s order=%s code=%s error=%s",
                req.product_id,
                merchant_oid,
                e.code,
                provider_message,
            )
            if e.code == 6019 or "exchange rate configuration" in provider_message.lower() or "汇率配置缺失" in provider_message:
                raise HTTPException(
                    409,
                    "Este producto no se puede vender ahora porque el proveedor no tiene configurada la tasa de cambio. "
                    "El dinero fue devuelto a tu saldo. Intenta con otra denominacion o espera a que BuffPin lo corrija.",
                )
            raise HTTPException(
                409,
                "Este producto no esta disponible temporalmente con el proveedor. "
                "El dinero fue devuelto a tu saldo. Intenta con otra denominacion.",
            )
        log.warning("Error BuffPin en orden %s product_id=%s: [%s] %s", merchant_oid, req.product_id, e.code, provider_message)
        raise HTTPException(502, f"Error BuffPin: {provider_message}")


@app.get("/api/orders")
async def my_orders(user: dict = Depends(get_current_user)):
    orders = await db.get_user_orders(user["id"], 10)
    reviews = await db.get_reviews_for_user(user["id"])
    STATUS = {0: "pending", 1: "processing", 2: "completed", 3: "partial", 4: "failed"}

    product_map = {}
    game_names = set()
    for o in orders:
        pid = int(o.get("product_id") or 0)
        if pid and pid not in product_map:
            try:
                product_map[pid] = await db.get_cached_product(pid)
            except Exception:
                product_map[pid] = None
        product_ref = product_map.get(pid) or o.get("product_name") or ""
        game_names.add(detect_game(product_ref))

    icon_map = {}
    seller_map = {}
    seller_ids = sorted({int(o.get("seller_id") or 0) for o in orders if int(o.get("seller_id") or 0)})
    try:
        import aiosqlite
        async with aiosqlite.connect(config.DB_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            if game_names:
                placeholders = ",".join("?" for _ in game_names)
                async with conn.execute(f"SELECT game_name, icon_url FROM game_icons WHERE game_name IN ({placeholders})", tuple(game_names)) as cur:
                    for row in await cur.fetchall():
                        icon_map[row["game_name"]] = row["icon_url"]
            if seller_ids:
                placeholders = ",".join("?" for _ in seller_ids)
                async with conn.execute(f"""
                    SELECT u.user_id, u.first_name, u.username, u.email,
                           asp.store_name, asp.store_slug, asp.store_image
                    FROM users u
                    LEFT JOIN account_seller_profiles asp ON asp.user_id = u.user_id
                    WHERE u.user_id IN ({placeholders})
                """, tuple(seller_ids)) as cur:
                    for row in await cur.fetchall():
                        seller_map[int(row["user_id"])] = dict(row)
    except Exception as e:
        log.warning("No se pudieron cargar iconos/vendedores de pedidos: %s", e)

    result = []
    for o in orders:
        pid = int(o.get("product_id") or 0)
        product_ref = product_map.get(pid) or o.get("product_name") or ""
        game_name = detect_game(product_ref)
        seller_id = int(o.get("seller_id") or 0)
        seller = seller_map.get(seller_id, {})
        result.append({
            "id": o["merchant_order_id"],
            "product_id": o.get("product_id"),
            "product": o.get("product_name", ""),
            "price": float(o.get("sell_price", 0)),
            "status": STATUS.get(o.get("order_status", 0), "unknown"),
            "created_at": o.get("created_at", 0),
            "updated_at": o.get("updated_at", 0),
            "recharge_details": parse_recharge_details(o.get("recharge_config")),
            "cards": json.loads(o["card_data"]) if o.get("card_data") else [],
            "error": o.get("error_message") if int(o.get("order_status") or 0) in (3, 4) else None,
            "review": reviews.get(f"auto:{o['merchant_order_id']}"),
            "icon_url": icon_map.get(game_name),
            "seller_id": seller_id or None,
            "seller_name": seller.get("first_name"),
            "seller_username": seller.get("username"),
            "seller_store_name": seller.get("store_name") or ("Francho Shop" if not seller_id else None),
            "seller_store_slug": seller.get("store_slug"),
            "seller_store_image": seller.get("store_image"),
        })
    return result



@app.post("/api/referrals/apply")
async def apply_referral_endpoint(req: ReferralApplyRequest, user: dict = Depends(get_current_user)):
    await db.upsert_user(user["id"], user.get("username"), user.get("first_name"))
    ok = await db.apply_referral(req.referrer_id, user["id"], await settings.get_float("referral_commission", 5.0))
    return {"ok": bool(ok)}


@app.post("/api/orders/{order_id}/review")
async def review_auto_order(order_id: str, req: OrderReviewRequest, user: dict = Depends(get_current_user)):
    order = await db.get_order(order_id)
    if not order or int(order.get("user_id")) != int(user["id"]):
        raise HTTPException(404, "Pedido no encontrado")
    if int(order.get("order_status") or 0) != 2:
        raise HTTPException(400, "Solo puedes valorar compras completadas")
    await db.add_order_review("auto", order_id, user["id"], req.rating, req.comment[:500])
    invalidate_catalog_cache()
    return {"ok": True}


@app.post("/api/manual-orders/{order_id}/review")
async def review_manual_order(order_id: int, req: OrderReviewRequest, user: dict = Depends(get_current_user)):
    order = await db.get_manual_order_by_id(order_id)
    if not order or int(order.get("user_id")) != int(user["id"]):
        raise HTTPException(404, "Pedido no encontrado")
    if order.get("status") != "completed":
        raise HTTPException(400, "Solo puedes valorar compras completadas")
    await db.add_order_review("manual", str(order_id), user["id"], req.rating, req.comment[:500])
    invalidate_catalog_cache()
    return {"ok": True}


# ════════════════════════════════════════
#  PERFIL — preparado para Telegram + futura auth web
# ════════════════════════════════════════

@app.get("/api/profile")
async def profile(user: dict = Depends(get_current_user)):
    """
    Perfil completo del usuario con stats.
    Hoy: solo autenticación Telegram WebApp.
    Futuro: añadir email/password para acceso web sin Telegram.
    """
    user_id = user["id"]
    u = await db.get_user(user_id)
    if not u:
        await db.upsert_user(user_id, user.get("username"), user.get("first_name"))
        u = await db.get_user(user_id)

    # Stats de órdenes
    all_orders = await db.get_user_orders(user_id, limit=10000)
    completed = sum(1 for o in all_orders if o.get("order_status") == 2)
    failed = sum(1 for o in all_orders if o.get("order_status") in (3, 4))
    total_spent = sum(o.get("sell_price", 0) for o in all_orders if o.get("order_status") == 2)

    # Stats de depósitos
    deposits = await db.get_user_deposits(user_id, limit=10000)
    paid_deposits = [d for d in deposits if d.get("status") == "paid"]
    total_deposited = sum(d.get("amount_usd", 0) for d in paid_deposits)

    role = await get_user_role(user_id)
    effective_role = await get_effective_pricing_role(user_id)
    reseller_min = await get_reseller_min_deposit()
    reseller_remaining = max(0.0, round(reseller_min - float(total_deposited or 0), 2))
    role_label = {"user": "🛒 Cliente", "reseller": "💼 Revendedor", "seller": "🏷️ Vendedor", "admin": "👑 Admin"}.get(role, role)

    member_since = u.get("created_at", 0)
    last_seen = u.get("last_seen", 0)

    referral_stats = await db.get_referral_stats(user_id)

    return {
        # Identidad
        "user_id": user_id,
        "username": u.get("username"),
        "name": u.get("first_name") or user.get("first_name", "Usuario"),
        "telegram_id": user_id,
        "auth_method": u.get("auth_method", "telegram"),

        # Email/web
        "email": u.get("email"),
        "email_verified": bool(u.get("email_verified")),
        "has_password": bool(u.get("password_hash")),
        "can_login_web": bool(u.get("email") and u.get("password_hash")),

        # Saldo y rol
        "balance": float(u.get("balance", 0)),
        "role": role,
        "role_label": role_label,
        "pricing_role": effective_role,
        "referral_code": str(user_id),
        "referral_stats": referral_stats,
        "reseller_min_deposit": reseller_min,
        "reseller_discount_active": role == "reseller" and effective_role == "reseller",
        "reseller_deposit_remaining": reseller_remaining,

        # Stats
        "stats": {
            "total_orders": len(all_orders),
            "completed_orders": completed,
            "failed_orders": failed,
            "total_spent": float(total_spent),
            "total_deposited": float(total_deposited),
            "deposits_count": len(paid_deposits),
        },

        # Fechas
        "member_since": member_since,
        "last_seen": last_seen,

        # Estado
        "is_banned": bool(u.get("is_banned", 0)),
    }


# ════════════════════════════════════════════════════════════
#  ADMIN — Clientes y saldo
# ════════════════════════════════════════════════════════════

class AdminBalanceAdjust(BaseModel):
    user_id: int
    amount: float
    note: str = ""


class AdminRoleUpdate(BaseModel):
    user_id: int
    role: str
    store_name: str | None = None
    store_slug: str | None = None
    max_active_products: int | None = 10
    commission_percent: float | None = 10


class AdminBanUpdate(BaseModel):
    user_id: int
    is_banned: bool
    reason: str = ""


class AdminUserNoteUpdate(BaseModel):
    user_id: int
    internal_note: str = ""
    risk_tag: str = ""


@app.get("/api/admin/users")
async def admin_search_users(q: str = "", user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    users = await db.search_users(q, limit=30) if q.strip() else []
    result = []
    for u in users:
        result.append({
            "user_id": u.get("user_id"),
            "username": u.get("username"),
            "name": u.get("first_name") or u.get("email") or "Usuario",
            "email": u.get("email"),
            "role": await get_user_role(u.get("user_id")),
            "balance": float(u.get("balance", 0)),
            "total_spent": float(u.get("total_spent", 0)),
            "total_deposit": float(u.get("total_deposit", 0)),
            "is_banned": bool(u.get("is_banned", 0)),
            "created_at": u.get("created_at", 0),
            "last_seen": u.get("last_seen", 0),
        })
    return result


@app.post("/api/admin/users/balance")
async def admin_adjust_user_balance(req: AdminBalanceAdjust, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    target = await db.get_user(req.user_id)
    if not target:
        raise HTTPException(404, "Cliente no encontrado")
    amount = round(float(req.amount), 2)
    if amount == 0:
        raise HTTPException(400, "El monto no puede ser 0")
    await db.adjust_balance_admin(req.user_id, amount, user["id"], req.note or "Ajuste manual desde panel")
    updated = await db.get_user(req.user_id)
    await audit_json(user["id"], "user.balance_adjust", "user", req.user_id, {"amount": amount, "note": req.note})
    return {"ok": True, "user_id": req.user_id, "balance": float(updated.get("balance", 0))}


@app.get("/api/admin/users/{target_user_id}")
async def admin_user_detail(target_user_id: int, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    target = await db.get_user(target_user_id)
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    regular_orders = await db.get_user_orders(target_user_id, limit=100)
    manual_orders = await db.get_manual_orders(user_id=target_user_id, limit=100)
    deposits = await db.get_user_deposits(target_user_id, limit=100)
    balance_log = await db.get_balance_history(target_user_id, limit=100)
    account_seller_profile = await db.get_account_seller_profile(user_id=target_user_id, active_only=False)
    target_role = await get_user_role(target_user_id)
    return {
        "user": {
            **target,
            "role": "account_seller" if account_seller_profile and account_seller_profile.get("status") == "active" else target_role,
            "effective_role": target_role,
            "is_banned": bool(target.get("is_banned", 0)),
            "account_seller_profile": account_seller_profile,
        },
        "orders": regular_orders,
        "manual_orders": manual_orders,
        "deposits": deposits,
        "balance_log": balance_log,
    }


@app.post("/api/admin/users/role")
async def admin_update_user_role(req: AdminRoleUpdate, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    allowed = {"user", "reseller", "seller", "account_seller", "admin"}
    if req.role not in allowed:
        raise HTTPException(400, "Rol inválido")
    if req.user_id in config.ADMIN_IDS and req.role != "admin":
        raise HTTPException(400, "No puedes quitar rol admin a un ADMIN_ID de config")
    target = await db.get_user(req.user_id)
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    effective_role = "seller" if req.role == "account_seller" else req.role
    await db.set_user_role(req.user_id, effective_role)
    if req.role in ("seller", "account_seller"):
        import aiosqlite
        max_products = max(0, min(int(req.max_active_products or 10), 10000)) if req.role == "account_seller" else 10
        commission = max(0, min(float(req.commission_percent or 10), 100)) if req.role == "account_seller" else 0
        can_recharges = 0 if req.role == "account_seller" else 0
        notes = "Vendedor aprobado solo para cuentas de juegos" if req.role == "account_seller" else ""
        async with aiosqlite.connect(config.DB_PATH) as conn:
            await conn.execute("""
                INSERT INTO internal_sellers (user_id, max_products, is_active, can_create_products, can_sell_recharges, commission_pct, notes, created_by, updated_at)
                VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    max_products=excluded.max_products,
                    is_active=1,
                    can_create_products=1,
                    can_sell_recharges=excluded.can_sell_recharges,
                    commission_pct=excluded.commission_pct,
                    notes=excluded.notes,
                    updated_at=excluded.updated_at
            """, (req.user_id, max_products, can_recharges, commission, notes, user["id"], time.time()))
            await conn.commit()
        await db.ensure_seller_wallet(req.user_id)
    if req.role == "account_seller":
        fallback_name = target.get("first_name") or target.get("username") or target.get("email") or f"Tienda {req.user_id}"
        store_name = (req.store_name or fallback_name).strip()
        store_slug = make_store_slug(req.store_slug or store_name or str(req.user_id))
        profile = await db.upsert_account_seller_profile(req.user_id, {
            "store_name": store_name,
            "store_slug": store_slug,
            "store_description": "Tienda verificada en Francho Shop para cuentas de juegos.",
            "status": "active",
            "max_active_products": int(req.max_active_products or 10),
            "commission_percent": float(req.commission_percent or 10),
            "allow_external_links": True,
        }, created_by=user["id"])
        await audit_json(user["id"], "account_seller.create_from_user_panel", "user", req.user_id, {"store_slug": profile.get("store_slug"), "max_active_products": profile.get("max_active_products"), "commission_percent": profile.get("commission_percent")})
    elif req.role != "seller":
        profile = await db.get_account_seller_profile(user_id=req.user_id, active_only=False)
        if profile and req.role in {"user", "reseller"}:
            data = build_account_seller_data({"status": "disabled"}, current=profile, target_user_id=req.user_id)
            await db.upsert_account_seller_profile(req.user_id, data, created_by=profile.get("created_by"))
    await audit_json(user["id"], "user.role_update", "user", req.user_id, {"role": req.role, "effective_role": effective_role})
    return {"ok": True, "message": "Rol actualizado", "role": effective_role, "account_seller": req.role == "account_seller"}


@app.post("/api/admin/users/ban")
async def admin_update_user_ban(req: AdminBanUpdate, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    if req.user_id in config.ADMIN_IDS:
        raise HTTPException(400, "No puedes suspender un ADMIN_ID de config")
    if req.is_banned:
        await db.ban_user(req.user_id, req.reason or "Suspendido desde panel")
    else:
        await db.unban_user(req.user_id)
    await audit_json(user["id"], "user.ban_update", "user", req.user_id, {"is_banned": req.is_banned, "reason": req.reason})
    return {"ok": True, "message": "Estado actualizado"}


@app.post("/api/admin/users/note")
async def admin_update_user_note(req: AdminUserNoteUpdate, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("UPDATE users SET internal_note=?, risk_tag=? WHERE user_id=?", (req.internal_note, req.risk_tag, req.user_id))
        await conn.commit()
    await audit_json(user["id"], "user.note_update", "user", req.user_id, {"risk_tag": req.risk_tag})
    return {"ok": True, "message": "Nota actualizada"}


# ════════════════════════════════════════════════════════════
#  VENDEDORES INTERNOS — productos del mismo sistema, auditables
# ════════════════════════════════════════════════════════════

class SellerGrantRequest(BaseModel):
    user_id: int
    max_products: int = 10
    commission_pct: float = 0
    can_sell_recharges: bool = False
    recharge_commission_pct: float = 50
    notes: str = ""
    store_name: str = ""


class SellerUpdateRequest(BaseModel):
    max_products: int | None = None
    is_active: bool | None = None
    can_create_products: bool | None = None
    can_sell_recharges: bool | None = None
    commission_pct: float | None = None
    recharge_commission_pct: float | None = None
    notes: str | None = None


class AccountSellerProfileRequest(BaseModel):
    user_id: int | None = None
    store_name: str
    store_slug: str | None = None
    store_description: str = ""
    store_image: str = ""
    banner_image: str = ""
    whatsapp_url: str = ""
    social_url_1: str = ""
    social_url_2: str = ""
    allow_external_links: bool = True
    status: str = "active"
    max_active_products: int = 10
    commission_percent: float = 10


class AccountSellerProfileUpdate(BaseModel):
    store_name: str | None = None
    store_slug: str | None = None
    store_description: str | None = None
    store_image: str | None = None
    banner_image: str | None = None
    whatsapp_url: str | None = None
    social_url_1: str | None = None
    social_url_2: str | None = None
    allow_external_links: bool | None = None
    status: str | None = None
    max_active_products: int | None = None
    commission_percent: float | None = None


class AdminRoleUpdate(BaseModel):
    user_id: int
    role: str


class AdminBanUpdate(BaseModel):
    user_id: int
    is_banned: bool
    reason: str = ""


class AdminUserNoteUpdate(BaseModel):
    user_id: int
    internal_note: str = ""
    risk_tag: str = ""


async def seller_stats(user_id: int) -> dict:
    products = await db.get_manual_products(active_only=False, created_by=user_id)
    orders = await db.get_manual_orders(seller_id=user_id, limit=10000)
    completed_orders = [o for o in orders if o.get("status") == "completed"]
    pending_orders = [o for o in orders if o.get("status") == "pending"]
    recharge = await seller_recharge_stats(user_id)
    return {
        "products_count": len(products),
        "active_products": sum(1 for p in products if p.get("is_active")),
        "inactive_products": sum(1 for p in products if not p.get("is_active")),
        "total_orders": len(orders),
        "pending_orders": len(pending_orders),
        "completed_orders": len(completed_orders),
        "completed_revenue": float(sum(float(o.get("price") or 0) for o in completed_orders)),
        "recharge_orders": recharge["summary"]["orders"],
        "recharge_completed": recharge["summary"]["completed"],
        "recharge_revenue": recharge["summary"]["revenue"],
        "recharge_profit": recharge["summary"]["profit"],
        "recharge_earned": recharge["summary"]["earned"],
    }


async def seller_recharge_stats(seller_id: int) -> dict:
    import aiosqlite
    now = time.time()
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("""
            SELECT COUNT(*) AS orders,
                   SUM(CASE WHEN order_status=2 THEN 1 ELSE 0 END) AS completed,
                   COALESCE(SUM(sell_price), 0) AS revenue,
                   COALESCE(SUM(platform_fee), 0) AS profit
            FROM orders
            WHERE seller_id=?
        """, (seller_id,)) as c:
            summary = dict(await c.fetchone())
        async with conn.execute("""
            SELECT COALESCE(SUM(amount), 0) AS earned
            FROM seller_wallet_movements
            WHERE seller_id=? AND movement_type='auto_sale_hold' AND status IN ('held','available')
        """, (seller_id,)) as c:
            earned_row = dict(await c.fetchone())
        async with conn.execute("""
            SELECT merchant_order_id, product_name, sell_price, platform_fee, order_status, created_at
            FROM orders
            WHERE seller_id=?
            ORDER BY created_at DESC
            LIMIT 30
        """, (seller_id,)) as c:
            recent = [dict(r) for r in await c.fetchall()]
        async with conn.execute("""
            SELECT COALESCE(SUM(sell_price), 0) AS revenue, COUNT(*) AS orders
            FROM orders
            WHERE seller_id=? AND created_at>?
        """, (seller_id, now - 86400)) as c:
            today = dict(await c.fetchone())
    summary = {k: float(v or 0) if k in ("revenue", "profit") else int(v or 0) for k, v in summary.items()}
    summary["earned"] = float((earned_row or {}).get("earned") or 0)
    today = {"revenue": float(today.get("revenue") or 0), "orders": int(today.get("orders") or 0)}
    return {"summary": summary, "today": today, "recent": recent}


@app.get("/api/seller/recharge-dashboard")
async def seller_recharge_dashboard(user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role not in ("admin", "seller"):
        raise HTTPException(403, "Solo vendedores autorizados")
    await db.release_due_seller_holds(user["id"])
    seller = await get_seller_permissions(user["id"])
    stats = await seller_recharge_stats(user["id"])
    wallet = await db.get_seller_wallet(user["id"])
    return {
        "enabled": bool(seller.get("can_sell_recharges")),
        "seller_id": user["id"],
        "commission_pct": float(seller.get("recharge_commission_pct") or 0),
        "link_param": f"seller={user['id']}",
        "wallet": wallet,
        **stats,
    }


@app.get("/api/admin/sellers")
async def admin_list_sellers(user: dict = Depends(get_current_user)):
    await db.release_due_seller_holds()
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("""
            SELECT s.*, u.username, u.first_name, u.email, u.role,
                   asp.store_name, asp.store_slug, asp.store_image, asp.banner_image, asp.seller_type, asp.status AS store_status
            FROM internal_sellers s
            LEFT JOIN users u ON u.user_id = s.user_id
            LEFT JOIN account_seller_profiles asp ON asp.user_id = s.user_id
            ORDER BY s.updated_at DESC
        """) as c:
            rows = [dict(r) for r in await c.fetchall()]
    wallets = await db.get_all_seller_wallets()
    for row in rows:
        row.update(await seller_stats(row["user_id"]))
        wallet = wallets.get(int(row["user_id"]), {})
        row["wallet"] = wallet
        row["held_balance"] = float(wallet.get("held_balance") or 0)
        row["available_balance"] = float(wallet.get("available_balance") or 0)
        row["withdrawn_balance"] = float(wallet.get("withdrawn_balance") or 0)
        row["is_active"] = bool(row.get("is_active"))
    return rows


@app.post("/api/admin/sellers")
async def admin_add_seller(req: SellerGrantRequest, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    target = await db.get_user(req.user_id)
    if not target:
        raise HTTPException(404, "Usuario no encontrado. Primero debe entrar al bot o registrarse.")
    max_products = max(0, min(int(req.max_products), 10000))
    commission_pct = max(0, min(float(req.commission_pct or 0), 100))
    recharge_commission_pct = max(0, min(float(req.recharge_commission_pct or 0), 100))
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("""
            INSERT INTO internal_sellers (user_id, max_products, is_active, can_create_products, can_sell_recharges, commission_pct, recharge_commission_pct, notes, created_by, updated_at)
            VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                max_products=excluded.max_products,
                is_active=1,
                can_create_products=1,
                can_sell_recharges=excluded.can_sell_recharges,
                commission_pct=excluded.commission_pct,
                recharge_commission_pct=excluded.recharge_commission_pct,
                notes=excluded.notes,
                updated_at=excluded.updated_at
        """, (req.user_id, max_products, 1 if req.can_sell_recharges else 0, commission_pct, recharge_commission_pct, req.notes or "", user["id"], time.time()))
        await conn.commit()
    await db.set_user_role(req.user_id, "seller")
    await db.ensure_seller_wallet(req.user_id)
    store_name = (req.store_name or target.get("first_name") or target.get("username") or target.get("email") or f"Tienda {req.user_id}").strip()
    profile = await db.upsert_account_seller_profile(req.user_id, {
        "store_name": store_name,
        "store_slug": make_store_slug(store_name),
        "store_description": "Productos publicados por vendedor verificado dentro de Francho Shop.",
        "status": "active",
        "max_active_products": max_products,
        "commission_percent": commission_pct,
        "seller_type": "general",
    }, created_by=user["id"])
    await audit_json(user["id"], "seller.grant", "user", req.user_id, {"max_products": max_products, "commission_pct": commission_pct, "can_sell_recharges": bool(req.can_sell_recharges), "recharge_commission_pct": recharge_commission_pct, "wallet": "USDT_BEP20", "store_slug": profile.get("store_slug")})
    return {"ok": True, "message": "Vendedor autorizado", "user_id": req.user_id, "max_products": max_products, "store": profile}


@app.get("/api/admin/sellers/{seller_id}")
async def admin_seller_detail(seller_id: int, user: dict = Depends(get_current_user)):
    await db.release_due_seller_holds(seller_id)
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("""
            SELECT s.*, u.username, u.first_name, u.email, u.role,
                   asp.store_name, asp.store_slug, asp.store_description, asp.store_image, asp.banner_image,
                   asp.whatsapp_url, asp.social_url_1, asp.social_url_2, asp.allow_external_links,
                   asp.status AS store_status, asp.seller_type, asp.max_active_products, asp.commission_percent
            FROM internal_sellers s
            LEFT JOIN users u ON u.user_id = s.user_id
            LEFT JOIN account_seller_profiles asp ON asp.user_id = s.user_id
            WHERE s.user_id=?
        """, (seller_id,)) as c:
            seller = await c.fetchone()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")
    products = await db.get_manual_products(active_only=False, created_by=seller_id)
    orders = await db.get_manual_orders(seller_id=seller_id, limit=200)
    audits = [a for a in await db.get_recent_audit(limit=200) if str(a.get("admin_id")) == str(seller_id) or str(a.get("target_id")) == str(seller_id)]
    data = dict(seller)
    data["is_active"] = bool(data.get("is_active"))
    data["can_create_products"] = bool(data.get("can_create_products", 1))
    data.update(await seller_stats(seller_id))
    wallet = await db.get_seller_wallet(seller_id)
    data["wallet"] = wallet
    data["held_balance"] = float(wallet.get("held_balance") or 0)
    data["available_balance"] = float(wallet.get("available_balance") or 0)
    data["withdrawn_balance"] = float(wallet.get("withdrawn_balance") or 0)
    data["store_profile"] = await db.get_account_seller_profile(user_id=seller_id, active_only=False)
    return {"seller": data, "wallet": wallet, "products": products, "orders": orders, "audit": audits[:50]}


@app.put("/api/admin/sellers/{seller_id}")
async def admin_update_seller(seller_id: int, req: SellerUpdateRequest, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    fields = []
    values = []
    if req.max_products is not None:
        fields.append("max_products=?")
        values.append(max(0, min(int(req.max_products), 10000)))
    if req.is_active is not None:
        fields.append("is_active=?")
        values.append(1 if req.is_active else 0)
    if req.can_create_products is not None:
        fields.append("can_create_products=?")
        values.append(1 if req.can_create_products else 0)
    if req.can_sell_recharges is not None:
        fields.append("can_sell_recharges=?")
        values.append(1 if req.can_sell_recharges else 0)
    if req.commission_pct is not None:
        fields.append("commission_pct=?")
        values.append(max(0, min(float(req.commission_pct), 100)))
    if req.recharge_commission_pct is not None:
        fields.append("recharge_commission_pct=?")
        values.append(max(0, min(float(req.recharge_commission_pct), 100)))
    if req.notes is not None:
        fields.append("notes=?")
        values.append(req.notes)
    if not fields:
        return {"ok": True, "message": "Sin cambios"}
    fields.append("updated_at=?")
    values.append(time.time())
    values.append(seller_id)
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute(f"UPDATE internal_sellers SET {', '.join(fields)} WHERE user_id=?", values)
        await conn.commit()
    if req.is_active is not None:
        current_profile = await db.get_account_seller_profile(user_id=seller_id, active_only=False)
        if current_profile:
            profile_data = dict(current_profile)
            profile_data["status"] = "active" if req.is_active else "suspended"
            profile_data["seller_type"] = current_profile.get("seller_type") or "general"
            await db.upsert_account_seller_profile(seller_id, profile_data, created_by=current_profile.get("created_by"))
    if req.is_active is not None and seller_id not in config.ADMIN_IDS:
        await db.set_user_role(seller_id, "seller" if req.is_active else "user")
    await audit_json(user["id"], "seller.update", "user", seller_id, req.model_dump(exclude_none=True))
    return {"ok": True, "message": "Vendedor actualizado"}


@app.delete("/api/admin/sellers/{seller_id}")
async def admin_remove_seller(seller_id: int, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("UPDATE internal_sellers SET is_active=0, updated_at=? WHERE user_id=?", (time.time(), seller_id))
        await conn.commit()
    if seller_id not in config.ADMIN_IDS:
        await db.set_user_role(seller_id, "user")
    await audit_json(user["id"], "seller.revoke", "user", seller_id)
    return {"ok": True, "message": "Vendedor removido"}


def build_account_seller_data(req, current: dict | None = None, target_user_id: int | None = None) -> dict:
    base = dict(current or {})
    raw = req.model_dump(exclude_none=True) if hasattr(req, "model_dump") else dict(req or {})
    name = str(raw.get("store_name", base.get("store_name") or "")).strip()
    if not name:
        fallback_id = target_user_id or base.get("user_id") or raw.get("user_id") or ""
        name = f"Tienda {fallback_id}".strip()
    slug = str(raw.get("store_slug", base.get("store_slug") or "")).strip()
    if not slug:
        slug = make_store_slug(name)
    else:
        slug = make_store_slug(slug)
    return {
        "store_name": name[:120],
        "store_slug": slug,
        "store_description": str(raw.get("store_description", base.get("store_description") or ""))[:2000],
        "store_image": clean_external_url(raw.get("store_image", base.get("store_image") or "")),
        "banner_image": clean_external_url(raw.get("banner_image", base.get("banner_image") or "")),
        "whatsapp_url": clean_external_url(raw.get("whatsapp_url", base.get("whatsapp_url") or "")),
        "social_url_1": clean_external_url(raw.get("social_url_1", base.get("social_url_1") or "")),
        "social_url_2": clean_external_url(raw.get("social_url_2", base.get("social_url_2") or "")),
        "allow_external_links": bool(raw.get("allow_external_links", base.get("allow_external_links", 1))),
        "status": str(raw.get("status", base.get("status") or "active")).lower(),
        "max_active_products": int(raw.get("max_active_products", base.get("max_active_products") or 10)),
        "commission_percent": float(raw.get("commission_percent", base.get("commission_percent") or 10)),
    }


@app.get("/api/admin/account-sellers")
async def admin_account_sellers(status: str = "", user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    rows = await db.list_account_seller_profiles(status=status or None)
    return [{**r, "public": account_seller_public_payload(r)} for r in rows]


@app.post("/api/admin/account-sellers")
async def admin_create_account_seller(req: AccountSellerProfileRequest, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    if not req.user_id:
        raise HTTPException(400, "user_id requerido")
    target = await db.get_user(int(req.user_id))
    if not target:
        raise HTTPException(404, "Usuario no encontrado. Primero debe registrarse o entrar a la web.")
    data = build_account_seller_data(req, target_user_id=int(req.user_id))
    data["status"] = data.get("status") if data.get("status") in {"pending", "active", "suspended", "disabled"} else "active"
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("""
            INSERT INTO internal_sellers (user_id, max_products, is_active, can_create_products, can_sell_recharges, commission_pct, recharge_commission_pct, notes, created_by, updated_at)
            VALUES (?, ?, ?, 1, 0, ?, 0, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                max_products=excluded.max_products,
                is_active=excluded.is_active,
                can_create_products=1,
                can_sell_recharges=0,
                commission_pct=excluded.commission_pct,
                notes=excluded.notes,
                updated_at=excluded.updated_at
        """, (int(req.user_id), int(data["max_active_products"]), 1 if data["status"] == "active" else 0, float(data["commission_percent"]), "Vendedor aprobado solo para cuentas de juegos", user["id"], time.time()))
        await conn.commit()
    data["seller_type"] = "account"
    await db.set_user_role(int(req.user_id), "seller" if data["status"] == "active" else "user")
    await db.ensure_seller_wallet(int(req.user_id))
    profile = await db.upsert_account_seller_profile(int(req.user_id), data, created_by=user["id"])
    await audit_json(user["id"], "account_seller.create", "user", req.user_id, {"store_slug": profile.get("store_slug"), "status": profile.get("status"), "max_active_products": profile.get("max_active_products")})
    return {"ok": True, "seller": profile, "message": "Vendedor de cuentas creado"}


@app.put("/api/admin/account-sellers/{seller_id}")
async def admin_update_account_seller(seller_id: int, req: AccountSellerProfileUpdate, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    current = await db.get_account_seller_profile(user_id=seller_id)
    if not current:
        raise HTTPException(404, "Vendedor de cuentas no encontrado")
    data = build_account_seller_data(req, current=current, target_user_id=seller_id)
    data["seller_type"] = "account"
    profile = await db.upsert_account_seller_profile(seller_id, data, created_by=current.get("created_by"))
    is_active = profile.get("status") == "active"
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("""
            UPDATE internal_sellers
            SET max_products=?, is_active=?, can_create_products=1, can_sell_recharges=0, commission_pct=?, updated_at=?
            WHERE user_id=?
        """, (int(profile.get("max_active_products") or 0), 1 if is_active else 0, float(profile.get("commission_percent") or 0), time.time(), seller_id))
        await conn.commit()
    if seller_id not in config.ADMIN_IDS:
        await db.set_user_role(seller_id, "seller" if is_active else "user")
    await audit_json(user["id"], "account_seller.update", "user", seller_id, {"store_slug": profile.get("store_slug"), "status": profile.get("status"), "max_active_products": profile.get("max_active_products"), "commission_percent": profile.get("commission_percent")})
    return {"ok": True, "seller": profile, "message": "Tienda actualizada"}


@app.get("/api/seller/account-store")
async def seller_account_store(user: dict = Depends(get_current_user)):
    role = await ensure_manual_manager(user["id"])
    if role != "seller":
        profile = await db.get_account_seller_profile(user_id=user["id"])
        return {"seller": profile, "is_account_seller": bool(profile and profile.get("seller_type") == "account"), "is_general_seller": bool(profile and profile.get("seller_type") == "general")}
    profile = await db.get_account_seller_profile(user_id=user["id"])
    if not profile:
        raise HTTPException(403, "Tu usuario no tiene tienda aprobada")
    products = await db.get_manual_products(active_only=False, created_by=user["id"])
    if (profile.get("seller_type") or "account") == "account":
        products = [p for p in products if p.get("category") == "game_account"]
    return {"seller": profile, "public": account_seller_public_payload(profile), "products": products, "is_account_seller": profile.get("seller_type") == "account", "is_general_seller": profile.get("seller_type") == "general"}


@app.put("/api/seller/account-store")
async def seller_update_account_store(req: AccountSellerProfileUpdate, user: dict = Depends(get_current_user)):
    role = await ensure_manual_manager(user["id"])
    if role != "seller":
        raise HTTPException(403, "Solo vendedores")
    current = await db.get_account_seller_profile(user_id=user["id"], active_only=False)
    if not current or current.get("status") != "active":
        raise HTTPException(403, "Tu tienda no está activa")
    clean_req = req.model_dump(exclude_none=True)
    for protected in ("status", "max_active_products", "commission_percent", "allow_external_links"):
        clean_req.pop(protected, None)
    data = build_account_seller_data(clean_req, current=current, target_user_id=user["id"])
    data["status"] = current.get("status") or "active"
    data["max_active_products"] = int(current.get("max_active_products") or 10)
    data["commission_percent"] = float(current.get("commission_percent") or 10)
    data["allow_external_links"] = bool(current.get("allow_external_links", 1))
    data["seller_type"] = current.get("seller_type") or "general"
    profile = await db.upsert_account_seller_profile(user["id"], data, created_by=current.get("created_by"))
    await audit_json(user["id"], "account_seller.store_update", "user", user["id"], {"store_slug": profile.get("store_slug")})
    return {"ok": True, "seller": profile, "message": "Mi tienda actualizada"}


@app.get("/api/public/account-sellers/{slug}")
async def public_account_seller_store(slug: str):
    if await settings.get_bool("maintenance_mode"):
        raise HTTPException(503, "Mantenimiento en curso")
    data = await db.get_public_account_seller_store(make_store_slug(slug))
    if not data:
        raise HTTPException(404, "Tienda no encontrada")
    social_stats = await load_catalog_social_stats()
    products = await attach_account_seller_profiles(data.get("products") or [])
    enriched_products = []
    for product in products:
        product_social = summarize_social_stats([product.get("id")], social_stats["manual_orders"], social_stats["manual_reviews"])
        enriched_products.append({**product, **product_social})
    seller_social = summarize_social_stats([p.get("id") for p in enriched_products], social_stats["manual_orders"], social_stats["manual_reviews"])
    seller_payload = account_seller_public_payload(data["seller"])
    seller_payload.update({
        **seller_social,
        "products_count": len(enriched_products),
        "verified": True,
    })
    return {"seller": seller_payload, "products": enriched_products, "notice": "Las compras se procesan dentro de Francho Shop"}



@app.get("/api/admin/reviews")
async def admin_reviews(limit: int = 100, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    return {
        "stats": await db.get_review_stats(),
        "items": await db.get_recent_reviews(limit=max(1, min(int(limit), 500))),
    }


@app.get("/api/admin/audit")
async def admin_recent_audit(limit: int = 50, user: dict = Depends(get_current_user)):
    role = await get_user_role(user["id"])
    if role != "admin":
        raise HTTPException(403, "Solo admin")
    return await db.get_recent_audit(limit=max(1, min(int(limit), 200)))


# ════════════════════════════════════════════════════════════
#  PRODUCTOS MANUALES — admin crea, vendedores internos gestionan los suyos
# ════════════════════════════════════════════════════════════

class ManualProductOption(BaseModel):
    name: str
    price: float
    stock: int = -1
    sort_order: int | None = None
    is_active: bool = True


class ManualProductField(BaseModel):
    label: str
    field_type: str = "text"
    placeholder: str = ""
    is_required: bool = True
    sort_order: int | None = None
    is_active: bool = True


class ManualProductCreate(BaseModel):
    name: str
    description: str = ""
    category: str = "service"
    price: float
    icon_url: str | None = None
    delivery_type: str = "manual"  # manual, code, account, auto_text, auto_file
    instructions: str = ""
    account_game: str = ""
    account_platform: str = ""
    account_region: str = ""
    account_level: str = ""
    account_rank: str = ""
    account_items: str = ""
    account_currency: str = ""
    account_access_method: str = ""
    account_status: str = "active"
    account_warranty: str = ""
    account_terms: str = ""
    account_images: list[str] = Field(default_factory=list)
    auto_delivery_type: str | None = None
    auto_delivery_text: str | None = None
    auto_delivery_file_url: str | None = None
    auto_delivery_file_name: str | None = None
    auto_delivery_file_mime: str | None = None
    low_stock_alert: int | None = 5
    is_active: bool = True
    stock: int = -1  # -1 = ilimitado
    options: list[ManualProductOption] = Field(default_factory=list)
    fields: list[ManualProductField] = Field(default_factory=list)


class ManualProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    price: float | None = None
    icon_url: str | None = None
    delivery_type: str | None = None
    instructions: str | None = None
    account_game: str | None = None
    account_platform: str | None = None
    account_region: str | None = None
    account_level: str | None = None
    account_rank: str | None = None
    account_items: str | None = None
    account_currency: str | None = None
    account_access_method: str | None = None
    account_status: str | None = None
    account_warranty: str | None = None
    account_terms: str | None = None
    account_images: list[str] | None = None
    auto_delivery_type: str | None = None
    auto_delivery_text: str | None = None
    auto_delivery_file_url: str | None = None
    auto_delivery_file_name: str | None = None
    auto_delivery_file_mime: str | None = None
    low_stock_alert: int | None = None
    is_active: bool | None = None
    stock: int | None = None
    options: list[ManualProductOption] | None = None
    fields: list[ManualProductField] | None = None


class DigitalStockImport(BaseModel):
    stock_type: str = "code"
    option_id: int | None = None
    items_text: str = ""



def account_public_payload(product: dict) -> dict:
    return {
        "account_game": product.get("account_game") or "",
        "account_platform": product.get("account_platform") or "",
        "account_region": product.get("account_region") or "",
        "account_level": product.get("account_level") or "",
        "account_rank": product.get("account_rank") or "",
        "account_items": product.get("account_items") or "",
        "account_currency": product.get("account_currency") or "",
        "account_access_method": product.get("account_access_method") or "",
        "account_status": product.get("account_status") or "active",
        "account_warranty": product.get("account_warranty") or "",
        "account_terms": product.get("account_terms") or "",
        "account_images": json.loads(product.get("account_images") or "[]") if isinstance(product.get("account_images"), str) else (product.get("account_images") or []),
    }

@app.get("/api/manual-products")
async def list_manual_products(user: dict = Depends(get_current_user)):
    """Lista productos manuales activos para el catálogo."""
    if await settings.get_bool("maintenance_mode") and user["id"] not in config.ADMIN_IDS:
        raise HTTPException(503, "Mantenimiento en curso")
    return await build_manual_products_catalog()


@app.get("/api/admin/seller-dashboard")
async def admin_seller_dashboard(user: dict = Depends(get_current_user)):
    role = await ensure_manual_manager(user["id"])
    await db.release_due_seller_holds(None if role == "admin" else user["id"])
    owner = None if role == "admin" else user["id"]
    products = await db.get_manual_products(active_only=False, created_by=owner)
    orders = await db.get_manual_orders(seller_id=owner, limit=10000) if owner is not None else await db.get_manual_orders(limit=10000)
    now = time.time()

    def completed_since(seconds: int):
        start = now - seconds
        return [o for o in orders if o.get("status") == "completed" and float(o.get("created_at") or 0) >= start]

    def period_summary(items):
        return {
            "orders": len(items),
            "revenue": round(sum(float(o.get("price") or 0) for o in items), 2),
        }

    completed = [o for o in orders if o.get("status") == "completed"]
    pending = [o for o in orders if o.get("status") == "pending"]
    failed_like = [o for o in orders if o.get("status") in ("failed", "canceled", "refunded", "revoked")]

    product_map = {int(p.get("id")): p for p in products}
    top_bucket = {}
    for o in completed:
        pid = int(o.get("product_id") or 0)
        bucket = top_bucket.setdefault(pid, {
            "product_id": pid,
            "name": o.get("product_name") or product_map.get(pid, {}).get("name") or "Producto",
            "orders": 0,
            "revenue": 0.0,
        })
        bucket["orders"] += 1
        bucket["revenue"] += float(o.get("price") or 0)
    top_products = sorted(top_bucket.values(), key=lambda x: (x["revenue"], x["orders"]), reverse=True)[:5]
    for item in top_products:
        item["revenue"] = round(item["revenue"], 2)

    stock_alerts = []
    for p in products:
        if not p.get("is_active"):
            continue
        pid = int(p.get("id"))
        delivery_type = p.get("delivery_type")
        if delivery_type == "digital_stock":
            counts = await db.get_digital_stock_counts(pid)
            available = int(counts.get("available") or 0)
            if available == 0:
                stock_alerts.append({"product_id": pid, "name": p.get("name"), "level": "critical", "message": "Sin stock digital disponible"})
            elif available <= 5:
                stock_alerts.append({"product_id": pid, "name": p.get("name"), "level": "warning", "message": f"Stock digital bajo: {available} disponibles"})
            continue

        options = [o for o in p.get("options", []) if o.get("is_active", 1)]
        if options:
            for opt in options:
                stock = int(opt.get("stock", -1) if opt.get("stock", -1) is not None else -1)
                if stock == 0:
                    stock_alerts.append({"product_id": pid, "option_id": opt.get("id"), "name": p.get("name"), "level": "critical", "message": f"Opción sin stock: {opt.get('name')}"})
                elif 0 < stock <= 5:
                    stock_alerts.append({"product_id": pid, "option_id": opt.get("id"), "name": p.get("name"), "level": "warning", "message": f"Opción con stock bajo: {opt.get('name')} ({stock})"})
        else:
            stock = int(p.get("stock", -1) if p.get("stock", -1) is not None else -1)
            if stock == 0:
                stock_alerts.append({"product_id": pid, "name": p.get("name"), "level": "critical", "message": "Producto sin stock"})
            elif 0 < stock <= 5:
                stock_alerts.append({"product_id": pid, "name": p.get("name"), "level": "warning", "message": f"Stock bajo: {stock} disponibles"})

    pending_alerts = []
    for o in pending[:20]:
        age_hours = (now - float(o.get("created_at") or now)) / 3600
        if age_hours >= 12:
            pending_alerts.append({
                "order_id": o.get("id"),
                "product_name": o.get("product_name"),
                "age_hours": round(age_hours, 1),
                "message": f"Pedido pendiente hace {round(age_hours, 1)} horas",
            })

    if role == "admin":
        wallet_rows = await db.get_all_seller_wallets()
        wallet = {
            "currency": "USDT",
            "network": "BEP20",
            "held_balance": round(sum(float(w.get("held_balance") or 0) for w in wallet_rows.values()), 2),
            "available_balance": round(sum(float(w.get("available_balance") or 0) for w in wallet_rows.values()), 2),
            "withdrawn_balance": round(sum(float(w.get("withdrawn_balance") or 0) for w in wallet_rows.values()), 2),
        }
    else:
        wallet = await db.get_seller_wallet(user["id"])

    return {
        "role": role,
        "scope": "all" if role == "admin" else "seller",
        "wallet": wallet,
        "summary": {
            "today": period_summary(completed_since(86400)),
            "week": period_summary(completed_since(86400 * 7)),
            "month": period_summary(completed_since(86400 * 30)),
            "all_time": period_summary(completed),
            "pending_orders": len(pending),
            "failed_orders": len(failed_like),
            "products_total": len(products),
            "products_active": sum(1 for p in products if p.get("is_active")),
        },
        "top_products": top_products,
        "stock_alerts": stock_alerts[:20],
        "pending_alerts": pending_alerts[:20],
        "recent_pending": pending[:8],
        "withdrawals": await db.list_seller_withdrawals(seller_id=None if role == "admin" else user["id"], limit=20),
    }


@app.get("/api/admin/manual-products")
async def admin_list_manual_products(user: dict = Depends(get_current_user)):
    """Admin ve todo; vendedor interno ve solo sus productos."""
    role = await ensure_manual_manager(user["id"])
    owner = None if role == "admin" else user["id"]
    return await db.get_manual_products(active_only=False, created_by=owner)


@app.post("/api/admin/manual-products")
async def admin_create_manual_product(req: ManualProductCreate, user: dict = Depends(get_current_user)):
    """Admin o vendedor interno: crear producto manual bajo la marca del sistema."""
    role = await ensure_manual_manager(user["id"])
    account_profile = None
    if role == "seller":
        perms = await get_seller_permissions(user["id"])
        if not perms.get("can_create_products", 1):
            raise HTTPException(403, "Tu permiso para crear productos está pausado")
        account_profile = await db.get_account_seller_profile(user_id=user["id"], active_only=False)
        if account_profile:
            if account_profile.get("status") != "active":
                raise HTTPException(403, "Tu tienda no está activa")
            if req.category != "game_account":
                raise HTTPException(403, "Este vendedor solo puede publicar cuentas de juegos")
            max_products = int(account_profile.get("max_active_products") or 0)
            used = await db.count_active_account_products_by_seller(user["id"])
            if req.is_active and used >= max_products:
                raise HTTPException(403, f"Límite de cuentas activas alcanzado ({used}/{max_products})")
        else:
            max_products = int(perms.get("max_products") or 0)
            used = await db.count_manual_products_by_creator(user["id"])
            if used >= max_products:
                raise HTTPException(403, f"Límite de productos alcanzado ({used}/{max_products})")
    data = req.model_dump()
    if data.get("account_images") is not None:
        data["account_images"] = json.dumps([str(u).strip() for u in (data.get("account_images") or []) if str(u).strip()], ensure_ascii=False)
    if data.get("category") == "game_account":
        data["delivery_type"] = "manual"
        data["stock"] = 1
        data["account_status"] = data.get("account_status") or "active"
    if data.get("delivery_type") == "auto_text" and not (data.get("auto_delivery_text") or "").strip():
        raise HTTPException(400, "Escribe el texto de entrega automática")
    if data.get("delivery_type") == "auto_file" and not data.get("auto_delivery_file_url"):
        raise HTTPException(400, "Sube un archivo para la entrega automática")
    data["auto_delivery_type"] = "file" if data.get("delivery_type") == "auto_file" else "text" if data.get("delivery_type") == "auto_text" else "stock" if data.get("delivery_type") == "digital_stock" else None
    data["created_by"] = user["id"]
    pid = await db.create_manual_product(data)
    invalidate_catalog_cache()
    await audit_json(user["id"], "manual_product.create", "manual_product", pid, {"name": req.name, "role": role})
    return {"ok": True, "id": pid, "message": f"Producto '{req.name}' creado"}


@app.put("/api/admin/manual-products/{product_id}")
async def admin_update_manual_product(product_id: int, req: ManualProductUpdate,
                                       user: dict = Depends(get_current_user)):
    """Admin actualiza cualquiera; vendedor solo sus productos."""
    role, product = await assert_can_manage_manual_product(user["id"], product_id)
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    if role == "seller":
        account_profile = await db.get_account_seller_profile(user_id=user["id"], active_only=False)
        if account_profile:
            if account_profile.get("status") != "active":
                raise HTTPException(403, "Tu tienda no está activa")
            if product.get("category") != "game_account" or data.get("category", product.get("category")) != "game_account":
                raise HTTPException(403, "Este vendedor solo puede editar cuentas de juegos")
            if data.get("is_active") is True and not product.get("is_active"):
                used = await db.count_active_account_products_by_seller(user["id"])
                max_products = int(account_profile.get("max_active_products") or 0)
                if used >= max_products:
                    raise HTTPException(403, f"Límite de cuentas activas alcanzado ({used}/{max_products})")
    if data.get("account_images") is not None:
        data["account_images"] = json.dumps([str(u).strip() for u in (data.get("account_images") or []) if str(u).strip()], ensure_ascii=False)
    if data.get("category", product.get("category")) == "game_account":
        data["delivery_type"] = "manual"
        if data.get("account_status") == "sold":
            data["is_active"] = False
            data["stock"] = 0
        elif data.get("account_status") in ("active", "inactive") and data.get("stock") is None:
            data["stock"] = 1 if data.get("account_status") == "active" else 0
    next_delivery_type = data.get("delivery_type", product.get("delivery_type"))
    next_text = data.get("auto_delivery_text", product.get("auto_delivery_text"))
    next_file = data.get("auto_delivery_file_url", product.get("auto_delivery_file_url"))
    if next_delivery_type == "auto_text" and not (next_text or "").strip():
        raise HTTPException(400, "Escribe el texto de entrega automática")
    if next_delivery_type == "auto_file" and not next_file:
        raise HTTPException(400, "Sube un archivo para la entrega automática")
    if "delivery_type" in data:
        data["auto_delivery_type"] = "file" if next_delivery_type == "auto_file" else "text" if next_delivery_type == "auto_text" else "stock" if next_delivery_type == "digital_stock" else None
    await db.update_manual_product(product_id, data)
    invalidate_catalog_cache()
    await audit_json(user["id"], "manual_product.update", "manual_product", product_id, {"fields": list(data.keys()), "role": role, "owner": product.get("created_by")})
    return {"ok": True, "message": "Producto actualizado"}


@app.delete("/api/admin/manual-products/{product_id}")
async def admin_delete_manual_product(product_id: int, user: dict = Depends(get_current_user)):
    """Admin elimina cualquiera; vendedor solo sus productos."""
    role, product = await assert_can_manage_manual_product(user["id"], product_id)
    await db.delete_manual_product(product_id)
    invalidate_catalog_cache()
    await audit_json(user["id"], "manual_product.delete", "manual_product", product_id, {"name": product.get("name"), "role": role, "owner": product.get("created_by")})
    return {"ok": True, "message": "Producto eliminado"}


@app.get("/api/admin/manual-products/{product_id}/digital-stock")
async def admin_get_digital_stock(product_id: int, status: str = None, user: dict = Depends(get_current_user)):
    await assert_can_manage_manual_product(user["id"], product_id)
    return {
        "counts": await db.get_digital_stock_counts(product_id),
        "items": await db.list_digital_stock_items(product_id, status=status, limit=100),
    }


@app.post("/api/admin/manual-products/{product_id}/digital-stock")
async def admin_import_digital_stock(product_id: int, req: DigitalStockImport, user: dict = Depends(get_current_user)):
    role, product = await assert_can_manage_manual_product(user["id"], product_id)
    raw_lines = [line.strip() for line in (req.items_text or "").splitlines()]
    items = []
    for line in raw_lines:
        if not line:
            continue
        label = ""
        payload = line
        if "|" in line:
            label, payload = [part.strip() for part in line.split("|", 1)]
        items.append({"option_id": req.option_id, "stock_type": req.stock_type, "label": label, "payload": payload})
    if not items:
        raise HTTPException(400, "Pega al menos un código, licencia, cuenta o link")
    count = await db.add_digital_stock_items(product_id, items, created_by=user["id"])
    if product.get("delivery_type") != "digital_stock":
        await db.update_manual_product(product_id, {"delivery_type": "digital_stock", "auto_delivery_type": "stock"})
    invalidate_catalog_cache()
    await audit_json(user["id"], "digital_stock.import", "manual_product", product_id, {"count": count, "stock_type": req.stock_type, "option_id": req.option_id, "role": role})
    return {"ok": True, "count": count, "counts": await db.get_digital_stock_counts(product_id)}


class ManualOrderRequest(BaseModel):
    product_id: int
    option_id: int | None = None
    customer_data: dict = Field(default_factory=dict)


@app.post("/api/manual-orders")
async def create_manual_order_endpoint(req: ManualOrderRequest, user: dict = Depends(get_current_user)):
    """Comprar un producto manual (descuenta saldo, admin entrega después)."""
    user_id = user["id"]
    await prevent_duplicate_purchase(user_id, "manual", req.product_id, {"option_id": req.option_id, "customer_data": req.customer_data})
    product = await db.get_manual_product(req.product_id)
    if not product or not product["is_active"]:
        raise HTTPException(404, "Producto no disponible")
    if product.get("category") == "game_account":
        if (product.get("account_status") or "active") == "sold" or int(product.get("stock") or 0) == 0:
            raise HTTPException(409, "Esta cuenta ya fue vendida")
    options = [o for o in product.get("options", []) if o.get("is_active", 1)]
    selected_option = None
    if options:
        if not req.option_id:
            raise HTTPException(400, "Selecciona una opción de compra")
        selected_option = next((o for o in options if o["id"] == req.option_id), None)
        if not selected_option:
            raise HTTPException(404, "Opción no disponible")
        if selected_option.get("stock", -1) == 0:
            raise HTTPException(400, "Sin stock")
        price = float(selected_option["price"])
    else:
        if product["stock"] == 0:
            raise HTTPException(400, "Sin stock")
        price = float(product["price"])
    active_fields = [f for f in product.get("fields", []) if f.get("is_active", 1)]
    clean_customer_data = {}
    for field in active_fields:
        key = str(field.get("id"))
        label = field.get("label", "Dato")
        value = str(req.customer_data.get(key, "")).strip()
        if field.get("is_required", 1) and not value:
            raise HTTPException(400, f"Completa: {label}")
        if value:
            clean_customer_data[label] = value

    balance = await db.get_balance(user_id)
    if balance < price:
        raise HTTPException(400, f"Saldo insuficiente. Necesitas ${price:.2f}, tienes ${balance:.2f}")
    option_name = selected_option.get("name") if selected_option else None
    product_label = f"{product['name']} - {option_name}" if option_name else product["name"]
    # Descontar saldo
    await db.add_balance(user_id, -price, f"Compra manual: {product_label}")
    order_id = await db.create_manual_order(
        req.product_id, user_id, price,
        option_id=selected_option.get("id") if selected_option else None,
        option_name=option_name,
        customer_data=clean_customer_data,
    )
    # Notificación de nuevo pedido recibido para el vendedor y administradores
    try:
        is_auto = product.get("delivery_type") in ("digital_stock", "auto_text", "auto_file")
        status_msg = "(entregado automáticamente)" if is_auto else "(pendiente de entrega)"
        seller_id = product.get("created_by")
        if seller_id:
            await db.create_notification(
                user_id=int(seller_id),
                type="new_order",
                title="Nuevo pedido recibido",
                message=f"Has recibido el pedido #{order_id} de {product_label} {status_msg}.",
                related_order_id=order_id,
                url=f"/pedido/{order_id}/seguimiento?admin=true"
            )
        for admin_id in config.ADMIN_IDS:
            if admin_id != seller_id:
                await db.create_notification(
                    user_id=int(admin_id),
                    type="new_order",
                    title="Nuevo pedido manual",
                    message=f"Se creó el pedido #{order_id} de {product_label} {status_msg}.",
                    related_order_id=order_id,
                    url=f"/pedido/{order_id}/seguimiento?admin=true"
                )
    except Exception as ne:
        log.warning("Error creating manual order notifications: %s", ne)
    payout_settings = await get_seller_payout_settings()
    hold_days = payout_settings["seller_hold_days_auto"] if product.get("delivery_type") in ("digital_stock", "auto_text", "auto_file") else payout_settings["seller_hold_days_manual"]
    wallet_hold = await db.create_seller_sale_hold(
        order_id,
        default_commission_pct=payout_settings["seller_default_commission_pct"],
        min_platform_fee=payout_settings["seller_min_platform_fee"],
        hold_days=hold_days,
        new_seller_days=payout_settings["seller_new_days"],
        new_seller_hold_days=payout_settings["seller_new_hold_days"],
    )
    await audit_json(user_id, "manual_order.create", "manual_order", order_id, {"product_id": req.product_id, "seller_id": product.get("created_by"), "price": price, "seller_wallet_hold": wallet_hold})
    account_sale = None
    if product.get("category") == "game_account":
        seller_id = int(product.get("created_by") or 0)
        seller_profile = await db.get_account_seller_profile(user_id=seller_id, active_only=False) if seller_id else None
        commission_pct = float((seller_profile or {}).get("commission_percent") or 0)
        platform_commission = round(float((wallet_hold or {}).get("platform_fee") or (price * commission_pct / 100)), 8)
        seller_earning = round(float((wallet_hold or {}).get("amount") or (price - platform_commission)), 8)
        account_sale = await db.create_account_seller_sale(
            order_id, req.product_id, seller_id, user_id, price,
            platform_commission=platform_commission, seller_earning=seller_earning, status="pending",
        )
        await db.update_manual_product(req.product_id, {"account_status": "sold", "is_active": 0, "stock": 0})
        invalidate_catalog_cache()
        await audit_json(user_id, "game_account.sold", "manual_product", req.product_id, {"order_id": order_id, "price": price, "seller_id": seller_id, "platform_commission": platform_commission, "seller_earning": seller_earning})

    if product.get("delivery_type") == "digital_stock":
        item = await db.consume_digital_stock_item(req.product_id, order_id, user_id, option_id=selected_option.get("id") if selected_option else None)
        if not item:
            await db.add_balance(user_id, price, "refund", str(order_id), "Refund: sin stock digital")
            await db.void_seller_sale_hold(order_id, "Sin stock digital: saldo retenido anulado")
            await db.complete_manual_order(order_id, "", "Sin stock digital disponible", completed_by=0, event_type="stock_failed")
            await notify_admins(
                f"⚠️ <b>Stock digital agotado</b>\nPedido: <b>#{order_id}</b>\nProducto: <b>{html.escape(str(product_label))}</b>\nSe devolvió ${price:.2f} USDT al cliente.",
                [int(product.get("created_by") or 0)],
            )
            raise HTTPException(409, "Este producto se quedó sin stock digital. Tu saldo fue devuelto.")
        delivery_data = item.get("payload") or ""
        await db.complete_manual_order(order_id, delivery_data, "Entrega automática: stock digital", completed_by=0, event_type="digital_stock_completed")
        await audit_json(0, "manual_order.digital_stock_complete", "manual_order", order_id, {"stock_item_id": item.get("id"), "stock_type": item.get("stock_type")})
        try:
            import aiohttp
            client_text = build_order_ficha_html(
                product_label,
                order_id,
                price,
                headline="✅ <b>Entrega automática lista</b>",
                status_label="Entregado automáticamente",
                detail_label="Contenido",
                detail_value=delivery_data,
            )
            async with aiohttp.ClientSession() as session:
                await session.post(f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage", json={"chat_id": user_id, "text": client_text, "parse_mode": "HTML"}, timeout=aiohttp.ClientTimeout(total=5))
        except Exception as e:
            log.warning("No se pudo enviar stock digital: %s", e)
        return {"ok": True, "order_id": order_id, "message": f"Pedido #{order_id} completado automáticamente.", "product": product_label, "price": price, "status": "completed"}

    if product.get("delivery_type") in ("auto_text", "auto_file"):
        delivery_data = (product.get("auto_delivery_text") or "").strip()
        if product.get("delivery_type") == "auto_file":
            delivery_data = product.get("auto_delivery_file_url") or ""
        await db.complete_manual_order(order_id, delivery_data, "Entrega automática", completed_by=0, event_type="auto_completed")
        await audit_json(0, "manual_order.auto_complete", "manual_order", order_id, {"delivery_type": product.get("delivery_type"), "product_id": req.product_id})
        try:
            import aiohttp
            client_text = build_order_ficha_html(
                product_label,
                order_id,
                price,
                headline="✅ <b>Entrega automática lista</b>",
                status_label="Entregado automáticamente",
            )
            async with aiohttp.ClientSession() as session:
                if product.get("delivery_type") == "auto_file" and product.get("auto_delivery_file_url"):
                    file_path = DELIVERY_DIR / Path(product["auto_delivery_file_url"]).name
                    caption = client_text + "\n📎 Archivo adjunto."
                    if file_path.exists():
                        form = aiohttp.FormData()
                        form.add_field("chat_id", str(user_id))
                        form.add_field("caption", caption)
                        form.add_field("parse_mode", "HTML")
                        form.add_field(
                            "document",
                            file_path.read_bytes(),
                            filename=product.get("auto_delivery_file_name") or file_path.name,
                            content_type=product.get("auto_delivery_file_mime") or "application/octet-stream",
                        )
                        await session.post(f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendDocument", data=form, timeout=aiohttp.ClientTimeout(total=90))
                    else:
                        await session.post(f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage", json={"chat_id": user_id, "text": caption + f"\n{product.get('auto_delivery_file_url')}", "parse_mode": "HTML"}, timeout=aiohttp.ClientTimeout(total=5))
                else:
                    text = build_order_ficha_html(
                        product_label,
                        order_id,
                        price,
                        headline="✅ <b>Entrega automática lista</b>",
                        status_label="Entregado automáticamente",
                        detail_label="Contenido",
                        detail_value=delivery_data,
                    )
                    await session.post(f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage", json={"chat_id": user_id, "text": text, "parse_mode": "HTML"}, timeout=aiohttp.ClientTimeout(total=5))
        except Exception as e:
            log.warning("No se pudo enviar entrega automática: %s", e)
        return {
            "ok": True,
            "order_id": order_id,
            "message": f"Pedido #{order_id} completado automáticamente.",
            "product": product_label,
            "price": price,
            "status": "completed",
        }

    initial_case_message = "Tu pedido fue creado correctamente. Un miembro del equipo revisará la entrega y te contactará por aquí si necesita confirmar algún dato."
    if product.get("category") == "game_account":
        initial_case_message += " En este chat recibirás las instrucciones necesarias para acceder a la cuenta comprada. También podrás aclarar dudas sobre correo, contraseña, verificación, método de acceso, garantía y pasos recomendados después de la entrega."
    case_id = await db.create_or_get_manual_order_case(
        order_id,
        product_id=req.product_id,
        customer_id=user_id,
        seller_id=product.get("created_by"),
        initial_message=initial_case_message,
    )
    await db.add_delivery_event(order_id, "case_created", 0, "", f"Caso de entrega #{case_id} creado", "ok", "")
    if product.get("category") == "game_account":
        await db.link_account_seller_sale_case(order_id, case_id)
    await audit_json(0, "manual_order.case_create", "manual_order", order_id, {"case_id": case_id, "product_id": req.product_id})

    await notify_manual_purchase_pending(order_id, product, product_label, price, user_id, clean_customer_data)

    return {
        "ok": True,
        "order_id": order_id,
        "message": f"Pedido #{order_id} creado. El admin lo procesará pronto.",
        "product": product_label,
        "price": price,
    }


@app.get("/api/admin/manual-orders")
async def admin_list_manual_orders(
    status: str = None,
    q: str = "",
    user_id: int | None = None,
    seller_id: int | None = None,
    date_from: float | None = None,
    date_to: float | None = None,
    limit: int = 100,
    export: str = "",
    user: dict = Depends(get_current_user),
):
    """Admin ve todos los pedidos; vendedor interno ve sus ventas. Soporta filtros y CSV."""
    role = await ensure_manual_manager(user["id"])
    effective_seller_id = seller_id if role == "admin" else user["id"]
    import aiosqlite
    safe_limit = max(1, min(int(limit or 100), 1000))
    sql = """
        SELECT mo.*, mp.name as product_name, mp.category, mp.delivery_type,
               mp.created_by as product_owner_id,
               u.username AS customer_username, u.first_name AS customer_name, u.email AS customer_email,
               su.username AS seller_username, su.first_name AS seller_name, su.email AS seller_email,
               asp.store_name AS seller_store_name, asp.store_slug AS seller_store_slug
        FROM manual_orders mo
        JOIN manual_products mp ON mo.product_id = mp.id
        LEFT JOIN users u ON u.user_id = mo.user_id
        LEFT JOIN users su ON su.user_id = COALESCE(mo.seller_id, mp.created_by)
        LEFT JOIN account_seller_profiles asp ON asp.user_id = COALESCE(mo.seller_id, mp.created_by)
        WHERE 1=1
    """
    params = []
    if status:
        sql += " AND mo.status=?"
        params.append(status)
    if user_id is not None:
        sql += " AND mo.user_id=?"
        params.append(user_id)
    if effective_seller_id is not None:
        sql += " AND COALESCE(mo.seller_id, mp.created_by)=?"
        params.append(effective_seller_id)
    if date_from is not None:
        sql += " AND mo.created_at>=?"
        params.append(date_from)
    if date_to is not None:
        sql += " AND mo.created_at<=?"
        params.append(date_to)
    if q.strip():
        like = f"%{q.strip()}%"
        sql += " AND (CAST(mo.id AS TEXT) LIKE ? OR CAST(mo.user_id AS TEXT) LIKE ? OR CAST(COALESCE(mo.seller_id, mp.created_by) AS TEXT) LIKE ? OR mp.name LIKE ? OR u.username LIKE ? OR u.first_name LIKE ? OR u.email LIKE ? OR su.username LIKE ? OR su.first_name LIKE ? OR su.email LIKE ? OR asp.store_name LIKE ?)"
        params.extend([like, like, like, like, like, like, like, like, like, like, like])
    sql += " ORDER BY mo.created_at DESC LIMIT ?"
    params.append(safe_limit)
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(sql, params) as c:
            orders = [dict(r) for r in await c.fetchall()]
    for order in orders:
        order["customer_data"] = json.loads(order.get("customer_data") or "{}")
    if export.lower() == "csv":
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "status", "product", "option", "customer_id", "customer_name", "customer_username", "customer_email", "seller_id", "seller_name", "seller_username", "seller_email", "seller_store", "price", "created_at", "completed_at", "customer_data"])
        for o in orders:
            writer.writerow([
                o.get("id"), o.get("status"), o.get("product_name"), o.get("option_name") or "",
                o.get("user_id"), o.get("customer_name") or "", o.get("customer_username") or "", o.get("customer_email") or "",
                o.get("seller_id") or o.get("product_owner_id"), o.get("seller_name") or "", o.get("seller_username") or "", o.get("seller_email") or "", o.get("seller_store_name") or "", o.get("price"),
                o.get("created_at"), o.get("completed_at") or "", json.dumps(o.get("customer_data") or {}, ensure_ascii=False),
            ])
        return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=manual-orders.csv"})
    return orders


class CompleteManualOrder(BaseModel):
    delivery_data: str  # código, datos de cuenta, etc.
    admin_note: str = ""


class DeliveryChangeRequest(BaseModel):
    delivery_data: str
    admin_note: str = ""


class DeliveryRevokeRequest(BaseModel):
    reason: str = ""


class OrderAdminActionRequest(BaseModel):
    reason: str = ""


async def assert_can_manage_manual_order(actor_id: int, order_id: int) -> tuple[str, dict]:
    role = await ensure_manual_manager(actor_id)
    order = await db.get_manual_order_by_id(order_id)
    if not order:
        raise HTTPException(404, "Pedido no encontrado")
    if role == "seller" and int(order.get("product_owner_id") or order.get("seller_id") or 0) != int(actor_id):
        raise HTTPException(403, "No puedes gestionar ventas de otro vendedor")
    return role, order


async def notify_manual_order_delivery(order: dict, delivery_data: str, admin_note: str = "", prefix: str = "✅ <b>Entrega actualizada</b>") -> tuple[bool, str]:
    try:
        import aiohttp
        product_title = order.get("product_name", "?")
        if order.get("option_name"):
            product_title += " - " + order.get("option_name")
        client_text = build_order_ficha_html(
            product_title,
            order.get("id") or order.get("merchant_order_id") or "?",
            float(order.get('price') or 0),
            headline=prefix,
            status_label="Entrega actualizada",
            detail_label="Datos de entrega",
            detail_value=delivery_data,
            note=admin_note,
        )
        async with aiohttp.ClientSession() as session:
            await session.post(
                f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage",
                json={"chat_id": order["user_id"], "text": client_text, "parse_mode": "HTML"},
                timeout=aiohttp.ClientTimeout(total=5),
            )
        return True, ""
    except Exception as e:
        log.warning("No se pudo notificar entrega: %s", e)
        return False, str(e)


def public_delivery_url(path_or_url: str = "") -> str:
    value = str(path_or_url or "").strip()
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        return value
    base = str(getattr(config, "WEBAPP_URL", "") or "").rstrip("/")
    if value.startswith("/") and base:
        return base + value
    return value


def append_delivery_file_link(delivery_data: str = "", file_url: str = "", file_name: str = "") -> str:
    text = str(delivery_data or "").strip()
    url = str(file_url or "").strip()
    if not url:
        return text
    label = f"Archivo de entrega: {file_name}" if file_name else "Archivo de entrega"
    line = f"{label}\n{public_delivery_url(url)}"
    return f"{text}\n\n{line}".strip() if text else line


async def save_manual_delivery_upload(file: UploadFile) -> tuple[bytes, str, str, str]:
    content_type = (file.content_type or "application/octet-stream").lower()
    original = file.filename or "entrega"
    suffix = Path(original).suffix.lower()
    allowed = {".txt", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".zip", ".rar"}
    if suffix not in allowed:
        content_ext = {
            "text/plain": ".txt",
            "application/pdf": ".pdf",
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "application/zip": ".zip",
            "application/x-zip-compressed": ".zip",
            "application/x-rar-compressed": ".rar",
            "application/vnd.rar": ".rar",
        }.get(content_type, "")
        suffix = content_ext
    if suffix not in allowed:
        raise HTTPException(400, "Formato no permitido. Usa TXT, PDF, imagen, ZIP o RAR")
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, "Archivo demasiado grande. Máximo 25 MB")
    safe_name = f"delivery-{int(time.time())}-{uuid.uuid4().hex[:12]}{suffix}"
    (DELIVERY_DIR / safe_name).write_bytes(raw)
    return raw, f"/api/delivery-files/{safe_name}", original, content_type


async def notify_manual_order_delivery_email(order: dict, delivery_data: str, admin_note: str = "", prefix: str = "Entrega de tu pedido") -> tuple[bool, str]:
    try:
        buyer = await db.get_user(int(order.get("user_id") or 0))
        email_addr = str((buyer or {}).get("email") or "").strip()
        if not email_addr:
            return False, "Cliente sin email"
        product_title = order.get("product_name", "?")
        if order.get("option_name"):
            product_title += " - " + order.get("option_name")
        safe_title = html.escape(str(product_title))
        safe_delivery = html.escape(str(delivery_data or "")).replace("\n", "<br>")
        safe_note = html.escape(str(admin_note or "")).replace("\n", "<br>")
        body = f"""
        <p>Tu pedido <b>#{html.escape(str(order.get('id') or ''))}</b> fue procesado en Francho Shop.</p>
        <p><b>Producto:</b> {safe_title}</p>
        <p><b>Datos de entrega:</b></p>
        <div style="background:#f6f8fb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;white-space:normal;word-break:break-word">{safe_delivery or 'Entrega completada.'}</div>
        {f'<p><b>Nota:</b><br>{safe_note}</p>' if admin_note else ''}
        <p>También puedes revisar esta entrega desde tu historial de pedidos en Francho Shop.</p>
        """
        ok = await web_auth.send_email(
            to=email_addr,
            subject=f"{prefix} #{order.get('id')} - Francho Shop",
            html_body=web_auth.email_template("Entrega de tu pedido", body),
        )
        return (True, "") if ok else (False, "SMTP no configurado o envío fallido")
    except Exception as e:
        log.warning("No se pudo enviar entrega por email: %s", e)
        return False, str(e)





class ManualCaseMessageRequest(BaseModel):
    message: str
    is_internal_note: bool = False


class ManualCaseStatusRequest(BaseModel):
    status: str
    message: str = ""


CASE_STATUSES = {"open", "review", "waiting_customer", "waiting_seller", "delivered", "closed", "dispute"}


def clean_case_message(message: str) -> str:
    text = re.sub(r"<[^>]*>", "", str(message or "")).strip()
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    if len(text) > 3000:
        text = text[:3000]
    return text


async def get_case_with_permission(order_id: int, actor_id: int, manager: bool = False) -> tuple[dict, dict, str]:
    order = await db.get_manual_order_by_id(order_id)
    if not order:
        raise HTTPException(404, "Pedido no encontrado")
    role = "customer"
    if manager:
        role = await ensure_manual_manager(actor_id)
        if role == "seller" and int(order.get("product_owner_id") or order.get("seller_id") or 0) != int(actor_id):
            raise HTTPException(403, "No puedes ver casos de otro vendedor")
    elif int(order.get("user_id") or 0) != int(actor_id):
        raise HTTPException(403, "No puedes ver este caso")
    case = await db.get_manual_order_case_by_order(order_id)
    if not case and manager:
        case_id = await db.create_or_get_manual_order_case(order_id, order.get("product_id"), order.get("user_id"), order.get("seller_id") or order.get("product_owner_id"), "Caso creado para seguimiento de entrega.")
        case = await db.get_manual_order_case_by_order(order_id)
    if not case:
        raise HTTPException(404, "Este pedido no tiene caso de entrega")
    return case, order, role


async def notify_case_message_telegram(order_id: int, sender_role: str, text: str):
    import aiohttp
    try:
        # Get order details
        order = await db.get_manual_order_by_id(order_id)
        if not order:
            return
        
        case = await db.get_manual_order_case_by_order(order_id)
        
        # Target chat IDs:
        # If customer sent it, target is the seller and the admins.
        # If seller/admin sent it, target is the customer (order["user_id"]).
        if sender_role == "customer":
            target_ids = []
            seller_id = order.get("seller_id") or order.get("product_owner_id")
            if seller_id:
                target_ids.append(int(seller_id))
            # Also notify admins
            for aid in config.ADMIN_IDS:
                if aid not in target_ids:
                    target_ids.append(aid)
            
            cust_name = (case or {}).get('customer_name') or order.get('customer_name') or 'Cliente'
            message_text = (
                f"💬 <b>Nuevo mensaje del cliente</b>\n"
                f"<b>Pedido:</b> #{order_id} ({order.get('product', 'Producto')})\n"
                f"<b>Cliente:</b> {cust_name}\n"
                f"<b>Mensaje:</b> <i>{text}</i>"
            )
        else:
            # Seller/admin sent it, target is the customer
            target_ids = [int(order["user_id"])]
            message_text = (
                f"💬 <b>Soporte te ha enviado un mensaje:</b>\n"
                f"<b>Pedido:</b> #{order_id} ({order.get('product', 'Producto')})\n"
                f"<b>Mensaje:</b> <i>{text}</i>"
            )
        
        # Send via Telegram API
        async with aiohttp.ClientSession() as session:
            for chat_id in target_ids:
                webapp_url = getattr(config, "WEBAPP_URL", "")
                reply_markup = None
                if webapp_url:
                    url_suffix = f"?case={order_id}&admin=true" if chat_id in config.ADMIN_IDS else f"?case={order_id}"
                    target_url = webapp_url.rstrip("/") + url_suffix
                    reply_markup = {
                        "inline_keyboard": [[
                            {"text": "💬 Abrir chat del pedido", "web_app": {"url": target_url}}
                        ]]
                    }
                
                payload = {
                    "chat_id": chat_id,
                    "text": message_text,
                    "parse_mode": "HTML"
                }
                if reply_markup:
                    payload["reply_markup"] = reply_markup
                    
                try:
                    await session.post(
                        f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage",
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=5)
                    )
                except Exception as ex:
                    log.warning("Error sending Telegram case notify to %s: %s", chat_id, ex)
    except Exception as e:
        log.warning("Error in notify_case_message_telegram: %s", e)


async def public_case_payload(case: dict, messages: list[dict], include_internal: bool = False) -> dict:
    """
    Construye el payload público del caso incluyendo:
    - last_seen del usuario (para indicador En línea)
    - read_at específico del caso (para read receipts ✓✓ azul estilo WhatsApp)
    - status por mensaje: 'sent' | 'delivered' | 'read'
    """
    now = int(time.time())
    online_threshold = 120  # segundos: en línea si activo hace < 2 min
    customer_id = int(case.get("customer_id") or 0)
    seller_id = int(case.get("seller_id") or case.get("product_owner_id") or 0)
    case_id = int(case.get("id") or 0)

    # Obtener last_seen global (para indicador En línea)
    customer_last_seen = 0
    seller_last_seen = 0
    if customer_id:
        cu = await db.get_user(customer_id)
        customer_last_seen = float((cu or {}).get("last_seen") or 0)
    if seller_id:
        su = await db.get_user(seller_id)
        seller_last_seen = float((su or {}).get("last_seen") or 0)

    # Obtener read_at específico del caso (para ✓✓ azul)
    reads = await db.get_case_read_status(case_id) if case_id else {"customer_read_at": 0.0, "seller_read_at": 0.0}
    customer_read_at = float(reads.get("customer_read_at") or 0)
    seller_read_at = float(reads.get("seller_read_at") or 0)

    # Enriquecer mensajes con estado de recibo
    # Reglas (desde el punto de vista de cada mensaje):
    #   sent      → mensaje guardado en servidor
    #   delivered → el destinatario ha abierto la app (last_seen reciente O read_at > 0)
    #   read      → el destinatario abrió ESTE chat (read_at >= created_at del mensaje)
    enriched_messages = []
    for m in messages:
        if include_internal or not m.get("is_internal_note"):
            role = m.get("sender_role", "")
            created_at = float(m.get("created_at") or 0)
            msg = dict(m)

            if role == "customer":
                # Mensaje del cliente → destinatario es el vendedor
                if seller_read_at >= created_at and created_at > 0:
                    msg["receipt"] = "read"        # ✓✓ azul
                elif seller_last_seen > created_at and created_at > 0:
                    msg["receipt"] = "delivered"   # ✓✓ gris
                else:
                    msg["receipt"] = "sent"        # ✓ gris
            elif role in ("seller", "admin"):
                # Mensaje del vendedor/admin → destinatario es el cliente
                if customer_read_at >= created_at and created_at > 0:
                    msg["receipt"] = "read"
                elif customer_last_seen > created_at and created_at > 0:
                    msg["receipt"] = "delivered"
                else:
                    msg["receipt"] = "sent"
            else:
                msg["receipt"] = "sent"  # mensajes del sistema

            enriched_messages.append(msg)

    return {
        "id": case_id,
        "order_id": case.get("order_id"),
        "product_id": case.get("product_id"),
        "product_name": case.get("product_name"),
        "category": case.get("category"),
        "customer_id": customer_id,
        "customer_name": case.get("customer_name"),
        "customer_username": case.get("customer_username"),
        "customer_email": case.get("customer_email"),
        "customer_last_seen": customer_last_seen,
        "customer_read_at": customer_read_at,
        "customer_online": (now - int(customer_last_seen)) < online_threshold if customer_last_seen else False,
        "seller_id": seller_id,
        "seller_name": case.get("seller_name"),
        "seller_username": case.get("seller_username"),
        "seller_email": case.get("seller_email"),
        "seller_store_name": case.get("seller_store_name"),
        "seller_store_slug": case.get("seller_store_slug"),
        "seller_last_seen": seller_last_seen,
        "seller_read_at": seller_read_at,
        "seller_online": (now - int(seller_last_seen)) < online_threshold if seller_last_seen else False,
        "status": case.get("status"),
        "order_status": case.get("order_status"),
        "price": float(case.get("price") or 0),
        "option_name": case.get("option_name"),
        "created_at": case.get("created_at"),
        "updated_at": case.get("updated_at"),
        "closed_at": case.get("closed_at"),
        "messages": enriched_messages,
    }


@app.get("/api/manual-orders/{order_id}/case")
async def customer_manual_order_case(order_id: int, user: dict = Depends(get_current_user)):
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=False)
    # Marcar como leído al abrir el chat (read receipt ✓✓ azul)
    await db.mark_case_read(case["id"], user["id"], "customer")
    messages = await db.get_manual_case_messages(case["id"], include_internal=False)
    return await public_case_payload(case, messages, include_internal=False)


@app.post("/api/manual-orders/{order_id}/case/read")
async def customer_mark_case_read(order_id: int, user: dict = Depends(get_current_user)):
    """Marca el caso como leído por el cliente. Llamar cuando el usuario ve el chat."""
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=False)
    read_at = await db.mark_case_read(case["id"], user["id"], "customer")
    return {"ok": True, "read_at": read_at, "case_id": case["id"]}


@app.post("/api/admin/manual-orders/{order_id}/case/read")
async def admin_mark_case_read(order_id: int, user: dict = Depends(get_current_user)):
    """Marca el caso como leído por el vendedor/admin."""
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=True)
    sender_role = "admin" if role == "admin" else "seller"
    read_at = await db.mark_case_read(case["id"], user["id"], sender_role)
    return {"ok": True, "read_at": read_at, "case_id": case["id"]}


@app.post("/api/manual-orders/{order_id}/case/messages")
async def customer_manual_order_case_message(order_id: int, req: ManualCaseMessageRequest, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=False)
    message = clean_case_message(req.message)
    if not message:
        raise HTTPException(400, "Escribe un mensaje")
    await db.add_manual_case_message(case["id"], order_id, user["id"], "customer", message, False)
    await db.update_manual_order_case_status(case["id"], "waiting_seller")
    await audit_json(user["id"], "manual_order.case_message", "manual_order", order_id, {"case_id": case["id"], "sender_role": "customer"})
    background_tasks.add_task(notify_case_message_telegram, order_id, "customer", message)
    try:
        seller_id = order.get("seller_id") or order.get("product_owner_id")
        if seller_id:
            await db.create_notification(
                user_id=int(seller_id),
                type="new_message",
                title="Nuevo mensaje de cliente",
                message=f"El cliente envió un mensaje en el caso #{order_id}",
                related_order_id=order_id,
                related_case_id=case["id"],
                url=f"/pedido/{order_id}/seguimiento?admin=true"
            )
        for admin_id in config.ADMIN_IDS:
            if admin_id != seller_id:
                await db.create_notification(
                    user_id=int(admin_id),
                    type="new_message",
                    title="Nuevo mensaje de cliente",
                    message=f"Mensaje del cliente en el caso del pedido #{order_id}",
                    related_order_id=order_id,
                    related_case_id=case["id"],
                    url=f"/pedido/{order_id}/seguimiento?admin=true"
                )
    except Exception as ne:
        log.warning("Error creating customer msg notification: %s", ne)
    return await customer_manual_order_case(order_id, user)


@app.post("/api/manual-orders/{order_id}/case/upload")
async def customer_case_upload(order_id: int, background_tasks: BackgroundTasks, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Cliente adjunta imagen o archivo en el chat del caso."""
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=False)
    content_type = (file.content_type or "application/octet-stream").lower()
    allowed_ext = {
        "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
        "image/webp": ".webp", "image/gif": ".gif",
        "text/plain": ".txt", "application/pdf": ".pdf",
        "application/zip": ".zip", "application/x-zip-compressed": ".zip",
        "application/x-rar-compressed": ".rar", "application/vnd.rar": ".rar",
    }
    original = file.filename or "archivo"
    suffix = Path(original).suffix.lower()
    ext = allowed_ext.get(content_type) or (suffix if suffix in {".txt", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".zip", ".rar"} else "")
    if not ext:
        raise HTTPException(400, "Formato no permitido. Usa imágenes, PDF, TXT, ZIP o RAR")
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, "Archivo demasiado grande. Máximo 25 MB")
    safe_name = f"case-{order_id}-{int(time.time())}-{uuid.uuid4().hex[:10]}{ext}"
    (DELIVERY_DIR / safe_name).write_bytes(raw)
    file_url = f"/api/delivery-files/{safe_name}"
    msg_text = f"[Archivo adjunto: {original}]\n{file_url}"
    await db.add_manual_case_message(case["id"], order_id, user["id"], "customer", msg_text, False)
    await db.update_manual_order_case_status(case["id"], "waiting_seller")
    await audit_json(user["id"], "manual_order.case_upload", "manual_order", order_id, {"case_id": case["id"], "filename": original, "size": len(raw)})
    background_tasks.add_task(notify_case_message_telegram, order_id, "customer", f"📎 Archivo adjunto: {original}")
    try:
        seller_id = order.get("seller_id") or order.get("product_owner_id")
        if seller_id:
            await db.create_notification(
                user_id=int(seller_id),
                type="new_message",
                title="Nuevo archivo de cliente",
                message=f"El cliente adjuntó {original} en el caso #{order_id}",
                related_order_id=order_id,
                related_case_id=case["id"],
                url=f"/pedido/{order_id}/seguimiento?admin=true"
            )
        for admin_id in config.ADMIN_IDS:
            if admin_id != seller_id:
                await db.create_notification(
                    user_id=int(admin_id),
                    type="new_message",
                    title="Nuevo archivo de cliente",
                    message=f"El cliente adjuntó {original} en el caso del pedido #{order_id}",
                    related_order_id=order_id,
                    related_case_id=case["id"],
                    url=f"/pedido/{order_id}/seguimiento?admin=true"
                )
    except Exception as ne:
        log.warning("Error creating customer upload notification: %s", ne)
    return await customer_manual_order_case(order_id, user)


@app.get("/api/admin/account-seller-sales")
async def admin_account_seller_sales(seller_id: int | None = None, status: str = "", limit: int = 100, user: dict = Depends(get_current_user)):
    role = await ensure_manual_manager(user["id"])
    effective_seller = None if role == "admin" else int(user["id"])
    if role == "admin" and seller_id:
        effective_seller = int(seller_id)
    sales = await db.list_account_seller_sales(seller_id=effective_seller, status=status or None, limit=limit)
    summary = {
        "orders": len(sales),
        "gross": round(sum(float(s.get("sale_price") or 0) for s in sales), 2),
        "platform_commission": round(sum(float(s.get("platform_commission") or 0) for s in sales), 2),
        "seller_earning": round(sum(float(s.get("seller_earning") or 0) for s in sales), 2),
        "pending": sum(1 for s in sales if s.get("status") == "pending"),
        "completed": sum(1 for s in sales if s.get("status") == "completed"),
    }
    return {"items": sales, "summary": summary, "role": role}


@app.get("/api/admin/account-seller-sales/{order_id}")
async def admin_account_seller_sale_detail(order_id: int, user: dict = Depends(get_current_user)):
    role = await ensure_manual_manager(user["id"])
    sale = await db.get_account_seller_sale(order_id)
    if not sale:
        raise HTTPException(404, "Venta no encontrada")
    if role == "seller" and int(sale.get("seller_id") or 0) != int(user["id"]):
        raise HTTPException(403, "No puedes ver ventas de otro vendedor")
    case = await db.get_manual_order_case_by_order(order_id)
    messages = await db.get_manual_case_messages(case["id"], include_internal=True) if case else []
    audits = [a for a in await db.get_recent_audit(limit=300) if str(a.get("target_id")) in {str(order_id), str(sale.get("product_id")), str(sale.get("seller_id"))}]
    return {"sale": sale, "case": {"id": case.get("id"), "order_id": case.get("order_id"), "status": case.get("status"), "messages": messages, "seller_online": False, "seller_last_seen": 0, "customer_online": False, "customer_last_seen": 0} if case else None, "audit": audits[:80]}


@app.get("/api/admin/manual-order-cases")
async def admin_manual_order_cases(status: str = "", limit: int = 100, user: dict = Depends(get_current_user)):
    role = await ensure_manual_manager(user["id"])
    seller_id = None if role == "admin" else user["id"]
    cases = await db.list_manual_order_cases(status=status or None, seller_id=seller_id, limit=limit)
    return {"items": cases, "role": role}


@app.get("/api/admin/manual-orders/{order_id}/case")
async def admin_manual_order_case(order_id: int, user: dict = Depends(get_current_user)):
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=True)
    sender_role = "admin" if role == "admin" else "seller"
    # Marcar como leído al abrir el chat (read receipt ✓✓ azul)
    await db.mark_case_read(case["id"], user["id"], sender_role)
    messages = await db.get_manual_case_messages(case["id"], include_internal=True)
    return await public_case_payload(case, messages, include_internal=True)


@app.post("/api/admin/manual-orders/{order_id}/case/messages")
async def admin_manual_order_case_message(order_id: int, req: ManualCaseMessageRequest, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=True)
    message = clean_case_message(req.message)
    if not message:
        raise HTTPException(400, "Escribe un mensaje")
    sender_role = "admin" if role == "admin" else "seller"
    await db.add_manual_case_message(case["id"], order_id, user["id"], sender_role, message, bool(req.is_internal_note))
    if not req.is_internal_note:
        await db.update_manual_order_case_status(case["id"], "waiting_customer")
        background_tasks.add_task(notify_case_message_telegram, order_id, sender_role, message)
        try:
            await db.create_notification(
                user_id=int(order["user_id"]),
                type="new_message",
                title="Nuevo mensaje de soporte",
                message=f"Soporte te envió un mensaje sobre tu pedido #{order_id}",
                related_order_id=order_id,
                related_case_id=case["id"],
                url=f"/pedido/{order_id}/seguimiento"
            )
        except Exception as ne:
            log.warning("Error creating admin msg notification: %s", ne)
    await audit_json(user["id"], "manual_order.case_message", "manual_order", order_id, {"case_id": case["id"], "sender_role": sender_role, "internal": bool(req.is_internal_note)})
    return await admin_manual_order_case(order_id, user)


@app.post("/api/admin/manual-orders/{order_id}/case/upload")
async def admin_case_upload(order_id: int, background_tasks: BackgroundTasks, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Vendedor/admin adjunta imagen o archivo en el chat del caso."""
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=True)
    content_type = (file.content_type or "application/octet-stream").lower()
    allowed_ext = {
        "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
        "image/webp": ".webp", "image/gif": ".gif",
        "text/plain": ".txt", "application/pdf": ".pdf",
        "application/zip": ".zip", "application/x-zip-compressed": ".zip",
        "application/x-rar-compressed": ".rar", "application/vnd.rar": ".rar",
    }
    original = file.filename or "archivo"
    suffix = Path(original).suffix.lower()
    ext = allowed_ext.get(content_type) or (suffix if suffix in {".txt", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".zip", ".rar"} else "")
    if not ext:
        raise HTTPException(400, "Formato no permitido. Usa imágenes, PDF, TXT, ZIP o RAR")
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, "Archivo demasiado grande. Máximo 25 MB")
    safe_name = f"case-{order_id}-{int(time.time())}-{uuid.uuid4().hex[:10]}{ext}"
    (DELIVERY_DIR / safe_name).write_bytes(raw)
    file_url = f"/api/delivery-files/{safe_name}"
    sender_role = "admin" if role == "admin" else "seller"
    msg_text = f"[Archivo adjunto: {original}]\n{file_url}"
    await db.add_manual_case_message(case["id"], order_id, user["id"], sender_role, msg_text, False)
    await db.update_manual_order_case_status(case["id"], "waiting_customer")
    await audit_json(user["id"], "manual_order.case_upload", "manual_order", order_id, {"case_id": case["id"], "filename": original, "size": len(raw), "role": sender_role})
    background_tasks.add_task(notify_case_message_telegram, order_id, sender_role, f"📎 Archivo adjunto: {original}")
    try:
        await db.create_notification(
            user_id=int(order["user_id"]),
            type="new_message",
            title="Nuevo archivo de soporte",
            message=f"Soporte adjuntó {original} sobre tu pedido #{order_id}",
            related_order_id=order_id,
            related_case_id=case["id"],
            url=f"/pedido/{order_id}/seguimiento"
        )
    except Exception as ne:
        log.warning("Error creating admin upload notification: %s", ne)
    return await admin_manual_order_case(order_id, user)


@app.post("/api/admin/manual-orders/{order_id}/case/status")
async def admin_manual_order_case_status(order_id: int, req: ManualCaseStatusRequest, user: dict = Depends(get_current_user)):
    case, order, role = await get_case_with_permission(order_id, user["id"], manager=True)
    status = str(req.status or "").strip()
    if status not in CASE_STATUSES:
        raise HTTPException(400, "Estado de caso inválido")
    await db.update_manual_order_case_status(case["id"], status, actor_id=user["id"], note=clean_case_message(req.message))
    try:
        # Notificar cambio de estado del caso al cliente y vendedor
        seller_id = order.get("seller_id") or order.get("product_owner_id")
        status_label = statusLabels.get(status, status)
        
        # Al cliente
        await db.create_notification(
            user_id=int(order["user_id"]),
            type="case_status",
            title=f"Estado del caso: {status_label}",
            message=f"El caso de tu pedido #{order_id} ha cambiado al estado '{status_label}'.",
            related_order_id=order_id,
            related_case_id=case["id"],
            url=f"/pedido/{order_id}/seguimiento"
        )
        # Al vendedor
        if seller_id and int(user["id"]) != int(seller_id):
            await db.create_notification(
                user_id=int(seller_id),
                type="case_status",
                title=f"Estado del caso: {status_label}",
                message=f"El caso de tu venta #{order_id} ha cambiado al estado '{status_label}'.",
                related_order_id=order_id,
                related_case_id=case["id"],
                url=f"/pedido/{order_id}/seguimiento?admin=true"
            )
    except Exception as ne:
        log.warning("Error creating case status change notification: %s", ne)
    await audit_json(user["id"], "manual_order.case_status", "manual_order", order_id, {"case_id": case["id"], "status": status, "role": role})
    return await admin_manual_order_case(order_id, user)

@app.post("/api/admin/manual-orders/{order_id}/complete")
async def admin_complete_manual_order(order_id: int, req: CompleteManualOrder,
                                       user: dict = Depends(get_current_user)):
    """Admin: completar un pedido manual y notificar al cliente."""
    role = await ensure_manual_manager(user["id"])
    if role == "seller":
        seller_orders = await db.get_manual_orders(seller_id=user["id"], limit=10000)
        if not any(o["id"] == order_id for o in seller_orders):
            raise HTTPException(403, "No puedes completar ventas de otro vendedor")
    await db.complete_manual_order(order_id, req.delivery_data, req.admin_note, completed_by=user["id"], event_type="manual_completed")
    await db.update_account_seller_sale_status(order_id, "completed", completed_at=time.time())
    case = await db.get_manual_order_case_by_order(order_id)
    if case:
        await db.add_manual_case_message(case["id"], order_id, user["id"], "admin" if role == "admin" else "seller", req.delivery_data, False)
        if req.admin_note:
            await db.add_manual_case_message(case["id"], order_id, user["id"], "admin" if role == "admin" else "seller", req.admin_note, True)
        await db.update_manual_order_case_status(case["id"], "delivered")
    await audit_json(user["id"], "manual_order.complete", "manual_order", order_id, {"with_file": False, "role": role})

    # Notificar al cliente por Telegram
    try:
        import aiohttp
        orders = await db.get_manual_orders()
        order = next((o for o in orders if o["id"] == order_id), None)
        if order and order.get("user_id", 0) > 0:
            client_text = build_order_ficha_html(
                order.get('product_name', '?'),
                order_id,
                float(order.get('price', 0)),
                headline="✅ <b>¡Tu pedido ha sido procesado!</b>",
                status_label="Completado manualmente",
                detail_label="Datos de entrega",
                detail_value=req.delivery_data,
                note=req.admin_note,
            )

            async with aiohttp.ClientSession() as session:
                await session.post(
                    f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage",
                    json={"chat_id": order["user_id"], "text": client_text, "parse_mode": "HTML"},
                    timeout=aiohttp.ClientTimeout(total=5),
                )
            try:
                await db.create_notification(
                    user_id=int(order["user_id"]),
                    type="order_status",
                    title="¡Pedido entregado!",
                    message=f"Tu pedido #{order_id} ha sido entregado. Revisa los datos de entrega.",
                    related_order_id=order_id,
                    related_case_id=case["id"] if case else None,
                    url=f"/pedido/{order_id}/seguimiento"
                )
            except Exception as ne:
                log.warning("Error creating order complete notification: %s", ne)
    except Exception as e:
        log.warning("No se pudo notificar al cliente: %s", e)

    order_for_email = await db.get_manual_order_by_id(order_id)
    if order_for_email:
        email_ok, email_err = await notify_manual_order_delivery_email(order_for_email, req.delivery_data, req.admin_note, prefix="Entrega de tu pedido")
        await db.add_delivery_event(order_id, "email_notified", user["id"], req.delivery_data, req.admin_note, "ok" if email_ok else "failed", email_err)

    return {"ok": True, "message": f"Pedido #{order_id} completado y cliente notificado"}


@app.post("/api/admin/manual-orders/{order_id}/complete-with-file")
async def admin_complete_manual_order_with_file(
    order_id: int,
    delivery_data: str = "",
    admin_note: str = "",
    file: UploadFile | None = File(None),
    user: dict = Depends(get_current_user),
):
    """Completa pedido manual y guarda texto/archivo para web, chat, Telegram y email."""
    role = await ensure_manual_manager(user["id"])
    if role == "seller":
        seller_orders = await db.get_manual_orders(seller_id=user["id"], limit=10000)
        if not any(o["id"] == order_id for o in seller_orders):
            raise HTTPException(403, "No puedes completar ventas de otro vendedor")
    if not delivery_data.strip() and not file:
        raise HTTPException(400, "Escribe datos de entrega o adjunta un archivo")

    file_raw = None
    file_url = ""
    file_name = ""
    file_mime = ""
    if file:
        file_raw, file_url, file_name, file_mime = await save_manual_delivery_upload(file)

    final_delivery_data = append_delivery_file_link(delivery_data, file_url, file_name)
    await db.complete_manual_order(order_id, final_delivery_data, admin_note, completed_by=user["id"], event_type="manual_completed_file" if file else "manual_completed")
    await db.update_account_seller_sale_status(order_id, "completed", completed_at=time.time())
    if file_url:
        await db.add_delivery_event(order_id, "delivery_file_saved", user["id"], file_url, file_name, "ok", "")

    case = await db.get_manual_order_case_by_order(order_id)
    if case:
        if final_delivery_data.strip():
            await db.add_manual_case_message(case["id"], order_id, user["id"], "admin" if role == "admin" else "seller", final_delivery_data, False)
        if admin_note.strip():
            await db.add_manual_case_message(case["id"], order_id, user["id"], "admin" if role == "admin" else "seller", admin_note, True)
        await db.update_manual_order_case_status(case["id"], "delivered")
    await audit_json(user["id"], "manual_order.complete", "manual_order", order_id, {"with_file": bool(file), "file_url": file_url, "role": role})

    telegram_ok = False
    telegram_err = ""
    try:
        import aiohttp
        order = await db.get_manual_order_by_id(order_id)
        if order and order.get("user_id", 0) > 0:
            product_title = order.get("product_name", "?")
            if order.get("option_name"):
                product_title += " - " + order.get("option_name")
            client_text = build_order_ficha_html(
                product_title,
                order_id,
                float(order.get('price', 0)),
                headline="✅ <b>¡Tu pedido ha sido procesado!</b>",
                status_label="Completado manualmente",
                detail_label="Datos de entrega",
                detail_value=final_delivery_data,
                note=admin_note,
            )

            async with aiohttp.ClientSession() as session:
                if file and file_raw is not None:
                    is_image = (file_mime or "").startswith("image/")
                    endpoint = "sendPhoto" if is_image else "sendDocument"
                    field_name = "photo" if is_image else "document"
                    short_caption = (
                        f"✅ <b>Archivo de entrega</b>\n"
                        f"📦 <b>{html.escape(product_title)}</b>\n"
                        f"🆔 Pedido: <code>#{order_id}</code>\n"
                        f"La ficha completa fue enviada en el siguiente mensaje."
                    )
                    form = aiohttp.FormData()
                    form.add_field("chat_id", str(order["user_id"]))
                    form.add_field("caption", short_caption)
                    form.add_field("parse_mode", "HTML")
                    form.add_field(field_name, file_raw, filename=file_name or "entrega", content_type=file_mime or "application/octet-stream")
                    media_resp = await session.post(
                        f"https://api.telegram.org/bot{config.BOT_TOKEN}/{endpoint}",
                        data=form,
                        timeout=aiohttp.ClientTimeout(total=90),
                    )
                    media_ok = media_resp.status < 400
                    media_err = "" if media_ok else await media_resp.text()
                    msg_resp = await session.post(
                        f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage",
                        json={"chat_id": order["user_id"], "text": client_text, "parse_mode": "HTML"},
                        timeout=aiohttp.ClientTimeout(total=8),
                    )
                    msg_ok = msg_resp.status < 400
                    msg_err = "" if msg_ok else await msg_resp.text()
                    telegram_ok = media_ok and msg_ok
                    telegram_err = "; ".join(x for x in [media_err, msg_err] if x)
                else:
                    resp = await session.post(
                        f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage",
                        json={"chat_id": order["user_id"], "text": client_text, "parse_mode": "HTML"},
                        timeout=aiohttp.ClientTimeout(total=8),
                    )
                    telegram_ok = resp.status < 400
                    telegram_err = "" if telegram_ok else await resp.text()
    except Exception as e:
        telegram_err = str(e)
        log.warning("No se pudo notificar al cliente con archivo: %s", e)
    await db.add_delivery_event(order_id, "telegram_notified", user["id"], final_delivery_data, admin_note, "ok" if telegram_ok else "failed", telegram_err)
    try:
        if order and order.get("user_id", 0) > 0:
            await db.create_notification(
                user_id=int(order["user_id"]),
                type="order_status",
                title="¡Pedido entregado!",
                message=f"Tu pedido #{order_id} ha sido entregado. Revisa los datos de entrega.",
                related_order_id=order_id,
                related_case_id=case["id"] if case else None,
                url=f"/pedido/{order_id}/seguimiento"
            )
    except Exception as ne:
        log.warning("Error creating order complete with file notification: %s", ne)

    order_for_email = await db.get_manual_order_by_id(order_id)
    if order_for_email:
        email_ok, email_err = await notify_manual_order_delivery_email(order_for_email, final_delivery_data, admin_note, prefix="Entrega de tu pedido")
        await db.add_delivery_event(order_id, "email_notified", user["id"], final_delivery_data, admin_note, "ok" if email_ok else "failed", email_err)

    return {"ok": True, "message": f"Pedido #{order_id} completado. Entrega guardada y notificaciones procesadas", "delivery_data": final_delivery_data, "file_url": file_url}


@app.get("/api/admin/manual-orders/{order_id}")
async def admin_manual_order_detail(order_id: int, user: dict = Depends(get_current_user)):
    role, order = await assert_can_manage_manual_order(user["id"], order_id)
    order["customer_data"] = json.loads(order.get("customer_data") or "{}")
    order["delivery_events"] = await db.get_delivery_events(order_id)
    case = await db.get_manual_order_case_by_order(order_id)
    if case:
        case["messages"] = await db.get_manual_case_messages(case["id"], include_internal=True)
    order["case"] = case
    sale = await db.get_account_seller_sale(order_id)
    if sale:
        order["account_sale"] = sale
        order["account_sale_audit"] = [a for a in await db.get_recent_audit(limit=300) if str(a.get("target_id")) in {str(order_id), str(order.get("product_id")), str(sale.get("seller_id"))}][:80]
    return order


@app.post("/api/admin/manual-orders/{order_id}/refund")
async def admin_refund_manual_order(order_id: int, req: OrderAdminActionRequest, user: dict = Depends(get_current_user)):
    role, order = await assert_can_manage_manual_order(user["id"], order_id)
    if order.get("status") == "refunded":
        raise HTTPException(400, "Este pedido ya fue reembolsado")
    if order.get("status") == "canceled":
        raise HTTPException(400, "Este pedido ya fue cancelado")
    amount = round(float(order.get("price") or 0), 2)
    if amount <= 0:
        raise HTTPException(400, "Monto inválido para reembolso")
    await db.add_balance(order["user_id"], amount, "refund", str(order_id), req.reason or "Reembolso de pedido manual")
    await db.void_seller_sale_hold(order_id, req.reason or "Pedido manual reembolsado")
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("UPDATE manual_orders SET status='refunded', admin_note=? WHERE id=?", (req.reason or "Reembolsado desde panel", order_id))
        await conn.commit()
    await db.add_delivery_event(order_id, "refunded", user["id"], "", req.reason or "Reembolso", "ok", "")
    await db.update_account_seller_sale_status(order_id, "refunded")
    case = await db.get_manual_order_case_by_order(order_id)
    try:
        # Notificación al cliente
        await db.create_notification(
            user_id=int(order["user_id"]),
            type="order_status",
            title="Pedido reembolsado",
            message=f"Tu pedido #{order_id} ha sido reembolsado y el saldo devuelto a tu cuenta.",
            related_order_id=order_id,
            url=f"/pedido/{order_id}/seguimiento"
        )
        # Al vendedor
        seller_id = order.get("seller_id") or order.get("product_owner_id")
        if seller_id:
            await db.create_notification(
                user_id=int(seller_id),
                type="order_status",
                title="Venta reembolsada",
                message=f"La venta del pedido #{order_id} ha sido reembolsada y anulada.",
                related_order_id=order_id,
                url=f"/pedido/{order_id}/seguimiento?admin=true"
            )
    except Exception as ne:
        log.warning("Error creating refund order notification: %s", ne)
    if case:
        await db.update_manual_order_case_status(case["id"], "closed", actor_id=user["id"], note=req.reason or "Pedido reembolsado")
    await audit_json(user["id"], "manual_order.refund", "manual_order", order_id, {"role": role, "amount": amount, "reason": req.reason})
    return {"ok": True, "message": "Pedido reembolsado", "amount": amount}


@app.post("/api/admin/manual-orders/{order_id}/cancel")
async def admin_cancel_manual_order(order_id: int, req: OrderAdminActionRequest, user: dict = Depends(get_current_user)):
    role, order = await assert_can_manage_manual_order(user["id"], order_id)
    if not req.reason or not req.reason.strip():
        raise HTTPException(400, "El motivo de la cancelación es obligatorio")
    if order.get("status") in ("completed", "refunded", "revoked"):
        raise HTTPException(400, "No se puede cancelar un pedido completado, reembolsado o revocado")
    amount = round(float(order.get("price") or 0), 2)
    await db.add_balance(order["user_id"], amount, "refund", str(order_id), req.reason)
    await db.void_seller_sale_hold(order_id, req.reason)
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("UPDATE manual_orders SET status='canceled', admin_note=? WHERE id=?", (req.reason, order_id))
        await conn.commit()
    await db.add_delivery_event(order_id, "canceled", user["id"], "", req.reason, "ok", "")
    await db.update_account_seller_sale_status(order_id, "canceled")
    case = await db.get_manual_order_case_by_order(order_id)
    try:
        # Notificación al cliente
        await db.create_notification(
            user_id=int(order["user_id"]),
            type="order_status",
            title="Pedido cancelado",
            message=f"Tu pedido #{order_id} ha sido cancelado y el saldo devuelto a tu cuenta.",
            related_order_id=order_id,
            url=f"/pedido/{order_id}/seguimiento"
        )
        # Al vendedor
        seller_id = order.get("seller_id") or order.get("product_owner_id")
        if seller_id:
            await db.create_notification(
                user_id=int(seller_id),
                type="order_status",
                title="Venta cancelada",
                message=f"La venta del pedido #{order_id} ha sido cancelada.",
                related_order_id=order_id,
                url=f"/pedido/{order_id}/seguimiento?admin=true"
            )
    except Exception as ne:
        log.warning("Error creating cancel order notification: %s", ne)
    if case:
        await db.update_manual_order_case_status(case["id"], "closed", actor_id=user["id"], note=req.reason)
    await audit_json(user["id"], "manual_order.cancel", "manual_order", order_id, {"role": role, "amount": amount, "reason": req.reason})
    return {"ok": True, "message": "Pedido cancelado y saldo devuelto", "amount": amount}


@app.get("/api/admin/manual-orders/{order_id}/delivery-events")
async def admin_order_delivery_events(order_id: int, user: dict = Depends(get_current_user)):
    await assert_can_manage_manual_order(user["id"], order_id)
    return await db.get_delivery_events(order_id)


@app.post("/api/admin/manual-orders/{order_id}/resend-delivery")
async def admin_resend_delivery(order_id: int, user: dict = Depends(get_current_user)):
    role, order = await assert_can_manage_manual_order(user["id"], order_id)
    if not order.get("delivery_data"):
        raise HTTPException(400, "Este pedido no tiene entrega guardada")
    # Telegram
    ok, err = await notify_manual_order_delivery(order, order.get("delivery_data") or "", order.get("admin_note") or "", prefix="✅ <b>Reenvío de entrega</b>")
    await db.add_delivery_event(order_id, "resent", user["id"], order.get("delivery_data") or "", order.get("admin_note") or "", "ok" if ok else "failed", err)
    
    # Email/Gmail
    email_ok, email_err = await notify_manual_order_delivery_email(order, order.get("delivery_data") or "", order.get("admin_note") or "", prefix="Reenvío de entrega")
    await db.add_delivery_event(order_id, "email_notified", user["id"], order.get("delivery_data") or "", order.get("admin_note") or "", "ok" if email_ok else "failed", email_err)
    
    await audit_json(user["id"], "manual_order.delivery_resend", "manual_order", order_id, {"role": role, "ok": ok, "email_ok": email_ok})
    return {"ok": True, "message": "Entrega reenviada", "telegram_notified": ok, "email_notified": email_ok}


@app.post("/api/admin/manual-orders/{order_id}/change-delivery")
async def admin_change_delivery(order_id: int, req: DeliveryChangeRequest, user: dict = Depends(get_current_user)):
    role, order = await assert_can_manage_manual_order(user["id"], order_id)
    if not req.delivery_data.strip():
        raise HTTPException(400, "Escribe la nueva entrega")
    await db.update_manual_order_delivery(order_id, req.delivery_data, req.admin_note, actor_id=user["id"])
    updated = await db.get_manual_order_by_id(order_id)
    
    # Telegram
    ok, err = await notify_manual_order_delivery(updated, req.delivery_data, req.admin_note, prefix="✅ <b>Entrega actualizada</b>")
    if not ok:
        await db.add_delivery_event(order_id, "change_notify_failed", user["id"], req.delivery_data, req.admin_note, "failed", err)
        
    # Email/Gmail
    email_ok, email_err = await notify_manual_order_delivery_email(updated, req.delivery_data, req.admin_note, prefix="Actualización de tu pedido")
    await db.add_delivery_event(order_id, "email_notified", user["id"], req.delivery_data, req.admin_note, "ok" if email_ok else "failed", email_err)
    
    await audit_json(user["id"], "manual_order.delivery_change", "manual_order", order_id, {"role": role, "notified": ok, "email_notified": email_ok})
    return {"ok": True, "message": "Entrega cambiada", "notified": ok, "email_notified": email_ok}


@app.post("/api/admin/manual-orders/{order_id}/email-notify")
async def admin_email_notify_delivery(order_id: int, user: dict = Depends(get_current_user)):
    role, order = await assert_can_manage_manual_order(user["id"], order_id)
    if not order.get("delivery_data"):
        raise HTTPException(400, "Este pedido no tiene entrega guardada")
    
    email_ok, email_err = await notify_manual_order_delivery_email(order, order.get("delivery_data") or "", order.get("admin_note") or "", prefix="Notificación de tu pedido")
    await db.add_delivery_event(order_id, "email_notified_manually", user["id"], order.get("delivery_data") or "", order.get("admin_note") or "", "ok" if email_ok else "failed", email_err)
    
    await audit_json(user["id"], "manual_order.delivery_email_notify", "manual_order", order_id, {"role": role, "ok": email_ok})
    if not email_ok:
        raise HTTPException(502, f"No se pudo enviar correo: {email_err}")
    return {"ok": True, "message": "Notificación por correo enviada con éxito"}


@app.post("/api/admin/manual-orders/{order_id}/revoke-delivery")
async def admin_revoke_delivery(order_id: int, req: DeliveryRevokeRequest, user: dict = Depends(get_current_user)):
    role, order = await assert_can_manage_manual_order(user["id"], order_id)
    reason = req.reason or "Entrega revocada desde panel"
    await db.revoke_manual_order_delivery(order_id, actor_id=user["id"], reason=reason)
    await audit_json(user["id"], "manual_order.delivery_revoke", "manual_order", order_id, {"role": role, "reason": reason})
    return {"ok": True, "message": "Entrega revocada"}


# ══════════════════════════════════════
#  NOTIFICACIONES (FASE 1)
# ══════════════════════════════════════

@app.get("/api/notifications")
async def get_notifications(limit: int = 50, user: dict = Depends(get_current_user)):
    """Obtiene las notificaciones para el usuario autenticado."""
    notifs = await db.list_notifications(user["id"], limit=limit)
    return {"items": notifs}


@app.get("/api/notifications/unread-count")
async def get_unread_notifications_count(user: dict = Depends(get_current_user)):
    """Obtiene el conteo de notificaciones no leídas del usuario."""
    count = await db.count_unread_notifications(user["id"])
    return {"count": count}


@app.post("/api/notifications/{notification_id}/read")
async def mark_single_notification_read(notification_id: int, user: dict = Depends(get_current_user)):
    """Marca una notificación como leída."""
    await db.mark_notification_read(notification_id, user["id"])
    return {"ok": True}


@app.post("/api/notifications/read-all")
async def mark_all_notifications_read_endpoint(user: dict = Depends(get_current_user)):
    """Marca todas las notificaciones del usuario como leídas."""
    await db.mark_all_notifications_read(user["id"])
    return {"ok": True}


@app.get("/api/my-manual-orders")
async def my_manual_orders(user: dict = Depends(get_current_user)):
    """Pedidos manuales del usuario actual."""
    orders = await db.get_manual_orders(user_id=user["id"])
    reviews = await db.get_reviews_for_user(user["id"])
    order_cases = {int(c.get("order_id")): c for c in await db.list_manual_order_cases(customer_id=user["id"], limit=500)}
    result = []
    for o in orders:
        account_images = []
        try:
            raw_images = o.get("account_images")
            parsed_images = json.loads(raw_images) if raw_images else []
            if isinstance(parsed_images, list):
                account_images = [str(x) for x in parsed_images if x]
        except Exception:
            account_images = []
        icon_url = o.get("icon_url") or (account_images[0] if account_images else None)
        seller_id = o.get("seller_id") or o.get("product_owner_id")
        result.append({
            "id": o["id"],
            "product": o.get("product_name", ""),
            "option_name": o.get("option_name"),
            "customer_data": json.loads(o.get("customer_data") or "{}"),
            "category": o.get("category", ""),
            "price": float(o.get("price", 0)),
            "status": o.get("status", "pending"),
            "delivery_data": o.get("delivery_data") if o.get("status") == "completed" else None,
            "delivery_type": o.get("delivery_type"),
            "admin_note": o.get("admin_note") if o.get("status") == "completed" else None,
            "created_at": o.get("created_at", 0),
            "completed_at": o.get("completed_at"),
            "case_id": (order_cases.get(int(o["id"])) or {}).get("id"),
            "case_status": (order_cases.get(int(o["id"])) or {}).get("status"),
            "icon_url": icon_url,
            "account_images": account_images,
            "seller_id": seller_id,
            "seller_name": o.get("seller_name"),
            "seller_username": o.get("seller_username"),
            "seller_store_name": o.get("seller_store_name") or ("Francho Shop" if not seller_id else None),
            "seller_store_slug": o.get("seller_store_slug"),
            "seller_store_image": o.get("seller_store_image"),
            "type": "manual",
        })
    return result
