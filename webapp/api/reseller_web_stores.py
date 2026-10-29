"""
Módulo de Tiendas Web para Revendedores (Multi-Tenant White-Label).
Permite a cualquier revendedor crear, personalizar y suscribirse a su propia tienda web.
Planes:
- Básico: $1.99/mes ($19.90/año)
- Plata: $4.99/mes ($49.90/año)
- Pro: $9.99/mes ($99.90/año)
"""
import re
import time
import json
import random
import asyncio
import logging
from typing import Optional, Union, Any
import aiohttp
import aiosqlite
import uuid
import os
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, UploadFile, File
from pydantic import BaseModel, Field

import database as db
try:
    import config
except ImportError:
    from ... import config
try:
    from auth import get_current_user, get_current_user_optional
except ImportError:
    from webapp.api.auth import get_current_user, get_current_user_optional

try:
    from web_auth import send_email, send_email_ex
except ImportError:
    try:
        from webapp.api.web_auth import send_email, send_email_ex
    except ImportError:
        async def send_email(*args, **kwargs): return False
        async def send_email_ex(*args, **kwargs): return False, "Módulo de correo no disponible"

try:
    from webapp.api.fivesim_client import fivesim
except ImportError:
    try:
        from fivesim_client import fivesim
    except ImportError:
        fivesim = None

log = logging.getLogger("gamestore.web_stores")


async def provision_subdomain_ssl(slug: str):
    """Agrega el nuevo subdominio al certificado SSL de Let's Encrypt en segundo plano."""
    if not slug or len(slug) < 3 or not re.match(r"^[a-z0-9-]+$", slug):
        return
    domain = f"{slug}.franchoshop.com"
    try:
        log.info(f"Provisionando certificado SSL para {domain}...")
        proc = await asyncio.create_subprocess_exec(
            "sudo", "certbot", "certonly",
            "--webroot", "-w", "/home/ubuntu/gamestore/webapp/frontend/dist",
            "-d", "franchoshop.com", "-d", "www.franchoshop.com", "-d", domain,
            "--expand", "--non-interactive",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            log.info(f"Certificado SSL emitido con éxito para {domain}. Recargando Nginx...")
            reload_proc = await asyncio.create_subprocess_exec(
                "sudo", "systemctl", "reload", "nginx"
            )
            await reload_proc.communicate()
        else:
            log.warning(f"Certbot no pudo agregar {domain}: {stderr.decode()[:200]}")
    except Exception as e:
        log.error(f"Error provisionando SSL para {domain}: {e}")


async def provision_custom_domain_ssl(domain: str):
    """Agrega un dominio propio (.com, .shop, etc.) al certificado SSL de Let's Encrypt."""
    if not domain or len(domain) < 4 or "." not in domain or "/" in domain:
        return
    clean_domain = domain.strip().lower()
    try:
        log.info(f"Provisionando certificado SSL para dominio propio {clean_domain}...")
        proc = await asyncio.create_subprocess_exec(
            "sudo", "certbot", "certonly",
            "--webroot", "-w", "/home/ubuntu/gamestore/webapp/frontend/dist",
            "-d", clean_domain,
            "--expand", "--non-interactive", "--agree-tos", "--register-unsafely-without-email",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            log.info(f"Certificado SSL emitido con éxito para {clean_domain}. Recargando Nginx...")
            reload_proc = await asyncio.create_subprocess_exec(
                "sudo", "systemctl", "reload", "nginx"
            )
            await reload_proc.communicate()
        else:
            log.warning(f"Certbot no pudo emitir SSL para dominio {clean_domain}: {stderr.decode()[:200]}")
    except Exception as e:
        log.error(f"Error provisionando SSL para dominio propio {clean_domain}: {e}")


router = APIRouter(prefix="/api", tags=["Reseller Web Stores"])

RESERVED_SLUGS = {
    "www", "api", "admin", "panel", "b2b", "francho", "franchoshop",
    "bot", "mail", "ftp", "staging", "dev", "app", "auth", "checkout",
    "login", "register", "canjear", "docs", "help", "soporte", "blog"
}

def normalize_store_identifier(identifier: str) -> str:
    """Limpia el identificador eliminando sufijos de dominio oficial o subdominios neutrales."""
    clean = (identifier or "").strip().lower()
    for suffix in [".topupsh.com", ".franchoshop.com"]:
        if clean.endswith(suffix):
            clean = clean[:-len(suffix)].rstrip(".")
            break
    return clean.strip()


PLANS_CONFIG = {
    "bronce": {
        "id": "bronce",
        "name": "Plan Bronce (Tienda Web)",
        "badge": "Emprendedor",
        "price_monthly": 1.99,
        "price_yearly": 19.99,
        "cycles": {
            "1_month": {"name": "1 Mes", "days": 30, "price": 1.99, "discount_pct": 0, "badge": ""},
            "3_months": {"name": "3 Meses", "days": 90, "price": 5.67, "discount_pct": 5, "badge": "5% OFF"},
            "6_months": {"name": "6 Meses", "days": 180, "price": 10.75, "discount_pct": 10, "badge": "10% OFF"},
            "12_months": {"name": "12 Meses", "days": 365, "price": 19.99, "discount_pct": 16, "badge": "2 Meses Gratis 🔥"}
        },
        "tier_markup": 14.0,
        "features": [
            "Tienda Web Oficial con subdominio (tunegocio.franchoshop.com)",
            "Precios Mayoristas Nivel Bronce (+14% sobre costo base)",
            "Pasarela OxaPay USDT automática y WhatsApp Checkout",
            "Catálogo completo sincronizado con entregas automáticas",
            "Modo Dueño para personalizar tu tienda en vivo",
            "Notificaciones por Correo Gmail (SMTP propio)",
            "Soporte estándar"
        ],
        "allowed_features": {
            "custom_domain": False,
            "vip_subdomain": False,
            "telegram_bot": False,
            "sms_catalog": False,
            "custom_products": False,
            "verified_badge": False,
            "priority_support": False
        }
    },
    "plata": {
        "id": "plata",
        "name": "Plan Plata (Tienda + Mini App)",
        "badge": "Más Popular",
        "price_monthly": 3.49,
        "price_yearly": 34.99,
        "cycles": {
            "1_month": {"name": "1 Mes", "days": 30, "price": 3.49, "discount_pct": 0, "badge": ""},
            "3_months": {"name": "3 Meses", "days": 90, "price": 9.95, "discount_pct": 5, "badge": "5% OFF"},
            "6_months": {"name": "6 Meses", "days": 180, "price": 18.85, "discount_pct": 10, "badge": "10% OFF"},
            "12_months": {"name": "12 Meses", "days": 365, "price": 34.99, "discount_pct": 16, "badge": "2 Meses Gratis 🔥"}
        },
        "tier_markup": 10.0,
        "features": [
            "Todo lo del Plan Bronce",
            "Precios Mayoristas Nivel Plata (+10% sobre costo base - Ahorras 4%)",
            "Mini App de Telegram vinculada a tu propio Bot (@BotFather)",
            "Apertura automática en 1-Click dentro de Telegram (URL 100% invisible)",
            "Catálogo de Números Virtuales (SMS 5sim para WhatsApp, ChatGPT, etc.)",
            "Venta de Cuentas y Productos Manuales Propios",
            "Insignia de Tienda Verificada",
            "Soporte prioritario"
        ],
        "allowed_features": {
            "custom_domain": False,
            "vip_subdomain": False,
            "telegram_bot": True,
            "sms_catalog": True,
            "custom_products": True,
            "verified_badge": True,
            "priority_support": True
        }
    },
    "oro": {
        "id": "oro",
        "name": "Plan Oro VIP (Marca Blanca Total)",
        "badge": "Máxima Ganancia",
        "price_monthly": 7.99,
        "price_yearly": 79.99,
        "cycles": {
            "1_month": {"name": "1 Mes", "days": 30, "price": 7.99, "discount_pct": 0, "badge": ""},
            "3_months": {"name": "3 Meses", "days": 90, "price": 22.77, "discount_pct": 5, "badge": "5% OFF"},
            "6_months": {"name": "6 Meses", "days": 180, "price": 43.15, "discount_pct": 10, "badge": "10% OFF"},
            "12_months": {"name": "12 Meses", "days": 365, "price": 79.99, "discount_pct": 16, "badge": "2 Meses Gratis 🔥"}
        },
        "tier_markup": 7.0,
        "vip_subdomain_host": "topupsh.com",
        "features": [
            "Todo lo del Plan Plata",
            "Precios de Costo VIP Mínimo (+7% sobre costo base - Máxima Ganancia)",
            "⭐ Subdominio Neutral VIP Incluido: tunegocio.topupsh.com (Sin Francho Shop)",
            "⭐ Soporte de Dominio Propio (.com, .shop, etc.)",
            "Certificado SSL HTTPS Let's Encrypt automático incluido",
            "Banner Hero y personalización visual avanzada",
            "Insignia de Tienda Verificada Oro",
            "Soporte VIP Directo"
        ],
        "allowed_features": {
            "custom_domain": True,
            "vip_subdomain": True,
            "telegram_bot": True,
            "sms_catalog": True,
            "custom_products": True,
            "verified_badge": True,
            "priority_support": True,
            "vip_support": True
        }
    }
}

# Aliases de compatibilidad para tiendas existentes en base de datos
PLANS_CONFIG["basico"] = PLANS_CONFIG["bronce"]
PLANS_CONFIG["pro"] = PLANS_CONFIG["oro"]
PLANS_CONFIG["tienda_pro"] = PLANS_CONFIG["oro"]


def get_store_tier_markup_pct(store: dict) -> float:
    """Devuelve el markup base que Francho Shop aplica según el plan de la tienda."""
    plan_key = (store.get("plan") or "bronce").lower().strip()
    plan_info = PLANS_CONFIG.get(plan_key, PLANS_CONFIG["bronce"])
    return float(plan_info.get("tier_markup", 14.0))


class StoreSaveRequest(BaseModel):
    slug: str = Field(..., min_length=3, max_length=30)
    store_name: str = Field(..., min_length=2, max_length=60)
    tagline: Optional[str] = Field("", max_length=120)
    logo_url: Optional[str] = Field("", max_length=500)
    banner_url: Optional[str] = Field("", max_length=500)
    primary_color: Optional[str] = Field("#00C26F", max_length=20)
    secondary_color: Optional[str] = Field("#3B82F6", max_length=20)
    bg_style: Optional[str] = Field("midnight", max_length=30)
    theme_config: Optional[dict] = Field(default_factory=dict)
    game_markups: Optional[dict] = Field(default_factory=dict)
    payment_methods: Optional[dict] = Field(default_factory=dict)
    contact_email: Optional[str] = Field("", max_length=120)
    email_config: Optional[dict] = Field(default_factory=dict)
    sms_config: Optional[dict] = Field(default_factory=dict)
    whatsapp_number: Optional[str] = Field("", max_length=40)
    telegram_username: Optional[str] = Field("", max_length=60)
    instagram_url: Optional[str] = Field("", max_length=120)
    custom_domain: Optional[str] = Field("", max_length=100)
    markup_percent: float = Field(10.0, ge=0.0, le=100.0)
    telegram_bot_token: Optional[str] = Field(None, max_length=120)
    store_mode: Optional[str] = Field("both", max_length=30)
    notification_prefs: Optional[dict] = Field(default_factory=dict)


class SetupTelegramBotRequest(BaseModel):
    bot_token: str = Field(..., min_length=10, max_length=120)
    store_mode: Optional[str] = Field("both", pattern="^(both|webapp_only|miniapp_only)$")
    notification_prefs: Optional[dict] = Field(default_factory=dict)


class ResellerSmtpTestRequest(BaseModel):
    smtp_user: str = Field(..., max_length=120)
    smtp_app_password: str = Field(..., max_length=60)
    sender_name: Optional[str] = Field("Mi Tienda", max_length=80)
    test_recipient: Optional[str] = Field(None, max_length=120)


class WebStoreDepositRequest(BaseModel):
    amount_usd: float = Field(..., ge=1.0, le=1000.0)


class SubscribeRequest(BaseModel):
    plan: str = Field(..., pattern="^(bronce|plata|oro|basico|pro|tienda_pro)$")
    billing_cycle: str = Field("1_month", pattern="^(monthly|yearly|1_month|3_months|6_months|12_months)$")
    store_name: Optional[str] = Field(None, max_length=60)
    slug: Optional[str] = Field(None, max_length=30)


class WebStoreOrderCreateRequest(BaseModel):
    product_id: Union[int, str]
    product_name: str
    game_name: str
    amount_usd: float
    amount_cup: Optional[int] = 0
    player_id: str = Field(..., min_length=2, max_length=80)
    zone_id: Optional[str] = Field("", max_length=40)
    client_name: Optional[str] = Field("", max_length=80)
    client_contact: Optional[str] = Field("", max_length=80)
    payment_method: str = Field(..., pattern="^(oxapay|whatsapp|balance)$")
    cup_reference: Optional[str] = Field("", max_length=100)
    cup_phone: Optional[str] = Field("", max_length=40)


class ResellerManualProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field("", max_length=2000)
    category: Optional[str] = Field("service", max_length=60)
    price: float = Field(..., gt=0.0)
    icon_url: Optional[str] = Field("", max_length=500)
    delivery_type: Optional[str] = Field("manual", max_length=30)
    instructions: Optional[str] = Field("", max_length=1000)
    delivery_time: Optional[str] = Field("Inmediato", max_length=60)
    stock: Optional[int] = Field(-1)
    is_active: Optional[bool] = True
    store_slug: Optional[str] = None
    options: Optional[list] = None


class ResellerManualProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = Field(None, gt=0.0)
    icon_url: Optional[str] = None
    delivery_type: Optional[str] = None
    instructions: Optional[str] = None
    delivery_time: Optional[str] = None
    stock: Optional[int] = None
    is_active: Optional[bool] = None
    store_slug: Optional[str] = None
    options: Optional[list] = None


# ══════════════════════════════════════════════════════════════════
#  ENDPOINTS PÚBLICOS
# ══════════════════════════════════════════════════════════════════

def _parse_json_dict(val):
    if isinstance(val, dict):
        return val
    if isinstance(val, str) and val.strip().startswith("{"):
        try:
            return json.loads(val)
        except Exception:
            return {}
    return {}


# Cachés en memoria de alto rendimiento para catálogo y servicios (0ms de latencia)
_fzr_categories_cache = None
_fzr_categories_cache_time = 0
_store_catalog_cache = {}
_store_products_cache = {}
_store_sms_services_cache = {}
_store_sms_countries_cache = None
_store_sms_countries_cache_time = 0


async def get_cached_fzr_categories():
    global _fzr_categories_cache, _fzr_categories_cache_time
    now = time.time()
    if _fzr_categories_cache is not None and (now - _fzr_categories_cache_time) < 300:
        return _fzr_categories_cache
    async with aiosqlite.connect(db.DB) as conn:
        conn.row_factory = aiosqlite.Row
        cur = await conn.execute("""
            SELECT c.provider_type, c.category_id, c.name, c.image_url, c.is_available,
                   m.display_name, m.icon_url, m.description, m.instructions, m.region_key
            FROM fzr_catalog_categories c
            LEFT JOIN fzr_catalog_mappings m 
              ON m.provider_type = c.provider_type AND m.category_id = c.category_id
            WHERE c.is_available = 1
        """)
        _fzr_categories_cache = [dict(r) for r in await cur.fetchall()]
        _fzr_categories_cache_time = now
        return _fzr_categories_cache


async def send_reseller_client_email(
    store: dict,
    to_email: str,
    subject: str,
    html_body: str
) -> tuple[bool, str]:
    """
    Envía un correo electrónico desde la tienda del revendedor a un cliente:
    - Si el revendedor configuró su Gmail y Contraseña de Aplicación de Google (16 caracteres) en email_config,
      se utiliza su propio servidor SMTP de Google para que el cliente reciba el correo directamente de su tienda.
    - Si no configuró SMTP propio, se utiliza el servidor SMTP oficial del sistema como respaldo.
    """
    clean_to = str(to_email or "").strip()
    if not clean_to or "@" not in clean_to:
        return False, "Dirección de correo inválida"

    email_cfg = _parse_json_dict(store.get("email_config"))
    is_custom_smtp = (
        bool(email_cfg.get("enabled", True))
        and bool(email_cfg.get("smtp_user") or store.get("contact_email"))
        and bool(email_cfg.get("smtp_app_password"))
    )

    if is_custom_smtp:
        smtp_user = str(email_cfg.get("smtp_user") or store.get("contact_email") or "").strip()
        smtp_pass = str(email_cfg.get("smtp_app_password") or "").replace(" ", "").strip()
        sender_name = str(email_cfg.get("sender_name") or store.get("store_name") or "Mi Tienda").strip()

        ok, err = await send_email_ex(
            to=clean_to,
            subject=subject,
            html_body=html_body,
            smtp_user=smtp_user,
            smtp_pass=smtp_pass,
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            sender_name=sender_name
        )
        if not ok:
            log.warning(f"[reseller_smtp] Error enviando correo desde cuenta revendedor {smtp_user}: {err}. Reintentando con SMTP central...")
            ok_fb, err_fb = await send_email_ex(to=clean_to, subject=subject, html_body=html_body)
            return ok_fb, err_fb
        return True, ""
    else:
        return await send_email_ex(to=clean_to, subject=subject, html_body=html_body)


async def notify_client_sale_receipt(store: dict, order_data: dict):
    """Envía recibo de compra al cliente si tiene correo y el revendedor activó la opción."""
    try:
        email_cfg = _parse_json_dict(store.get("email_config"))
        if not email_cfg.get("enabled", True) or not email_cfg.get("notify_client_receipt", True):
            return

        dest_email = str(order_data.get("client_email") or "").strip()
        if not dest_email or "@" not in dest_email:
            return

        store_name = store.get("store_name", "Mi Tienda")
        order_id = order_data.get("order_id") or order_data.get("merchant_order_id") or "N/A"
        product_name = order_data.get("product_name") or "Producto"
        player_id = order_data.get("player_id") or ""
        amount = float(order_data.get("amount_usd") or 0.0)

        subject = f"🛍️ Comprobante de Compra #{order_id} — {store_name}"
        player_html = f"<p style='margin: 6px 0;'><b>🎮 ID / Cuenta:</b> <code style='background:#0f172a; padding:2px 6px; border-radius:4px;'>{player_id}</code></p>" if player_id else ""

        body_html = f"""
        <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #38bdf8; margin: 0 0 6px 0;">🎉 ¡Gracias por tu compra!</h2>
                <p style="color: #94a3b8; font-size: 13px; margin: 0;">Tu pedido ha sido registrado con éxito en <b>{store_name}</b>.</p>
            </div>
            <div style="background-color: #1e293b; border: 1px solid rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 6px 0;"><b>📦 Pedido:</b> #{order_id}</p>
                <p style="margin: 6px 0;"><b>💎 Producto:</b> {product_name}</p>
                {player_html}
                <p style="margin: 6px 0; color: #38bdf8; font-size: 16px;"><b>💵 Total Pagado:</b> ${amount:.2f} USD</p>
                <p style="margin: 6px 0; font-size: 13px; color: #22c55e;"><b>⚡ Estado:</b> Procesado exitosamente</p>
            </div>
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; text-align: center;">
                Si tienes dudas o necesitas asistencia sobre tu pedido, contáctanos a través de nuestros canales oficiales de atención.
            </p>
            <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 20px;">
                {store_name}
            </p>
        </div>
        """
        await send_reseller_client_email(store, dest_email, subject, body_html)
    except Exception as ex:
        log.warning(f"Error enviando recibo de compra al cliente: {ex}")


async def notify_reseller_sale(store: dict, order_data: dict):
    """
    Envía notificaciones de venta en tiempo real al revendedor:
    1. Por Telegram (al chat privado del dueño a través de su propio bot o bot central)
    2. Por Correo Electrónico (si tiene configurado contact_email y notify_email activo)
    """
    try:
        store_name = store.get("store_name", "Mi Tienda")
        seller_id = store.get("user_id")
        bot_token = store.get("telegram_bot_token")
        notif_prefs = _parse_json_dict(store.get("notification_prefs"))
        notify_tg = notif_prefs.get("notify_telegram", True)
        notify_mail = notif_prefs.get("notify_email", True)

        order_id = order_data.get("order_id") or order_data.get("merchant_order_id") or "N/A"
        product_name = order_data.get("product_name") or "Producto"
        client_name = order_data.get("client_name") or "Cliente Web"
        sell_price = float(order_data.get("sell_price") or 0.0)
        profit = float(order_data.get("profit") or 0.0)

        # 1. Telegram
        if notify_tg and seller_id:
            tg_text = (
                f"🎉 <b>¡NUEVA VENTA EN TU TIENDA {store_name.upper()}!</b> 🚀\n\n"
                f"📦 <b>Pedido:</b> <code>#{order_id}</code>\n"
                f"💎 <b>Producto:</b> <b>{product_name}</b>\n"
                f"👤 <b>Cliente:</b> {client_name}\n"
                f"💵 <b>Total:</b> ${sell_price:.2f} USD\n"
                f"📈 <b>Tu Ganancia Neta:</b> <b>+${profit:.2f} USD</b>\n\n"
                f"💰 <i>Acreditado a tu saldo en FranchoShop.</i>"
            )
            # Intentar primero con el bot del revendedor si está configurado, o con el bot central
            target_token = bot_token or getattr(config, "BOT_TOKEN", None)
            if target_token:
                try:
                    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as session:
                        url = f"https://api.telegram.org/bot{target_token}/sendMessage"
                        payload = {
                            "chat_id": seller_id,
                            "text": tg_text,
                            "parse_mode": "HTML"
                        }
                        async with session.post(url, json=payload) as resp:
                            res = await resp.json()
                            if not res.get("ok"):
                                log.warning(f"No se pudo enviar mensaje Telegram al dueño {seller_id}: {res}")
                except Exception as tg_err:
                    log.warning(f"Error enviando notificación Telegram de venta: {tg_err}")

        # 2. Correo electrónico
        contact_email = store.get("contact_email")
        if notify_mail and contact_email:
            try:
                subject = f"🎉 ¡Nueva Venta en {store_name}! - Pedido #{order_id}"
                body_html = f"""
                <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
                    <h2 style="color: #22c55e; margin-top: 0;">🎉 ¡Felicidades! Tienes una nueva venta</h2>
                    <p style="color: #94a3b8; font-size: 14px;">Se ha registrado una compra en tu tienda web <b>{store_name}</b>.</p>
                    <div style="background-color: #1e293b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 6px 0;"><b>📦 Pedido:</b> #{order_id}</p>
                        <p style="margin: 6px 0;"><b>💎 Producto:</b> {product_name}</p>
                        <p style="margin: 6px 0;"><b>👤 Cliente:</b> {client_name}</p>
                        <p style="margin: 6px 0;"><b>💵 Total Cobrado:</b> ${sell_price:.2f} USD</p>
                        <p style="margin: 6px 0; color: #22c55e; font-size: 16px;"><b>📈 Tu Ganancia:</b> +${profit:.2f} USD</p>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center;">FranchoShop • Tu plataforma de reventa digital automatizada</p>
                </div>
                """
                asyncio.create_task(send_reseller_client_email(store, contact_email, subject, body_html))
            except Exception as mail_err:
                log.warning(f"Error enviando email al revendedor: {mail_err}")
    except Exception as ex:
        log.warning(f"Error general en notify_reseller_sale: {ex}")


async def send_telegram_notification(chat_id: Any, text: str, bot_token: Optional[str] = None):
    """Envía un mensaje formateado por Telegram."""
    if not chat_id:
        return False
    token = bot_token or getattr(config, "BOT_TOKEN", None)
    if not token:
        return False
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as session:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            payload = {
                "chat_id": str(chat_id).strip(),
                "text": text,
                "parse_mode": "HTML"
            }
            async with session.post(url, json=payload) as resp:
                data = await resp.json()
                return data.get("ok", False)
    except Exception as e:
        log.warning(f"Error enviando mensaje Telegram a {chat_id}: {e}")
        return False


async def deliver_streaming_order(
    order_id: Union[int, str],
    store: dict,
    user: Optional[dict] = None,
    client_contact: Optional[str] = None,
    player_id: Optional[str] = None
) -> dict:
    """
    Ejecuta la compra real de streaming en StreamZone y entrega las credenciales:
    1. En los Detalles del Pedido (guardado en BD orders.recharge_config y retornado en JSON)
    2. Por Gmail / Correo Electrónico (enviado via send_email)
    3. Por Telegram (mensaje directo al chat del usuario y al revendedor)
    """
    from webapp.api.streamzone_client import streamzone_client, StreamZoneError

    async with aiosqlite.connect(db.DB) as conn:
        conn.row_factory = aiosqlite.Row
        cur = await conn.execute(
            "SELECT * FROM orders WHERE id = ? OR merchant_order_id = ? LIMIT 1",
            (str(order_id), str(order_id))
        )
        row = await cur.fetchone()
        if not row:
            log.warning(f"deliver_streaming_order: Orden {order_id} no encontrada")
            return {"ok": False, "error": "Orden no encontrada"}
        order = dict(row)

    cfg = _parse_json_dict(order.get("recharge_config"))
    prov_offer = order.get("provider_offer_id") or order.get("product_id") or ""
    sz_prod_id = str(prov_offer).replace("sz_", "").replace("streaming_", "").strip()
    m_oid = order.get("merchant_order_id") or f"STR_{order['id']}"
    product_name = order.get("product_name") or "Suscripción"

    credentials = []
    sz_order_id = ""

    # Si ya tiene credenciales guardadas en la orden, reutilizarlas
    if cfg.get("credentials") and isinstance(cfg["credentials"], list) and len(cfg["credentials"]) > 0:
        credentials = cfg["credentials"]
        sz_order_id = cfg.get("streamzone_order_id") or ""
    else:
        try:
            sz_res = await streamzone_client.create_order(
                product_id=sz_prod_id,
                quantity=order.get("quantity") or 1,
                idempotency_key=m_oid
            )
            credentials = sz_res.get("credentials", [])
            sz_order_id = sz_res.get("orderId") or ""
        except Exception as e:
            log.error(f"Error creando orden en StreamZone para {m_oid}: {e}")
            credentials = []

    now = time.time()
    cfg["credentials"] = credentials
    if sz_order_id:
        cfg["streamzone_order_id"] = sz_order_id

    new_status = 2 if credentials else 1
    async with aiosqlite.connect(db.DB) as conn:
        await conn.execute("""
            UPDATE orders 
            SET recharge_config = ?, order_status = ?, updated_at = ?
            WHERE id = ?
        """, (json.dumps(cfg), new_status, now, order["id"]))
        await conn.commit()

    store_name = store.get("store_name", "Tienda Oficial")

    # 1. ENTREGA POR GMAIL / CORREO ELECTRÓNICO
    dest_email = None
    if user and user.get("email"):
        dest_email = user["email"].strip()
    elif client_contact and "@" in client_contact:
        dest_email = client_contact.strip()
    elif player_id and "@" in player_id:
        dest_email = player_id.strip()
    elif cfg.get("buyer_email"):
        dest_email = cfg["buyer_email"].strip()

    if dest_email and credentials:
        try:
            creds_html = ""
            for idx, c in enumerate(credentials, 1):
                prof_str = f"<p style='margin:4px 0;'><b>👤 Perfil:</b> {c.get('profile')}</p>" if c.get('profile') else ""
                pin_str = f"<p style='margin:4px 0;'><b>🔒 PIN:</b> <span style='font-family:monospace;font-size:16px;color:#22c55e;'>{c.get('pin')}</span></p>" if c.get('pin') else ""
                creds_html += f"""
                <div style="background-color:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:14px; margin-bottom:12px; color:#ffffff;">
                    <p style="margin:4px 0; color:#38bdf8; font-weight:bold;">Acceso #{idx}</p>
                    <p style="margin:4px 0;"><b>📧 Correo / Usuario:</b> <code style="background:#0f172a; padding:2px 6px; border-radius:4px; font-size:14px; color:#ffffff;">{c.get('email', '')}</code></p>
                    <p style="margin:4px 0;"><b>🔑 Contraseña:</b> <code style="background:#0f172a; padding:2px 6px; border-radius:4px; font-size:14px; color:#ffffff;">{c.get('password', '')}</code></p>
                    {prof_str}
                    {pin_str}
                </div>
                """

            email_subject = f"🔑 Tus accesos para {product_name} - {store_name}"
            email_body = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b1120; color: #f8fafc; padding: 24px; border-radius: 14px;">
                <h2 style="color: #38bdf8; margin-top: 0;">🎉 ¡Tu suscripción está lista!</h2>
                <p style="color: #cbd5e1; font-size: 14px;">Gracias por tu compra en <b>{store_name}</b>. A continuación tienes tus credenciales de acceso para <b>{product_name}</b>:</p>
                {creds_html}
                <div style="background-color:#0f172a; border-left:4px solid #38bdf8; padding:12px; border-radius:4px; font-size:12px; color:#94a3b8; margin-top:16px;">
                    📌 <b>Garantía y Términos:</b> Cuentas oficiales garantizadas durante todo el período contratado. Recuerda no cambiar la contraseña ni alterar perfiles ajenos para conservar tu garantía.
                </div>
                <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 24px;">{store_name} • Pedido #{m_oid}</p>
            </div>
            """
            asyncio.create_task(send_reseller_client_email(store, dest_email, email_subject, email_body))
        except Exception as mail_err:
            log.warning(f"Error enviando correo de credenciales al cliente: {mail_err}")

    # 2. ENTREGA POR TELEGRAM
    tg_dest = None
    if user and user.get("telegram_id"):
        tg_dest = user["telegram_id"]
    elif client_contact and client_contact.strip().lstrip("-").isdigit():
        tg_dest = client_contact.strip()
    elif player_id and player_id.strip().lstrip("-").isdigit():
        tg_dest = player_id.strip()

    if tg_dest and credentials:
        try:
            tg_msg = (
                f"🎉 <b>¡TUS ACCESOS DE {product_name.upper()} ESTÁN LISTOS!</b>\n\n"
                f"📦 <b>Pedido:</b> <code>#{m_oid}</code>\n"
            )
            for c in credentials:
                tg_msg += f"\n📧 <b>Usuario / Correo:</b> <code>{c.get('email', '')}</code>\n"
                tg_msg += f"🔑 <b>Contraseña:</b> <code>{c.get('password', '')}</code>\n"
                if c.get("profile"):
                    tg_msg += f"👤 <b>Perfil:</b> {c['profile']}\n"
                if c.get("pin"):
                    tg_msg += f"🔒 <b>PIN:</b> <code>{c['pin']}</code>\n"
            tg_msg += "\n🛡️ <i>Cuentas oficiales con garantía activa 24/7. También visibles en Detalles del Pedido.</i>"

            bot_token = store.get("telegram_bot_token")
            asyncio.create_task(send_telegram_notification(tg_dest, tg_msg, bot_token))
        except Exception as tg_err:
            log.warning(f"Error enviando Telegram de credenciales al cliente: {tg_err}")

    return {
        "ok": True,
        "credentials": credentials,
        "streamzone_order_id": sz_order_id,
        "order_status": new_status,
        "delivered_email": dest_email,
        "delivered_telegram": bool(tg_dest)
    }


@router.get("/public/web-store/{identifier}")
async def get_public_web_store(identifier: str, user: Optional[dict] = Depends(get_current_user_optional)):
    """
    Obtiene la configuración visual y de contacto de una tienda por su slug (subdominio)
    o por su dominio personalizado.
    """
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id)
    if not store:
        store = await db.get_web_store_by_domain(clean_id)

    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    now = time.time()
    expires_at = float(store.get("expires_at") or 0)
    is_active = bool(store.get("is_active", 1))

    # Gracia de 24 horas tras expirar
    if not is_active or (expires_at + 86400 < now):
        return {
            "ok": False,
            "status": "expired",
            "message": "Esta tienda tiene su suscripción pausada temporalmente.",
            "store_name": store.get("store_name", "Tienda"),
            "owner_contact": store.get("whatsapp_number") or ""
        }

    plan_key = store.get("plan", "basico")
    plan_info = PLANS_CONFIG.get(plan_key, PLANS_CONFIG["basico"])

    is_owner = False
    if user:
        try:
            u_id = user.get("id") or user.get("user_id")
            admin_ids = getattr(config, "ADMIN_IDS", [])
            is_owner = (int(u_id) == int(store["user_id"])) or (int(u_id) in admin_ids) or (user.get("role") == "admin")
        except Exception:
            is_owner = False

    tc = _parse_json_dict(store.get("theme_config"))
    gm = _parse_json_dict(store.get("game_markups"))
    raw_pm = _parse_json_dict(store.get("payment_methods"))
    raw_ec = _parse_json_dict(store.get("email_config"))
    email_cfg = raw_ec if is_owner else {"enabled": bool(raw_ec.get("enabled", True))}

    public_pm = {
        "oxapay": {
            "enabled": True,
        },
        "cup_manual": {
            "enabled": False,
            "transfermovil_card": "",
            "enzona_card": "",
            "holder_name": "",
            "phone": "",
            "exchange_rate_cup": 0.0,
            "instructions": ""
        },
        "whatsapp_checkout": {
            "enabled": bool(raw_pm.get("whatsapp_checkout", {}).get("enabled", True)),
            "phone": store.get("whatsapp_number") or ""
        }
    }

    return {
        "ok": True,
        "status": "active",
        "store": {
            "id": store["id"],
            "user_id": store["user_id"],
            "slug": store["slug"],
            "store_name": store["store_name"],
            "tagline": store.get("tagline") or "",
            "logo_url": store.get("logo_url") or "",
            "banner_url": store.get("banner_url") or "",
            "primary_color": store.get("primary_color") or "#00C26F",
            "secondary_color": store.get("secondary_color") or "#3B82F6",
            "bg_style": store.get("bg_style") or "midnight",
            "theme_config": tc,
            "sms_config": tc.get("sms_config") or {"enabled": True, "markup_percent": float(store.get("markup_percent") or 15.0)},
            "game_markups": gm,
            "payment_methods": public_pm,
            "email_config": email_cfg,
            "contact_email": store.get("contact_email") or "",
            "whatsapp_number": store.get("whatsapp_number") or "",
            "telegram_username": store.get("telegram_username") or "",
            "telegram_bot_username": store.get("telegram_bot_username") or "",
            "telegram_bot_active": bool(store.get("telegram_bot_active")),
            "bot_url": f"https://t.me/{store['telegram_bot_username']}" if store.get("telegram_bot_username") else "",
            "mini_app_url": f"https://franchoshop.com/s/{store['slug']}",
            "store_mode": store.get("store_mode") or "both",
            "instagram_url": store.get("instagram_url") or "",
            "custom_domain": store.get("custom_domain") or "",
            "markup_percent": float(store.get("markup_percent") or 10.0),
            "plan": plan_key,
            "plan_name": plan_info["name"],
            "tier_markup": plan_info.get("tier_markup", 14.0),
            "is_verified": plan_key in ("plata", "oro", "pro", "tienda_pro"),
            "features": plan_info["allowed_features"],
            "subdomain_url": f"https://{store['slug']}.franchoshop.com",
            "vip_subdomain_url": f"https://{store['slug']}.topupsh.com" if plan_key in ("oro", "pro", "tienda_pro") else None
        }
    }


@router.get("/public/web-store/{identifier}/manual-products")
async def get_public_web_store_manual_products(identifier: str, all: bool = Query(False)):
    """Devuelve los productos manuales/exclusivos creados por el dueño de esta tienda web."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    store_slug = store.get("slug")
    if not store_slug:
        return {"ok": True, "products": [], "cup_rate": 320.0}

    raw_prods = await db.get_manual_products(active_only=not all, store_slug=store_slug)
    pm = _parse_json_dict(store.get("payment_methods"))
    cup_rate = float(pm.get("cup_manual", {}).get("exchange_rate_cup", 320.0))

    products = []
    for p in raw_prods:
        usd = float(p.get("price") or 0.0)
        cup = int(round(usd * cup_rate)) if cup_rate > 0 else 0
        raw_opts = p.get("options") or []
        parsed_opts = []
        for o in raw_opts:
            o_usd = float(o.get("price") or 0.0)
            o_cup = int(round(o_usd * cup_rate)) if cup_rate > 0 else 0
            parsed_opts.append({
                "id": o.get("id"),
                "name": o.get("name"),
                "price": o_usd,
                "sell_price": o_usd,
                "cup_price": o_cup,
                "stock": int(o.get("stock", -1) if o.get("stock") is not None else -1),
                "is_active": bool(o.get("is_active", 1)),
                "sort_order": int(o.get("sort_order", 0))
            })
        products.append({
            "id": p["id"],
            "name": p["name"],
            "description": p.get("description") or "",
            "category": p.get("category") or "service",
            "price": usd,
            "sell_price": usd,
            "cup_price": cup,
            "icon_url": p.get("icon_url") or "",
            "delivery_type": p.get("delivery_type") or "manual",
            "instructions": p.get("instructions") or "",
            "delivery_time": p.get("delivery_time") or "Inmediato",
            "stock": int(p.get("stock", -1)),
            "is_active": bool(p.get("is_active", 1)),
            "options": parsed_opts,
            "fields": p.get("fields") or [],
            "is_manual": True
        })

    return {"ok": True, "products": products, "cup_rate": cup_rate}


def clean_fzr_base_game_name(disp_or_name: str) -> str:
    if not disp_or_name:
        return "Juego"
    clean = re.sub(r"\s*\([^)]*\)", "", disp_or_name).strip()
    clean = re.sub(r"^[!*]+\s*|\s*[!*]+$", "", clean).strip().strip("'\"")
    if clean.lower().startswith("garena "):
        clean = clean[7:].strip()
    return clean or disp_or_name


def get_custom_game_markup(gm: dict, game_name: str, fallback_name: str = None, default_markup: float = 10.0) -> float:
    """
    Busca el margen personalizado de un juego de forma exacta y segura (evitando colisiones por subcadenas).
    Prioriza game_name específico, luego fallback_name (nombre base), sin emparejar subcadenas parciales.
    """
    if not gm:
        return default_markup
    # 1. Búsqueda exacta directa por game_name
    if game_name and game_name in gm:
        try:
            return float(gm[game_name])
        except (ValueError, TypeError):
            pass
    # 2. Búsqueda exacta directa por fallback_name
    if fallback_name and fallback_name in gm:
        try:
            return float(gm[fallback_name])
        except (ValueError, TypeError):
            pass
    # 3. Búsqueda exacta insensible a mayúsculas/minúsculas y espacios en blanco
    targets = [t.strip().lower() for t in (game_name, fallback_name) if t and isinstance(t, str)]
    for k, val in gm.items():
        k_norm = str(k).strip().lower()
        if k_norm in targets:
            try:
                return float(val)
            except (ValueError, TypeError):
                pass
    return default_markup


REGION_MAP = {
    "latam": ("🌎 LATAM", -25),
    "global": ("🌐 Global", -24),
    "row": ("🌐 Global", -24),
    "br": ("🇧🇷 Brasil", -23),
    "us": ("🇺🇸 Estados Unidos", -22),
    "usa": ("🇺🇸 Estados Unidos", -22),
    "mx": ("🇲🇽 México", -21),
    "co": ("🇨🇴 Colombia", -20),
    "ar": ("🇦🇷 Argentina", -19),
    "cl": ("🇨🇱 Chile", -18),
    "pe": ("🇵🇪 Perú", -17),
    "es": ("🇪🇸 España", -16),
    "eu": ("🇪🇺 Europa", -15),
    "eu_tr": ("🇪🇺/🇹🇷 Europa & Turquía", -10),
    "eu+tr": ("🇪🇺/🇹🇷 Europa & Turquía", -10),
    "eu-tr": ("🇪🇺/🇹🇷 Europa & Turquía", -10),
    "uk": ("🇬🇧 Reino Unido", -14),
    "gb": ("🇬🇧 Reino Unido", -14),
    "ca": ("🇨🇦 Canadá", -13),
    "de": ("🇩🇪 Alemania", -12),
    "fr": ("🇫🇷 Francia", -11),
    "it": ("🇮🇹 Italia", -10),
    "tr": ("🇹🇷 Turquía", -9),
    "mena": ("🌍 Medio Oriente", -9),
    "sa": ("🇸🇦 Arabia Saudita", -8),
    "ae": ("🇦🇪 Emiratos Árabes", -8),
    "id": ("🇮🇩 Indonesia", -7),
    "th": ("🇹🇭 Tailandia", -6),
    "ph": ("🇵🇭 Filipinas", -5),
    "my": ("🇲🇾 Malasia", -4),
    "sg": ("🇸🇬 Singapur", -4),
    "my_sg": ("🇲🇾/🇸🇬 Malasia y Singapur", -4),
    "vn": ("🇻🇳 Vietnam", -3),
    "in": ("🇮🇳 India", -2),
    "bd": ("🇧🇩 Bangladés", -2),
    "pk": ("🇵🇰 Pakistán", -2),
    "cis": ("🇷🇺 Rusia / CIS", -2),
    "ru": ("🇷🇺 Rusia", -2),
    "tw": ("🇹🇼 Taiwán", -1),
    "jp": ("🇯🇵 Japón", -1),
    "kr": ("🇰🇷 Corea del Sur", -1),
    "au": ("🇦🇺 Australia", -1),
    "nz": ("🇳🇿 Nueva Zelanda", -1),
    "za": ("🇿🇦 Sudáfrica", -1),
    "hk": ("🇭🇰 Hong Kong", -1),
    "nl": ("🇳🇱 Países Bajos", -1),
    "no": ("🇳🇴 Noruega", -1),
    "pl": ("🇵🇱 Polonia", -1),
    "se": ("🇸🇪 Suecia", -1),
    "ch": ("🇨🇭 Suiza", -1),
}


def format_fzr_region_name(cat_name: str, cat_id: str, region_key: Optional[str] = None) -> tuple[str, int]:
    cid_clean = (cat_id or "").lower()
    if "eu_tr" in cid_clean or "eu+tr" in cid_clean or "eu-tr" in cid_clean:
        return ("🇪🇺/🇹🇷 Europa & Turquía", -10)

    if region_key:
        rk = region_key.strip().lower()
        if rk in REGION_MAP:
            return REGION_MAP[rk]
        if rk not in {"__standard__", "standard", "none", "", "null"}:
            return (f"🌐 {rk.upper()}", 0)

    m = re.search(r"\(([^)]+)\)", cat_name or "")
    if m:
        c = m.group(1).strip().lower()
        if c in REGION_MAP:
            return REGION_MAP[c]
        if "eu" in c and "tr" in c:
            return ("🇪🇺/🇹🇷 Europa & Turquía", -10)
        for k, v in REGION_MAP.items():
            if k == c or k in c.split():
                return v
        if len(c) <= 15:
            return (m.group(1).strip(), 0)

    parts = cid_clean.split("_")
    if len(parts) >= 3 and f"{parts[-2]}_{parts[-1]}" in REGION_MAP:
        return REGION_MAP[f"{parts[-2]}_{parts[-1]}"]
    if len(parts) >= 2 and parts[-1] in REGION_MAP:
        return REGION_MAP[parts[-1]]

    return ("🌐 Global", 0)


FEATURED_FZR_GAMES_PRIORITY = [
    "free_fire", "blood_strike", "roblox", "mobile_legends", "pubg",
    "call_of_duty", "codm", "brawl_stars", "clash_of_clans", "honor_of_kings",
    "genshin_impact", "steam", "playstation", "xbox", "nintendo", "google_play",
    "apple", "razer"
]


def fzr_catalog_priority(name: str, cat_ids: list) -> int:
    n = name.lower()
    for idx, prefix in enumerate(FEATURED_FZR_GAMES_PRIORITY):
        if prefix in n or any(prefix in cid.lower() for cid in cat_ids):
            return idx - 1000
    return 0


@router.get("/public/web-store/{identifier}/catalog")
async def get_public_web_store_catalog(identifier: str):
    """Devuelve la lista de juegos disponibles con los márgenes del revendedor aplicados (Basado en FZR)."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    gm = _parse_json_dict(store.get("game_markups"))
    default_markup = float(store.get("markup_percent") or 10.0)
    pm = _parse_json_dict(store.get("payment_methods"))
    cup_rate = float(pm.get("cup_manual", {}).get("exchange_rate_cup", 320.0))

    cat_cache_key = f"catalog:{clean_id}"
    now = time.time()
    cached_cat = _store_catalog_cache.get(cat_cache_key)
    if cached_cat and cached_cat[0] > now:
        return cached_cat[1]
    store_display = store.get("store_name") or "esta tienda"

    rows = await get_cached_fzr_categories()

    from collections import defaultdict
    groups = defaultdict(list)
    for r in rows:
        disp = r.get("display_name") or r.get("name") or ""
        base = clean_fzr_base_game_name(disp)
        ptype = r.get("provider_type") or "topup"
        cat_kind = "giftcard" if ptype in ("giftcard", "gamekey") else "topup"
        groups[(cat_kind, base)].append(r)

    games = []
    for (cat_kind, base_name), items in groups.items():
        cat_ids = [it["category_id"] for it in items]
        prio = fzr_catalog_priority(base_name, cat_ids)

        best_item = next((it for it in items if "latam" in it["category_id"].lower()), None)
        if not best_item:
            best_item = next((it for it in items if "global" in it["category_id"].lower()), None)
        if not best_item:
            best_item = items[0]

        display_title = base_name if (cat_kind == "topup" or "gift card" in base_name.lower() or "pin" in base_name.lower()) else f"{base_name} (Gift Card)"
        game_markup = get_custom_game_markup(gm, display_title, fallback_name=base_name, default_markup=default_markup)

        regions = []
        seen_reg_names = set()
        for it in items:
            reg_name, reg_prio = format_fzr_region_name(
                it.get("display_name") or it.get("name"),
                it["category_id"],
                it.get("region_key")
            )
            if reg_name in seen_reg_names:
                reg_name = f"{reg_name} (Opción {len(regions) + 1})"
            seen_reg_names.add(reg_name)
            regions.append({
                "name": reg_name,
                "raw_name": it["category_id"],
                "category_id": it["category_id"],
                "provider_type": it["provider_type"],
                "priority": reg_prio
            })

        regions.sort(key=lambda r: (r["priority"], r["name"]))

        desc = best_item.get("description") or ""
        inst = best_item.get("instructions") or ""
        if cat_kind == "giftcard":
            desc = "Entrega instantánea de código PIN oficial para canjear en la plataforma."
            inst = "Recibirás tu código o PIN digital de forma instantánea a tu correo o WhatsApp para canjear de inmediato."
        elif desc:
            desc = desc.replace("Francho Shop", store_display).replace("FranchoShop", store_display)
        if cat_kind != "giftcard" and inst:
            inst = inst.replace("Francho Shop", store_display).replace("FranchoShop", store_display)

        display_title = base_name if (cat_kind == "topup" or "gift card" in base_name.lower() or "pin" in base_name.lower()) else f"{base_name} (Gift Card)"

        games.append({
            "id": f"{cat_kind}_{base_name.lower().replace(' ', '_')}",
            "name": base_name,
            "title": display_title,
            "icon_url": best_item.get("icon_url") or best_item.get("image_url") or "",
            "category": cat_kind,
            "provider_type": best_item.get("provider_type") or "topup",
            "default_category_id": regions[0]["category_id"],
            "count": len(regions),
            "products_count": len(regions),
            "regions_count": len(regions),
            "regions": regions,
            "reseller_markup_percent": game_markup,
            "cup_exchange_rate": cup_rate,
            "description": desc,
            "instructions": inst,
            "_prio": prio
        })

    games.sort(key=lambda g: (g["_prio"], g["name"]))

    # Inyectar tarjeta destacada de Números Virtuales (SMS) si está activo en la tienda
    tc = _parse_json_dict(store.get("theme_config"))
    sms_cfg = tc.get("sms_config") or {}
    sms_enabled = sms_cfg.get("enabled", True)
    sms_markup = float(sms_cfg.get("markup_percent", default_markup))

    if sms_enabled:
        sms_icon = sms_cfg.get("category_logo_url") or sms_cfg.get("icon_url") or "/api/icons/manual-1782655319-e35b38c8.png"
        sms_title = sms_cfg.get("display_name") or sms_cfg.get("title") or "Números Virtuales"
        sms_banner = sms_cfg.get("banner_url") or sms_cfg.get("catalog_image_url") or "/api/icons/manual-1782655319-e35b38c8.png"
        sms_desc = sms_cfg.get("description") or "Recibe códigos de activación por SMS para WhatsApp, Telegram, TikTok, OpenAI y más."
        games.insert(0, {
            "id": "virtual_sms_numbers",
            "name": "Números Virtuales",
            "title": sms_title,
            "icon_url": sms_icon,
            "banner_url": sms_banner,
            "category": "sms",
            "is_sms": True,
            "count": "150+ Países",
            "products_count": "WhatsApp, Telegram, etc.",
            "regions_count": 150,
            "regions": [],
            "reseller_markup_percent": sms_markup,
            "cup_exchange_rate": cup_rate,
            "description": sms_desc,
            "instructions": "Selecciona el país y el servicio para recibir tu código SMS de verificación al instante."
        })

    # Inyectar Apps de Streaming (StreamZone)
    try:
        from webapp.api.streamzone_client import streamzone_client
        sz_prods = await streamzone_client.get_catalog()
        for p in sz_prods:
            p_name = p["name"]
            sz_markup = get_custom_game_markup(gm, p_name, default_markup=default_markup)
            cost_usd = float(p.get("price_usd") or 0.0)
            sell_usd = round(cost_usd * (1 + (sz_markup / 100.0)), 2)
            if sell_usd < 0.10 and cost_usd > 0:
                sell_usd = round(cost_usd + 0.10, 2)
            cup_price = int(round(sell_usd * cup_rate)) if cup_rate > 0 else 0

            games.append({
                "id": f"streaming_{p['id']}",
                "name": p_name,
                "title": p_name,
                "icon_url": p.get("image_url") or "",
                "category": "streaming",
                "is_streaming": True,
                "provider_type": "streaming",
                "default_category_id": p["id"],
                "count": "Entrega Inmediata",
                "products_count": 1,
                "regions_count": 1,
                "regions": [{
                    "name": p.get("region") or "Global",
                    "raw_name": p["id"],
                    "category_id": p["id"],
                    "provider_type": "streaming",
                    "priority": 1
                }],
                "reseller_markup_percent": sz_markup,
                "cup_exchange_rate": cup_rate,
                "description": p.get("description") or "Cuenta / Perfil Oficial con garantía durante todo el tiempo contratado.",
                "instructions": "Recibirás los accesos y credenciales de forma inmediata.",
                "price": sell_usd,
                "price_usd": sell_usd,
                "cup_price": cup_price,
                "duration_days": p.get("duration_days") or 30,
                "_prio": -850
            })
    except Exception as e:
        log.warning(f"Error cargando streaming en catálogo público: {e}")

    store_slug = store.get("slug")
    if store_slug:
        try:
            manual_prods = await db.get_manual_products(active_only=True, store_slug=store_slug)
            # Insertar cada producto manual/exclusivo como una tarjeta independiente
            for idx, p in enumerate(manual_prods):
                raw_opts = p.get("options") or []
                parsed_opts = []
                for o in raw_opts:
                    o_usd = float(o.get("price") or 0.0)
                    o_cup = int(round(o_usd * cup_rate)) if cup_rate > 0 else 0
                    parsed_opts.append({
                        "id": o.get("id"),
                        "name": o.get("name"),
                        "price": o_usd,
                        "sell_price": o_usd,
                        "cup_price": o_cup,
                        "stock": int(o.get("stock", -1) if o.get("stock") is not None else -1),
                        "is_active": bool(o.get("is_active", 1)),
                        "sort_order": int(o.get("sort_order", 0)),
                        "delivery_time": o.get("delivery_time") or p.get("delivery_time") or "Inmediato"
                    })
                usd = float(p.get("price") or 0.0)
                if parsed_opts:
                    active_opts_prices = [o["sell_price"] for o in parsed_opts if o["is_active"]]
                    if active_opts_prices:
                        usd = min(active_opts_prices)
                cup_val = int(round(usd * cup_rate)) if cup_rate > 0 else 0
                games.insert(idx, {
                    "id": f"manual_{p['id']}",
                    "manual_product_id": p["id"],
                    "name": p["name"],
                    "title": p["name"],
                    "icon_url": p.get("icon_url") or store.get("logo_url") or "",
                    "category": "manual",
                    "is_manual": True,
                    "products_count": len(parsed_opts) if parsed_opts else 1,
                    "count": p.get("delivery_time") or "Inmediato",
                    "regions_count": 1,
                    "regions": [],
                    "reseller_markup_percent": 0.0,
                    "cup_exchange_rate": cup_rate,
                    "price": usd,
                    "price_usd": usd,
                    "sell_price": usd,
                    "cup_price": cup_val,
                    "description": p.get("description") or "",
                    "instructions": p.get("instructions") or "",
                    "delivery_time": p.get("delivery_time") or "Inmediato",
                    "delivery_type": p.get("delivery_type") or "manual",
                    "stock": p.get("stock", -1),
                    "options": parsed_opts,
                    "fields": p.get("fields") or [],
                    "_prio": -950 + idx
                })
        except Exception as e:
            log.warning(f"Error cargando productos manuales para el catálogo: {e}")

    res = {
        "ok": True,
        "store_slug": store["slug"],
        "store_name": store["store_name"],
        "games": games,
        "cup_rate": cup_rate,
        "sms_enabled": sms_enabled
    }
    _store_catalog_cache[cat_cache_key] = (now + 60, res)
    return res


@router.get("/public/web-store/{identifier}/games/{game_name}/products")
async def get_public_web_store_products(
    identifier: str, 
    game_name: str, 
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    """Devuelve los paquetes de un juego con los precios minoristas calculados para este revendedor usando FZR."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    pm = _parse_json_dict(store.get("payment_methods"))
    cup_rate = float(pm.get("cup_manual", {}).get("exchange_rate_cup", 320.0))

    cache_key = f"{clean_id}:{game_name}:{region or ''}:{category or ''}"
    now = time.time()
    cached_val = _store_products_cache.get(cache_key)
    if cached_val and cached_val[0] > now:
        return cached_val[1]

    if game_name.startswith("manual_") or game_name == "manual_store_products":
        owner_id = store.get("user_id")
        single_id = None
        if game_name.startswith("manual_"):
            try:
                single_id = int(game_name.replace("manual_", ""))
            except Exception:
                single_id = None

        store_slug = store.get("slug")
        if single_id:
            p = await db.get_manual_product(single_id)
            manual_prods = [p] if (p and p.get("store_slug") == store_slug) else []
        else:
            manual_prods = await db.get_manual_products(active_only=True, store_slug=store_slug) if store_slug else []

        tailored = []
        for p in manual_prods:
            opts = [o for o in (p.get("options") or []) if o.get("is_active", 1)]
            if opts and single_id:
                for o in opts:
                    cost = float(o.get("price") or 0.0)
                    cup_price = int(round(cost * cup_rate)) if cup_rate > 0 else 0
                    tailored.append({
                        "id": f"{p['id']}_opt_{o['id']}",
                        "manual_product_id": p["id"],
                        "manual_option_id": o["id"],
                        "offer_id": f"{p['id']}_opt_{o['id']}",
                        "name": f"{p['name']} - {o['name']}",
                        "variant_name": o["name"],
                        "base_cost": cost,
                        "sell_price": cost,
                        "cup_price": cup_price,
                        "markup_applied": 0.0,
                        "orders_count": p.get("orders_count", 0),
                        "description": p.get("description", ""),
                        "category": p.get("category", "service"),
                        "icon_url": p.get("icon_url", ""),
                        "delivery_type": p.get("delivery_type", "manual"),
                        "instructions": p.get("instructions", ""),
                        "delivery_time": p.get("delivery_time") or "Inmediato",
                        "stock": o.get("stock", -1),
                        "is_manual": True
                    })
            else:
                cost = float(p.get("price") or 0.0)
                cup_price = int(round(cost * cup_rate)) if cup_rate > 0 else 0
                tailored.append({
                    "id": p["id"],
                    "offer_id": str(p["id"]),
                    "name": p["name"],
                    "base_cost": cost,
                    "sell_price": cost,
                    "cup_price": cup_price,
                    "markup_applied": 0.0,
                    "orders_count": p.get("orders_count", 0),
                    "description": p.get("description", ""),
                    "category": p.get("category", "service"),
                    "icon_url": p.get("icon_url", ""),
                    "delivery_type": p.get("delivery_type", "manual"),
                    "instructions": p.get("instructions", ""),
                    "delivery_time": p.get("delivery_time") or "Inmediato",
                    "stock": p.get("stock", -1),
                    "is_manual": True
                })
        return {
            "ok": True,
            "game_name": game_name,
            "region": "__standard__",
            "regions": [],
            "markup_applied": 0.0,
            "cup_rate": cup_rate,
            "products": tailored
        }

    # Comprobar si es un producto de streaming de StreamZone
    if game_name.startswith("streaming_") or game_name.startswith("sz_") or category == "streaming":
        sz_id = game_name.replace("streaming_", "").replace("sz_", "").strip().lower()
        try:
            from webapp.api.streamzone_client import streamzone_client
            sz_prods = await streamzone_client.get_catalog()
            prod = next((
                p for p in sz_prods 
                if p["id"].lower() == sz_id 
                or p["name"].lower() == game_name.lower()
                or (p.get("slug") and p["slug"].lower() == game_name.lower())
            ), None)
            if prod:
                gm = _parse_json_dict(store.get("game_markups"))
                default_markup = float(store.get("markup_percent") or 10.0)
                markup = get_custom_game_markup(gm, prod["name"], default_markup=default_markup)
                tier_markup = get_store_tier_markup_pct(store)
                raw_cost = float(prod.get("price_usd") or 0.0)
                cost = round(raw_cost * (1.0 + (tier_markup / 100.0)), 2)
                sell_price = round(cost * (1 + (markup / 100.0)), 2)
                if sell_price < 0.10 and cost > 0:
                    sell_price = round(cost + 0.10, 2)
                cup_price = int(round(sell_price * cup_rate)) if cup_rate > 0 else 0

                return {
                    "ok": True,
                    "game_name": prod["name"],
                    "region": prod.get("region") or "Global",
                    "region_raw": prod["id"],
                    "category_id": prod["id"],
                    "regions": [{"name": prod.get("region") or "Global", "raw_name": prod["id"], "category_id": prod["id"], "provider_type": "streaming", "priority": 1}],
                    "markup_applied": markup,
                    "tier_markup": tier_markup,
                    "cup_rate": cup_rate,
                    "instructions": "Recibirás tus credenciales de acceso de forma segura.",
                    "description": prod.get("description") or "",
                    "products": [{
                        "id": f"sz_{prod['id']}",
                        "offer_id": f"sz_{prod['id']}",
                        "name": f"{prod['name']} ({prod.get('duration_days', 30)} Días)",
                        "base_cost": cost,
                        "sell_price": sell_price,
                        "cup_price": cup_price,
                        "markup_applied": markup,
                        "tier_markup": tier_markup,
                        "required_fields": ["correo"],
                        "is_available": bool(prod.get("in_stock", True)),
                        "provider_type": "streaming",
                        "category_id": prod["id"],
                        "is_manual": False
                    }]
                }
        except Exception as e:
            log.warning(f"Error comprobando streaming en get_public_web_store_products: {e}")

    all_cats = await get_cached_fzr_categories()

    exact_cat = next((c for c in all_cats if c["category_id"] == game_name), None)

    # Filtrar por tipo de proveedor si el usuario vino de la pestaña giftcard o topup
    cat_filter = category.strip().lower() if category else None
    if exact_cat and not cat_filter:
        cat_filter = "giftcard" if exact_cat["provider_type"] in ("giftcard", "gamekey") else "topup"

    allowed_types = None
    if cat_filter in ("giftcard", "gamekey"):
        allowed_types = {"giftcard", "gamekey"}
    elif cat_filter in ("topup", "game"):
        allowed_types = {"topup"}

    gn_clean = clean_fzr_base_game_name(game_name).lower()
    candidates = [
        c for c in all_cats 
        if clean_fzr_base_game_name(c.get("display_name") or c.get("name")).lower() == gn_clean
    ]
    if allowed_types:
        filtered_cands = [c for c in candidates if c["provider_type"] in allowed_types]
        if filtered_cands:
            candidates = filtered_cands

    if not candidates and exact_cat:
        exact_base = clean_fzr_base_game_name(exact_cat.get("display_name") or exact_cat["name"]).lower()
        candidates = [
            c for c in all_cats
            if clean_fzr_base_game_name(c.get("display_name") or c.get("name")).lower() == exact_base
        ]
        if allowed_types:
            filtered_cands = [c for c in candidates if c["provider_type"] in allowed_types]
            if filtered_cands:
                candidates = filtered_cands

    if not candidates:
        candidates = [
            c for c in all_cats 
            if gn_clean in clean_fzr_base_game_name(c.get("display_name") or c.get("name")).lower()
        ]
        if allowed_types:
            filtered_cands = [c for c in candidates if c["provider_type"] in allowed_types]
            if filtered_cands:
                candidates = filtered_cands

    if not candidates and exact_cat:
        candidates = [exact_cat]

    if not candidates:
        raise HTTPException(404, f"Juego no encontrado: {game_name}")

    formatted_regions = []
    seen_reg_names = set()
    for it in candidates:
        reg_name, reg_prio = format_fzr_region_name(
            it.get("display_name") or it.get("name"),
            it["category_id"],
            it.get("region_key")
        )
        if reg_name in seen_reg_names:
            reg_name = f"{reg_name} (Opción {len(formatted_regions) + 1})"
        seen_reg_names.add(reg_name)
        formatted_regions.append({
            "name": reg_name,
            "raw_name": it["category_id"],
            "category_id": it["category_id"],
            "provider_type": it["provider_type"],
            "priority": reg_prio
        })
    formatted_regions.sort(key=lambda r: (r["priority"], r["name"]))

    chosen_cat = None
    if region:
        rp = region.strip().lower()
        chosen_cat = next((c for c in candidates if c["category_id"].lower() == rp), None)
        if not chosen_cat:
            chosen_cat = next((c for c in candidates if format_fzr_region_name(c.get("display_name") or c.get("name"), c["category_id"], c.get("region_key"))[0].lower() == rp), None)
        if not chosen_cat:
            chosen_cat = next((c for c in candidates if rp in c["category_id"].lower()), None)

    if not chosen_cat and formatted_regions:
        best_id = formatted_regions[0]["category_id"]
        chosen_cat = next((c for c in candidates if c["category_id"] == best_id), candidates[0])
    elif not chosen_cat:
        chosen_cat = candidates[0]

    from webapp.api.main import fzr_live_catalog_offers
    try:
        mapping, raw_offers = await fzr_live_catalog_offers(chosen_cat["provider_type"], chosen_cat["category_id"])
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error consultando ofertas FZR para {chosen_cat['category_id']}: {e}")
        raise HTTPException(502, "Error al consultar ofertas del proveedor FZR")

    gm = _parse_json_dict(store.get("game_markups"))
    default_markup = float(store.get("markup_percent") or 10.0)
    fallback_title = chosen_cat.get("display_name") or chosen_cat.get("name")
    markup = get_custom_game_markup(gm, game_name, fallback_name=fallback_title, default_markup=default_markup)
    tier_markup = get_store_tier_markup_pct(store)

    tailored_products = []
    for o in raw_offers:
        try:
            raw_cost = float(o.get("cost_usdt") or 0.0)
        except (ValueError, TypeError):
            raw_cost = 0.0

        # Costo base de Francho Shop según plan: Oro (+7%), Plata (+10%), Bronce (+14%)
        cost = round(raw_cost * (1.0 + (tier_markup / 100.0)), 2)
        sell_price = round(cost * (1 + (markup / 100.0)), 2)
        if sell_price < 0.10 and cost > 0:
            sell_price = round(cost + 0.10, 2)
        cup_price = int(round(sell_price * cup_rate)) if cup_rate > 0 else 0

        oid = o.get("offer_id") or o.get("id")
        tailored_products.append({
            "id": oid,
            "offer_id": oid,
            "name": o.get("name") or "Recarga",
            "base_cost": cost,
            "sell_price": sell_price,
            "cup_price": cup_price,
            "markup_applied": markup,
            "tier_markup": tier_markup,
            "required_fields": o.get("required_fields") or [],
            "is_available": bool(o.get("is_available", True)),
            "provider_type": chosen_cat["provider_type"],
            "category_id": chosen_cat["category_id"],
            "is_manual": False
        })

    store_display = store.get("store_name") or "esta tienda"
    inst = mapping.get("instructions") or chosen_cat.get("instructions") or ""
    desc = mapping.get("description") or chosen_cat.get("description") or ""
    cur_reg_name, _ = format_fzr_region_name(
        chosen_cat.get("display_name") or chosen_cat.get("name"),
        chosen_cat["category_id"],
        chosen_cat.get("region_key")
    )

    if cat_filter in ("giftcard", "gamekey"):
        inst = "Recibirás tu código o PIN digital de forma instantánea a tu correo o WhatsApp para canjear en la plataforma oficial."
        desc = "Entrega instantánea de código PIN oficial para canjear en la plataforma."
    elif inst:
        inst = inst.replace("Francho Shop", store_display).replace("FranchoShop", store_display)
    if cat_filter not in ("giftcard", "gamekey") and desc:
        desc = desc.replace("Francho Shop", store_display).replace("FranchoShop", store_display)

    res = {
        "ok": True,
        "game_name": game_name,
        "region": cur_reg_name,
        "region_raw": chosen_cat["category_id"],
        "category_id": chosen_cat["category_id"],
        "regions": formatted_regions,
        "markup_applied": markup,
        "cup_rate": cup_rate,
        "products": tailored_products,
        "instructions": inst,
        "description": desc
    }
    _store_products_cache[cache_key] = (now + 60, res)
    return res


# ══════════════════════════════════════════════════════════════════
#  ENDPOINTS DE NÚMEROS VIRTUALES (SMS) PARA TIENDAS REVENDEDORAS
# ══════════════════════════════════════════════════════════════════

@router.get("/public/web-store/{identifier}/sms/countries")
async def get_public_web_store_sms_countries(identifier: str):
    """Devuelve los países disponibles para números virtuales con banderas y orden optimizado."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    try:
        from webapp.api.fivesim_client import FiveSimClient
        fivesim = FiveSimClient()
        raw_countries = await fivesim.countries()
        if not raw_countries:
            return {"ok": True, "countries": [], "count": 0}

        featured_priority = {
            "usa": 1, "colombia": 2, "brazil": 3, "spain": 4, "mexico": 5, 
            "chile": 6, "argentina": 7, "peru": 8, "unitedkingdom": 9, 
            "canada": 10, "russia": 11, "indonesia": 12, "vietnam": 13,
            "france": 14, "germany": 15, "italy": 16, "portugal": 17
        }
        country_names_es = {
            "usa": "Estados Unidos", "colombia": "Colombia", "brazil": "Brasil", 
            "spain": "España", "mexico": "México", "chile": "Chile", 
            "argentina": "Argentina", "peru": "Perú", "unitedkingdom": "Reino Unido", 
            "canada": "Canadá", "russia": "Rusia", "indonesia": "Indonesia", 
            "vietnam": "Vietnam", "france": "Francia", "germany": "Alemania",
            "italy": "Italia", "portugal": "Portugal", "poland": "Polonia",
            "ukraine": "Ucrania", "turkey": "Turquía", "india": "India",
            "philippines": "Filipinas", "thailand": "Tailandia", "venezuela": "Venezuela"
        }

        from webapp.api.main import get_country_iso2
        items = []
        for c in raw_countries:
            ck = c.lower()
            iso = get_country_iso2(ck)
            flag = "".join([chr(127397 + ord(char)) for char in iso.upper()]) if iso and len(iso) == 2 else "🌐"
            prio = featured_priority.get(ck, 100)
            icon_url = f"/api/image-cache?url={urllib.parse.quote(f'https://flagcdn.com/w80/{iso.lower()}.png', safe='')}" if iso else ""
            items.append({
                "key": ck,
                "name": country_names_es.get(ck, c.title()),
                "flag_emoji": flag,
                "iso": iso,
                "icon_url": icon_url,
                "is_featured": ck in featured_priority,
                "priority": prio
            })
        items.sort(key=lambda x: (x["priority"], x["name"]))
        return {"ok": True, "countries": items, "count": len(items)}
    except Exception as e:
        log.error(f"Error cargando países SMS: {e}")
        return {"ok": True, "countries": [], "count": 0}


@router.get("/public/web-store/{identifier}/sms/services")
async def get_public_web_store_sms_services(identifier: str, country: str = Query("usa")):
    """Devuelve los servicios SMS disponibles en un país con precios minoristas calculados para este revendedor."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    clean_country = country.strip().lower()
    sms_cache_key = f"{clean_id}:{clean_country}"
    now = time.time()
    cached_sms = _store_sms_services_cache.get(sms_cache_key)
    if cached_sms and cached_sms[0] > now:
        return cached_sms[1]

    pm = _parse_json_dict(store.get("payment_methods"))
    cup_rate = float(pm.get("cup_manual", {}).get("exchange_rate_cup", 320.0))
    gm = _parse_json_dict(store.get("game_markups"))
    tc = _parse_json_dict(store.get("theme_config"))
    sms_cfg = tc.get("sms_config") or {}

    if not sms_cfg.get("enabled", True):
        return {"ok": True, "country": country, "services": [], "count": 0, "disabled": True}

    default_markup = float(store.get("markup_percent") or 15.0)
    sms_markup = float(sms_cfg.get("markup_percent") or gm.get("sms") or gm.get("numeros_virtuales") or max(default_markup, 20.0))

    try:
        from webapp.api.fivesim_client import FiveSimClient
        fivesim = FiveSimClient()
        clean_country = country.strip().lower()
        raw_products = await fivesim.products(clean_country, "any")
        if not isinstance(raw_products, dict):
            return {"ok": True, "country": clean_country, "services": [], "count": 0}

        service_slugs = {
            "whatsapp": "whatsapp", "telegram": "telegram", "google": "google", "gmail": "google",
            "openai": "openai", "chatgpt": "openai", "tiktok": "tiktok", "instagram": "instagram",
            "facebook": "facebook", "twitter": "x", "x": "x", "discord": "discord",
            "netflix": "netflix", "uber": "uber", "amazon": "amazon", "microsoft": "microsoft",
            "apple": "apple", "paypal": "paypal", "steam": "steam", "tinder": "tinder",
            "snapchat": "snapchat", "line": "line", "viber": "viber", "spotify": "spotify",
            "linkedin": "linkedin", "youtube": "youtube", "roblox": "roblox", "binance": "binance",
            "coinbase": "coinbase", "bybit": "bybit", "airbnb": "airbnb", "aliexpress": "aliexpress",
            "alibaba": "alibaba", "ebay": "ebay", "yahoo": "yahoo", "reddit": "reddit", "twitch": "twitch"
        }
        featured_services = ["whatsapp", "telegram", "google", "openai", "tiktok", "instagram", "facebook", "discord"]

        services = []
        for name, info in raw_products.items():
            qty = info.get("Qty", 0)
            if qty <= 0:
                continue
            cost = float(info.get("Price", 0.0))
            if cost <= 0:
                continue

            sell_price = round(max(cost * (1 + (sms_markup / 100.0)), 0.60), 2)
            cup_price = int(round(sell_price * cup_rate)) if cup_rate > 0 else 0

            s_key = name.lower()
            slug = service_slugs.get(s_key, s_key)
            if slug in ["openai", "amazon"]:
                raw_icon = f"https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/{slug}.svg"
            else:
                raw_icon = f"https://cdn.simpleicons.org/{slug}"
            icon_url = f"/api/image-cache?url={urllib.parse.quote(raw_icon, safe='')}"
            prio = featured_services.index(s_key) if s_key in featured_services else 100

            services.append({
                "key": s_key,
                "name": name.title() if s_key not in ["whatsapp", "openai"] else ("WhatsApp" if s_key == "whatsapp" else "OpenAI / ChatGPT"),
                "icon_url": icon_url,
                "slug": slug,
                "qty": qty,
                "base_cost": cost,
                "sell_price": sell_price,
                "cup_price": cup_price,
                "is_featured": s_key in featured_services,
                "priority": prio
            })

        services.sort(key=lambda s: (s["priority"], -s["qty"], s["name"]))
        res = {
            "ok": True,
            "country": clean_country,
            "markup_applied": sms_markup,
            "cup_rate": cup_rate,
            "services": services,
            "count": len(services)
        }
        _store_sms_services_cache[sms_cache_key] = (now + 60, res)
        return res
    except Exception as e:
        log.error(f"Error cargando servicios SMS para {country}: {e}")
        return {"ok": True, "country": country, "services": [], "count": 0}


@router.get("/public/web-store/{identifier}/sms/operators")
async def get_public_web_store_sms_operators(
    identifier: str, 
    country: str = Query(...), 
    service: str = Query(...)
):
    """Devuelve los operadores SMS disponibles para un país y servicio con precios del revendedor aplicados."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    clean_country = country.strip().lower()
    clean_service = service.strip().lower()

    tc = _parse_json_dict(store.get("theme_config"))
    sms_cfg = tc.get("sms_config") or {}
    if not sms_cfg.get("enabled", True):
        return {"ok": True, "country": clean_country, "service": clean_service, "items": [], "count": 0, "disabled": True}

    default_markup = float(store.get("markup_percent") or 15.0)
    sms_markup = float(sms_cfg.get("markup_percent", default_markup))

    if not fivesim:
        return {"ok": True, "country": clean_country, "service": clean_service, "items": [], "count": 0}

    try:
        data = await fivesim.prices(clean_country, clean_service)
        if not isinstance(data, dict) or clean_country not in data or clean_service not in data[clean_country]:
            return {"ok": True, "country": clean_country, "service": clean_service, "items": [], "count": 0}

        ops_data = data[clean_country][clean_service]
        items = []
        for op_name, info in ops_data.items():
            qty = int(info.get("count", 0))
            cost = float(info.get("cost", 0))
            sell_price = round(cost * (1.0 + (sms_markup / 100.0)), 2)
            items.append({
                "name": op_name,
                "cost": cost,
                "price": sell_price,
                "qty": qty,
                "rate": info.get("rate", 0)
            })
        items.sort(key=lambda x: (x["price"], -x["qty"]))
        return {"ok": True, "country": clean_country, "service": clean_service, "items": items, "count": len(items)}
    except Exception as e:
        log.error(f"Error obteniendo operadores SMS para {clean_country}/{clean_service}: {e}")
        return {"ok": True, "country": clean_country, "service": clean_service, "items": [], "count": 0}


@router.get("/public/web-store/{identifier}/sms/order/status")
async def get_public_web_store_sms_order_status(identifier: str, id: str = Query(...)):
    """Consulta el estado del código SMS de un número virtual en la tienda web."""
    lookup = id.strip()
    order = await db.get_sms_order_by_fivesim_id(lookup)
    if not order:
        try:
            order = await db.get_sms_order(int(lookup))
        except ValueError:
            pass

    if not order:
        raise HTTPException(404, "Orden SMS no encontrada")

    now = time.time()
    created_at = float(order.get("created_at") or now)
    elapsed = now - created_at

    if order["status"] == "pending":
        if elapsed >= 1200:
            if fivesim:
                try:
                    await fivesim.cancel(order["fivesim_order_id"])
                except Exception:
                    pass
            await db.refund_sms_order(order["id"], reason="Tiempo límite de espera excedido (20 min)")
            order = await db.get_sms_order(order["id"])
        elif fivesim:
            try:
                res_5sim = await fivesim.check(order["fivesim_order_id"])
                status_5sim = res_5sim.get("status")
                sms_list = res_5sim.get("sms") or []
                if sms_list and len(sms_list) > 0:
                    code = sms_list[0].get("code")
                    if code:
                        await db.update_sms_order_status(order["id"], "completed", code=str(code))
                        order = await db.get_sms_order(order["id"])
                elif status_5sim == "CANCELED":
                    await db.refund_sms_order(order["id"], reason="Cancelado por proveedor")
                    order = await db.get_sms_order(order["id"])
            except Exception as e:
                log.warning(f"Error verificando SMS 5sim {lookup}: {e}")

    return {
        "ok": True,
        "order": {
            "id": order["id"],
            "fivesim_order_id": order["fivesim_order_id"],
            "phone": order["phone"],
            "country": order["country"],
            "service": order["service"],
            "status": order["status"],
            "code": order.get("code"),
            "created_at": order["created_at"],
            "price": order.get("sell_price")
        }
    }


@router.post("/public/web-store/{identifier}/sms/order/create")
async def create_public_web_store_sms_order(
    identifier: str,
    payload: dict,
    user: dict = Depends(get_current_user)
):
    """Crea una reserva de número virtual SMS en la tienda del revendedor usando saldo USDT."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    country = str((payload or {}).get("country") or "").strip().lower()
    service = str((payload or {}).get("service") or "").strip().lower()
    operator = str((payload or {}).get("operator") or "any").strip().lower()

    if not country or not service:
        raise HTTPException(400, "País y servicio son requeridos")

    user_id = int(user["id"])
    balance = float(user.get("balance") or 0.0)

    tc = _parse_json_dict(store.get("theme_config"))
    sms_cfg = tc.get("sms_config") or {}
    if not sms_cfg.get("enabled", True):
        raise HTTPException(400, "La venta de números virtuales está desactivada en esta tienda")

    default_markup = float(store.get("markup_percent") or 15.0)
    sms_markup = float(sms_cfg.get("markup_percent", default_markup))

    if not fivesim:
        raise HTTPException(502, "El servicio de números virtuales no está disponible temporalmente")

    try:
        data = await fivesim.prices(country, service)
        if not isinstance(data, dict) or country not in data or service not in data[country]:
            raise HTTPException(400, "No hay stock disponible para esta combinación")
        operators_data = data[country][service]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Error validando stock: {str(e)}")

    candidate_operators = []
    if operator == "any":
        for op_name, info in operators_data.items():
            op_qty = int(info.get('count', 0))
            op_cost = float(info.get('cost', 0))
            if op_qty > 0 and op_cost > 0:
                candidate_operators.append((op_name, op_cost))
        candidate_operators.sort(key=lambda x: x[1])
    else:
        if operator in operators_data and int(operators_data[operator].get('count', 0)) > 0:
            candidate_operators.append((operator, float(operators_data[operator].get('cost', 0))))

    if not candidate_operators:
        raise HTTPException(400, "No hay números disponibles con stock para este país/operador")

    res_api = None
    target_operator = None
    actual_cost = None
    last_error = None

    for op_name, op_cost in candidate_operators:
        sell_price = round(max(op_cost * (1.0 + (sms_markup / 100.0)), 0.60), 2)
        if balance < sell_price:
            continue
        try:
            candidate_res = await fivesim.buy_activation(country, op_name, service)
            if candidate_res and candidate_res.get("id") and candidate_res.get("phone"):
                res_api = candidate_res
                target_operator = op_name
                actual_cost = float(candidate_res.get("price", op_cost))
                break
            else:
                raw_msg = candidate_res.get("raw") if isinstance(candidate_res, dict) else str(candidate_res)
                last_error = raw_msg or "no free phones"
        except Exception as e:
            last_error = str(e)

    fivesim_order_id = res_api.get("id") if res_api else None
    phone = res_api.get("phone") if res_api else None

    if not fivesim_order_id or not phone:
        msg = f"En este momento no hay números libres disponibles en el proveedor para {country}/{service}"
        if "no free phones" in str(last_error).lower():
            msg += " (el proveedor agotó las líneas temporales en este instante). Por favor intenta con otro operador o país."
        else:
            msg += f": {last_error}"
        raise HTTPException(400, msg)

    final_sell_price = round(max(actual_cost * (1.0 + (sms_markup / 100.0)), 0.60), 2)
    profit_for_reseller = round(max(0.0, final_sell_price - actual_cost), 2)

    success = await db.spend_balance(
        user_id,
        final_sell_price,
        ref_id=f"sms_{fivesim_order_id}",
        note=f"Número virtual {service} ({country}) en {store['store_name']}"
    )
    if not success:
        try:
            await fivesim.cancel(fivesim_order_id)
        except Exception:
            pass
        raise HTTPException(400, f"Saldo insuficiente. Necesitas ${final_sell_price:.2f} USDT y tu saldo es ${balance:.2f} USDT")

    reseller_id = store.get("user_id")
    if reseller_id and int(reseller_id) != user_id and profit_for_reseller > 0:
        await db.update_user_balance(
            reseller_id,
            profit_for_reseller,
            reason=f"Ganancia SMS en {store['store_name']}: {service} ({country}) (+${profit_for_reseller:.2f} USDT)"
        )

    order_local_id = await db.create_sms_order(
        user_id=user_id,
        fivesim_order_id=str(fivesim_order_id),
        phone=phone,
        country=country,
        service=service,
        operator=target_operator,
        cost_price=actual_cost,
        sell_price=final_sell_price,
        raw_response=json.dumps(res_api)
    )

    try:
        now_ts = time.time()
        order_num = random.randint(100, 999)
        m_oid = f"SMS_{store['slug'][:4]}_{int(now_ts)}_{order_num}"
        recharge_cfg = json.dumps({
            "fivesim_order_id": str(fivesim_order_id),
            "phone": phone,
            "country": country,
            "service": service,
            "operator": target_operator,
            "sms_order_id": order_local_id
        })
        async with aiosqlite.connect(db.DB) as conn:
            await conn.execute("""
                INSERT INTO orders (
                    merchant_order_id, user_id, user_role, product_id, product_name,
                    quantity, cost_price, sell_price, currency, order_status,
                    recharge_config, seller_id, sales_channel, payment_method,
                    payment_status, payment_currency, payment_amount,
                    provider_code, provider_offer_id,
                    created_at, updated_at
                ) VALUES (?, ?, 'customer', ?, ?, 1, ?, ?, 'USD', 1, ?, ?, ?, 'balance', 'paid', 'USDT', ?, 'sms', ?, ?, ?)
            """, (
                m_oid, user_id, f"sms_{country}_{service}", f"Número Virtual {service.title()} ({country.upper()})",
                actual_cost, final_sell_price, recharge_cfg, store["user_id"],
                f"webstore:{store['slug']}", final_sell_price, str(fivesim_order_id),
                now_ts, now_ts
            ))
            await conn.commit()
    except Exception as ex:
        log.warning(f"Error registrando en tabla orders unificada: {ex}")

    # Notificar al revendedor
    profit_sms = round(max(0.0, final_sell_price - actual_cost), 2)
    asyncio.create_task(notify_reseller_sale(store, {
        "order_id": order_local_id,
        "merchant_order_id": m_oid,
        "product_name": f"Número SMS {service.title()} ({country.upper()})",
        "client_name": f"Tel: {phone}",
        "sell_price": final_sell_price,
        "profit": profit_sms
    }))

    return {
        "ok": True,
        "id": order_local_id,
        "fivesim_order_id": str(fivesim_order_id),
        "phone": phone,
        "price": final_sell_price,
        "service": service,
        "country": country,
        "operator": target_operator,
        "status": "pending",
        "created_at": time.time()
    }


@router.post("/public/web-store/{identifier}/sms/order/cancel")
async def cancel_public_web_store_sms_order(
    identifier: str, 
    payload: dict,
    user: dict = Depends(get_current_user)
):
    """Cancela un número virtual SMS activo y reembolsa el saldo al cliente."""
    lookup = str((payload or {}).get("id") or "").strip()
    order = await db.get_sms_order_by_fivesim_id(lookup)
    if not order:
        try:
            order = await db.get_sms_order(int(lookup))
        except ValueError:
            pass

    if not order:
        raise HTTPException(404, "Orden SMS no encontrada")

    if int(order["user_id"]) != int(user["id"]):
        raise HTTPException(403, "No autorizado")

    if order["status"] != "pending":
        return {"ok": False, "message": f"La orden ya está en estado {order['status']}"}

    if fivesim:
        try:
            await fivesim.cancel(order["fivesim_order_id"])
        except Exception as e:
            log.warning(f"Error cancelando en 5sim: {e}")

    await db.refund_sms_order(order["id"], reason="Cancelado por el cliente en tienda web")

    try:
        clean_id = normalize_store_identifier(identifier)
        store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
        if store and store.get("user_id"):
            reseller_id = int(store["user_id"])
            profit = round(float(order.get("sell_price", 0)) - float(order.get("cost_price", 0)), 2)
            if reseller_id != int(user["id"]) and profit > 0:
                await db.update_user_balance(
                    reseller_id,
                    -profit,
                    reason=f"Reversión ganancia SMS cancelado en {store['store_name']}: {order.get('service')} (-${profit:.2f} USDT)"
                )
    except Exception as ex:
        log.warning(f"Error revirtiendo ganancia de revendedor: {ex}")

    updated = await db.get_sms_order(order["id"])
    return {"ok": True, "order": updated}


@router.post("/public/web-store/{identifier}/create-order")
async def create_public_web_store_order(
    identifier: str, 
    req: WebStoreOrderCreateRequest,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """Crea una orden desde la tienda del revendedor."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    now = time.time()
    order_num = random.randint(100, 999)
    merchant_order_id = f"WS_{store['slug'][:6]}_{int(now)}_{order_num}"
    recharge_cfg = json.dumps({
        "player_id": req.player_id,
        "zone_id": req.zone_id,
        "client_name": req.client_name,
        "client_contact": req.client_contact,
        "game_name": req.game_name,
        "buyer_user_id": user["id"] if user else None,
        "buyer_email": user.get("email") if user else None
    })

    is_manual = False
    mp = None
    manual_prod_id = None
    manual_opt_id = None
    try:
        p_id_str = str(req.product_id)
        if "_opt_" in p_id_str:
            parts = p_id_str.split("_opt_")
            manual_prod_id = int(parts[0].replace("manual_", ""))
            manual_opt_id = int(parts[1])
            mp = await db.get_manual_product(manual_prod_id)
        else:
            clean_pid = int(str(req.product_id).replace("manual_", ""))
            mp = await db.get_manual_product(clean_pid)
            manual_prod_id = clean_pid
        if mp and (mp.get("created_by") == store.get("user_id") or store.get("user_id") in getattr(config, "ADMIN_IDS", [])):
            is_manual = True
    except Exception:
        mp = None

    is_sms = bool(
        req.game_name.lower().startswith("número") or 
        req.game_name.lower().startswith("numero") or 
        "sms" in req.game_name.lower() or 
        str(req.product_id).startswith("sms_")
    )
    is_streaming = bool(
        str(req.product_id).startswith("sz_") or
        str(req.product_id).startswith("streaming_") or
        "streaming" in req.game_name.lower()
    )
    if is_manual:
        provider_code = "manual"
    elif is_sms:
        provider_code = "sms"
    elif is_streaming:
        provider_code = "streamzone"
    else:
        provider_code = "fzr"
    provider_offer_id = str(req.product_id)

    # Calcular costo base del proveedor y ganancia neta para el revendedor
    markup_pct = float(store.get("markup_percent") or 10.0)
    cost_base = float(req.amount_usd)
    profit_for_reseller = 0.0

    if is_manual and mp:
        cost_base = float(mp.get("price") or req.amount_usd)
        profit_for_reseller = float(req.amount_usd)
    elif is_sms:
        tc = _parse_json_dict(store.get("theme_config"))
        sms_cfg = tc.get("sms_config") or {}
        sms_mk = float(sms_cfg.get("markup_percent", markup_pct))
        cost_base = round(float(req.amount_usd) / (1.0 + (sms_mk / 100.0)), 2)
        profit_for_reseller = round(max(0.0, float(req.amount_usd) - cost_base), 2)
    else:
        gm = _parse_json_dict(store.get("game_markups"))
        applied_markup = get_custom_game_markup(gm, req.game_name, default_markup=markup_pct)
        cost_base = round(float(req.amount_usd) / (1.0 + (applied_markup / 100.0)), 2)
        profit_for_reseller = round(max(0.0, float(req.amount_usd) - cost_base), 2)

    if req.payment_method == "whatsapp":
        phone = (store.get("whatsapp_number") or "").replace("+", "").replace(" ", "").replace("-", "")
        ident_label = "Entrega / Contacto" if is_streaming else ("Teléfono / Contacto" if is_sms else ("Dato de Entrega" if is_manual else "Player ID"))
        icon_prefix = "📺" if is_streaming else ("📱" if is_sms else ("🛍️" if is_manual else "🎮"))
        zone_str = f" (Zona: {req.zone_id})" if req.zone_id and not (is_streaming or is_sms or is_manual) else ""
        msg = (
            f"Hola {store['store_name']}! Quiero comprar:\n"
            f"{icon_prefix} *{req.game_name}* - *{req.product_name}*\n"
            f"📋 *{ident_label}:* {req.player_id}{zone_str}\n"
            f"💰 *Total:* ${req.amount_usd:.2f} USDT\n"
            f"¿Me confirmas los datos para transferirte en USDT?"
        )
        import urllib.parse
        wa_url = f"https://wa.me/{phone}?text={urllib.parse.quote(msg)}" if phone else ""
        return {"ok": True, "type": "whatsapp", "whatsapp_url": wa_url}

    if req.payment_method == "balance":
        if not user:
            raise HTTPException(401, "Debes iniciar sesión para pagar con tu saldo USDT.")
        user_balance = float(user.get("balance") or 0.0)
        cost_total = float(req.amount_usd)
        if user_balance < cost_total:
            raise HTTPException(400, f"Saldo USDT insuficiente. Tu saldo es ${user_balance:.2f} USDT y el costo es ${cost_total:.2f} USDT.")

        # Descontar el total de la compra al cliente
        await db.update_user_balance(
            user["id"],
            -cost_total,
            reason=f"Compra en {store['store_name']}: {req.game_name} - {req.product_name}"
        )

        # Al revendedor se le acredita ÚNICAMENTE su ganancia sobre el costo base
        reseller_id = store.get("user_id")
        if reseller_id and int(reseller_id) != int(user["id"]) and profit_for_reseller > 0:
            await db.update_user_balance(
                reseller_id,
                profit_for_reseller,
                reason=f"Ganancia venta web en {store['store_name']}: {req.game_name} - {req.product_name} (+${profit_for_reseller:.2f} USDT)"
            )

        async with aiosqlite.connect(db.DB) as conn:
            cur = await conn.execute("""
                INSERT INTO orders (
                    merchant_order_id, user_id, user_role, product_id, product_name,
                    quantity, cost_price, sell_price, currency, order_status,
                    recharge_config, seller_id, sales_channel, payment_method,
                    payment_status, payment_currency, payment_amount,
                    provider_code, provider_offer_id,
                    created_at, updated_at
                ) VALUES (?, ?, 'customer', ?, ?, 1, ?, ?, 'USD', 1, ?, ?, ?, 'balance', 'paid', 'USDT', ?, ?, ?, ?, ?)
            """, (
                merchant_order_id, user["id"], str(req.product_id), req.product_name,
                cost_base, req.amount_usd, recharge_cfg, store["user_id"],
                f"webstore:{store['slug']}", req.amount_usd,
                provider_code, provider_offer_id,
                now, now
            ))
            order_id = cur.lastrowid
            await conn.commit()

        # Si es producto manual
        if mp and mp.get("created_by") == store.get("user_id"):
            try:
                cust_data = {
                    "player_id": req.player_id,
                    "zone_id": req.zone_id,
                    "client_name": req.client_name,
                    "client_contact": req.client_contact,
                    "payment_method": "balance",
                    "sales_channel": f"webstore:{store['slug']}",
                    "merchant_order_id": merchant_order_id
                }
                await db.create_manual_order(
                    product_id=req.product_id,
                    user_id=store["user_id"],
                    price=req.amount_usd,
                    customer_data=cust_data,
                    delivery_time=mp.get("delivery_time", "Inmediato")
                )
            except Exception as ex:
                log.warning(f"Error registrando orden manual con saldo en web store: {ex}")

        # Si es streaming, ejecutar entrega automática en StreamZone, enviar Gmail, Telegram y guardar credenciales
        streaming_delivery = None
        if is_streaming:
            try:
                streaming_delivery = await deliver_streaming_order(
                    order_id=order_id,
                    store=store,
                    user=user,
                    client_contact=req.client_contact,
                    player_id=req.player_id
                )
            except Exception as ex_sz:
                log.error(f"Falla entregando streaming con saldo en web store {merchant_order_id}: {ex_sz}")
                # Reembolsar saldo al usuario en caso de error de proveedor
                await db.update_user_balance(
                    user["id"],
                    cost_total,
                    reason=f"Reembolso automático por fallo de proveedor en {store['store_name']}: {str(ex_sz)}"
                )
                if reseller_id and int(reseller_id) != int(user["id"]) and profit_for_reseller > 0:
                    await db.update_user_balance(
                        reseller_id,
                        -profit_for_reseller,
                        reason=f"Cancelación ganancia por fallo de proveedor: {str(ex_sz)}"
                    )
                raise HTTPException(502, f"Error al procesar la entrega de tu cuenta: {str(ex_sz)}")

        # Notificar al revendedor en tiempo real
        sell_p = float(req.amount_usd)
        cost_p = float(cost_base)
        profit_usd = round(max(0.0, sell_p - cost_p), 2)
        asyncio.create_task(notify_reseller_sale(store, {
            "order_id": order_id,
            "merchant_order_id": merchant_order_id,
            "product_name": req.product_name,
            "client_name": req.client_name or (user.get("email") if user else "Cliente"),
            "sell_price": sell_p,
            "profit": profit_usd
        }))

        # Enviar comprobante de compra por correo al cliente si tiene correo disponible
        client_mail = (user.get("email") if user else None) or (req.client_contact if "@" in (req.client_contact or "") else None) or (req.player_id if "@" in (req.player_id or "") else None)
        if client_mail and not is_streaming:
            asyncio.create_task(notify_client_sale_receipt(store, {
                "order_id": order_id,
                "merchant_order_id": merchant_order_id,
                "product_name": req.product_name,
                "player_id": req.player_id,
                "amount_usd": sell_p,
                "client_email": client_mail
            }))

        return {
            "ok": True,
            "type": "balance",
            "order_id": order_id,
            "merchant_order_id": merchant_order_id,
            "credentials": (streaming_delivery.get("credentials") if streaming_delivery else []),
            "message": (
                "¡Suscripción entregada con éxito! Tus credenciales están visibles aquí en los detalles del pedido y han sido enviadas a tu Telegram y Gmail."
                if is_streaming else
                "¡Pago completado con éxito usando tu saldo USDT! Tu pedido está siendo procesado."
            )
        }

    if req.payment_method == "oxapay":
        # Todos los pagos en tiendas de revendedores van a la pasarela Master OxaPay oficial de Francho Shop
        merchant_key = getattr(config, "OXAPAY_MERCHANT_KEY", "")
        if not merchant_key:
            raise HTTPException(500, "La pasarela OxaPay central no está configurada en el servidor.")

        callback_url = f"https://franchoshop.com/api/public/web-store/{store['slug']}/oxapay-callback"
        ox_payload = {
            "merchant": merchant_key,
            "amount": float(req.amount_usd),
            "currency": "USD",
            "lifeTime": 30,
            "orderId": merchant_order_id,
            "description": f"{req.game_name} - {req.product_name} ({store['store_name']})",
            "callbackUrl": callback_url
        }
        try:
            async with aiohttp.ClientSession() as sess:
                async with sess.post("https://api.oxapay.com/merchants/request", json=ox_payload) as resp:
                    res = await resp.json()
                    if res.get("result") != 100 or not res.get("payLink"):
                        raise HTTPException(502, f"OxaPay: {res.get('message', 'No se pudo generar factura')}")
                    pay_url = res["payLink"]
                    track_id = res.get("trackId")
        except HTTPException:
            raise
        except Exception as e:
            log.error(f"Error generando factura OxaPay de revendedor: {e}")
            raise HTTPException(502, "Error al generar factura de OxaPay.")

        async with aiosqlite.connect(db.DB) as conn:
            cur = await conn.execute("""
                INSERT INTO orders (
                    merchant_order_id, user_id, user_role, product_id, product_name,
                    quantity, cost_price, sell_price, currency, order_status,
                    recharge_config, seller_id, sales_channel, payment_method,
                    payment_status, payment_currency, payment_amount,
                    provider_code, provider_offer_id,
                    created_at, updated_at
                ) VALUES (?, ?, 'customer', ?, ?, 1, ?, ?, 'USD', 0, ?, ?, ?, 'oxapay', 'pending_oxapay', 'USDT', ?, ?, ?, ?, ?)
            """, (
                merchant_order_id, user["id"] if user else store["user_id"], str(req.product_id), req.product_name,
                cost_base, req.amount_usd, recharge_cfg, store["user_id"],
                f"webstore:{store['slug']}", req.amount_usd,
                provider_code, provider_offer_id,
                now, now
            ))
            order_id = cur.lastrowid
            await conn.commit()

        return {"ok": True, "type": "oxapay", "pay_url": pay_url, "track_id": track_id, "order_id": order_id}

    if req.payment_method == "cup":
        raise HTTPException(400, "Los pagos en CUP están deshabilitados. Utilice OxaPay (USDT) o Saldo en Cuenta.")

    raise HTTPException(400, "Método de pago no admitido")


@router.post("/public/web-store/{identifier}/oxapay-callback")
async def web_store_oxapay_callback(identifier: str, request: Request):
    """Callback de OxaPay para cobros automáticos en tiendas de revendedores."""
    raw = await request.body()
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(400, "Payload no es JSON válido")

    order_id_str = str(payload.get("orderId") or payload.get("order_id") or "")
    status = str(payload.get("status") or "").lower()
    log.info(f"[WebStore OxaPay Callback] slug={identifier} orderId={order_id_str} status={status}")

    if status == "paid" and order_id_str:
        now = time.time()
        async with aiosqlite.connect(db.DB) as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute("SELECT * FROM orders WHERE merchant_order_id=?", (order_id_str,))
            ord_row = await cur.fetchone()
            if ord_row:
                order = dict(ord_row)
                sell_p = float(order.get("sell_price") or 0.0)
                cost_p = float(order.get("cost_price") or 0.0)
                reseller_id = order.get("seller_id")
                profit = round(max(0.0, sell_p - cost_p), 2)

                # Si no estaba pagada, acreditar la ganancia neta al revendedor
                if reseller_id and profit > 0 and order.get("payment_status") != "paid":
                    await db.update_user_balance(
                        reseller_id,
                        profit,
                        reason=f"Ganancia venta OxaPay en {identifier}: {order.get('product_name')} (+${profit:.2f} USDT)"
                    )
                    store_row = await db.get_web_store_by_slug(identifier) or await db.get_web_store_by_domain(identifier)
                    if store_row:
                        asyncio.create_task(notify_reseller_sale(store_row, {
                            "order_id": order.get("id") or order_id_str,
                            "merchant_order_id": order_id_str,
                            "product_name": order.get("product_name"),
                            "client_name": "Cliente Web (OxaPay)",
                            "sell_price": sell_p,
                            "profit": profit
                        }))
                        cfg_ord = _parse_json_dict(order.get("recharge_config"))
                        if order.get("provider_code") == "streamzone" or "streaming" in str(order.get("product_name")).lower():
                            asyncio.create_task(deliver_streaming_order(
                                order_id=order["id"],
                                store=store_row,
                                user=None,
                                client_contact=cfg_ord.get("client_contact"),
                                player_id=cfg_ord.get("player_id")
                            ))
                        elif order.get("provider_code") == "manual":
                            try:
                                prod_id_int = int(order.get("product_id"))
                                mp_info = await db.get_manual_product(prod_id_int)
                                cust_data = {
                                    "player_id": cfg_ord.get("player_id"),
                                    "zone_id": cfg_ord.get("zone_id"),
                                    "client_name": cfg_ord.get("client_name"),
                                    "client_contact": cfg_ord.get("client_contact"),
                                    "payment_method": "oxapay",
                                    "sales_channel": f"webstore:{identifier}",
                                    "merchant_order_id": order_id_str
                                }
                                await db.create_manual_order(
                                    product_id=prod_id_int,
                                    user_id=order.get("user_id") or store_row["user_id"],
                                    price=sell_p,
                                    customer_data=cust_data,
                                    delivery_time=(mp_info.get("delivery_time") if mp_info else "Inmediato")
                                )
                            except Exception as ex_m:
                                log.warning(f"Error registrando orden manual OxaPay en web store: {ex_m}")

                await conn.execute("""
                    UPDATE orders 
                    SET payment_status='paid', order_status=1, updated_at=? 
                    WHERE merchant_order_id=?
                """, (now, order_id_str))
                await conn.commit()
    return {"ok": True}


@router.post("/public/web-store/{identifier}/deposit")
async def create_public_web_store_deposit(
    identifier: str,
    req: WebStoreDepositRequest,
    user: dict = Depends(get_current_user)
):
    """Permite al cliente final recargar saldo USDT en la web del revendedor usando la pasarela Master OxaPay."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    merchant_key = getattr(config, "OXAPAY_MERCHANT_KEY", "")
    if not merchant_key:
        raise HTTPException(503, "Pasarela de pagos en USDT no disponible temporalmente.")

    now = time.time()
    order_num = random.randint(100, 999)
    deposit_id = f"DEP_WS_{store['slug'][:6]}_{user['id']}_{int(now)}_{order_num}"
    callback_url = f"https://franchoshop.com/api/public/web-store/{store['slug']}/deposit-callback"

    ox_payload = {
        "merchant": merchant_key,
        "amount": float(req.amount_usd),
        "currency": "USD",
        "lifeTime": 30,
        "orderId": deposit_id,
        "description": f"Recarga Saldo USDT en {store['store_name']}",
        "callbackUrl": callback_url
    }

    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post("https://api.oxapay.com/merchants/request", json=ox_payload) as resp:
                res = await resp.json()
                if res.get("result") != 100 or not res.get("payLink"):
                    raise HTTPException(502, f"OxaPay: {res.get('message', 'No se pudo generar factura')}")
                pay_url = res["payLink"]
                track_id = res.get("trackId")
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error generando depósito OxaPay: {e}")
        raise HTTPException(502, "Error al generar factura de depósito.")

    async with aiosqlite.connect(db.DB) as conn:
        await conn.execute("""
            INSERT INTO deposits (
                deposit_id, user_id, amount_usd, track_id, pay_link, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
        """, (deposit_id, user["id"], req.amount_usd, str(track_id), pay_url, now, now))
        await conn.commit()

    return {
        "ok": True,
        "pay_url": pay_url,
        "track_id": track_id,
        "amount_usd": req.amount_usd,
        "order_id": deposit_id
    }


@router.post("/public/web-store/{identifier}/deposit-callback")
async def web_store_deposit_callback(identifier: str, request: Request):
    """Callback de OxaPay para depósitos de clientes finales en tiendas web."""
    raw = await request.body()
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(400, "Payload no es JSON válido")

    order_id_str = str(payload.get("orderId") or payload.get("order_id") or "")
    status = str(payload.get("status") or "").lower()
    log.info(f"[WebStore Deposit Callback] slug={identifier} orderId={order_id_str} status={status}")

    if status == "paid" and order_id_str:
        now = time.time()
        async with aiosqlite.connect(db.DB) as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute("SELECT * FROM deposits WHERE deposit_id=?", (order_id_str,))
            dep_row = await cur.fetchone()
            if dep_row and dep_row["status"] != "paid":
                dep = dict(dep_row)
                amount = float(dep.get("amount_usd") or 0.0)
                user_id = dep.get("user_id")
                if user_id and amount > 0:
                    await db.update_user_balance(
                        user_id,
                        amount,
                        reason=f"Recarga saldo USDT en tienda {identifier} (+${amount:.2f} USDT)"
                    )
                await conn.execute("UPDATE deposits SET status='paid', updated_at=? WHERE id=?", (now, dep["id"]))
                await conn.commit()
    return {"ok": True}


async def _calculate_store_customers(store_slug: str, user_id: int):
    sales_channel_pattern = f"webstore:{store_slug}"

    async with aiosqlite.connect(db.DB) as conn:
        conn.row_factory = aiosqlite.Row
        cur = await conn.execute("""
            SELECT o.id, o.user_id, o.merchant_order_id, o.product_name, o.sell_price, 
                   o.cost_price, o.payment_status, o.recharge_config, o.created_at,
                   u.username, u.first_name, u.email, u.balance
            FROM orders o
            LEFT JOIN users u ON u.user_id = o.user_id
            WHERE o.sales_channel = ? OR o.seller_id = ?
            ORDER BY o.created_at DESC
        """, (sales_channel_pattern, user_id))
        orders = [dict(r) for r in await cur.fetchall()]

        cur2 = await conn.execute("""
            SELECT user_id, username, first_name, email, balance, created_at
            FROM users
            WHERE referred_by = ?
        """, (user_id,))
        referred = [dict(r) for r in await cur2.fetchall()]

    customer_map = {}
    for ord in orders:
        c_id = ord.get("user_id") or "guest"
        rc = {}
        try:
            rc = json.loads(ord.get("recharge_config") or "{}")
        except Exception:
            pass

        c_key = str(c_id) if c_id != "guest" else (rc.get("client_contact") or rc.get("player_id") or f"guest_{ord['id']}")
        name = ord.get("first_name") or ord.get("username") or rc.get("client_name") or f"Cliente #{str(c_key)[:6]}"
        contact = ord.get("email") or rc.get("client_contact") or "N/A"
        player_id = rc.get("player_id") or ""

        if c_key not in customer_map:
            customer_map[c_key] = {
                "id": c_key,
                "name": name,
                "contact": contact,
                "player_id": player_id,
                "balance": float(ord.get("balance") or 0.0) if c_id != "guest" else 0.0,
                "orders_count": 0,
                "total_spent": 0.0,
                "total_profit": 0.0,
                "last_order_at": ord.get("created_at"),
                "last_product": ord.get("product_name"),
                "is_registered": c_id != "guest"
            }

        if ord.get("payment_status") == "paid" or ord.get("order_status") in (1, 2):
            sp = float(ord.get("sell_price") or 0.0)
            cp = float(ord.get("cost_price") or 0.0)
            customer_map[c_key]["orders_count"] += 1
            customer_map[c_key]["total_spent"] += sp
            customer_map[c_key]["total_profit"] += max(0.0, sp - cp)

    for ref in referred:
        r_id = str(ref["user_id"])
        if r_id not in customer_map:
            customer_map[r_id] = {
                "id": r_id,
                "name": ref.get("first_name") or ref.get("username") or f"Usuario #{r_id}",
                "contact": ref.get("email") or "Registrado",
                "player_id": "",
                "balance": float(ref.get("balance") or 0.0),
                "orders_count": 0,
                "total_spent": 0.0,
                "total_profit": 0.0,
                "last_order_at": ref.get("created_at"),
                "last_product": "Registro en tienda",
                "is_registered": True
            }

    customers_list = list(customer_map.values())
    customers_list.sort(key=lambda c: (c["total_spent"], c["orders_count"]), reverse=True)

    total_revenue = sum(c["total_spent"] for c in customers_list)
    total_profit = sum(c["total_profit"] for c in customers_list)

    return {
        "ok": True,
        "customers": customers_list,
        "count": len(customers_list),
        "stats": {
            "total_customers": len(customers_list),
            "total_revenue_usdt": round(total_revenue, 2),
            "total_profit_usdt": round(total_profit, 2),
            "registered_count": len([c for c in customers_list if c["is_registered"]])
        }
    }


@router.get("/reseller/my-web-store/customers")
async def get_my_web_store_customers(user: dict = Depends(get_current_user)):
    """Devuelve la lista de clientes que han comprado o se han registrado en la tienda del revendedor."""
    user_id = user["id"]
    store = await db.get_web_store_by_user(user_id)
    if not store:
        raise HTTPException(404, "No tienes una tienda web configurada.")

    return await _calculate_store_customers(store["slug"], user_id)


@router.get("/public/web-store/{identifier}/customers")
async def get_public_web_store_customers(
    identifier: str,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """Devuelve la lista de clientes de la tienda web para el dueño o admin."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    is_owner = False
    if user:
        u_id = user.get("id") or user.get("user_id")
        try:
            is_owner = (int(u_id) == int(store["user_id"])) or (user.get("role") == "admin")
        except Exception:
            is_owner = False

    if not is_owner:
        raise HTTPException(403, "Solo el dueño de la tienda puede consultar los clientes.")

    return await _calculate_store_customers(store["slug"], store["user_id"])


@router.get("/public/web-store/{identifier}/orders")
async def get_public_web_store_orders(
    identifier: str,
    query: Optional[str] = Query(None),
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """Consulta órdenes de la tienda web para clientes (por cuenta o búsqueda) o para el dueño."""
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    store_channel = f"webstore:{store['slug']}"
    is_owner = False
    if user:
        u_id = user.get("id") or user.get("user_id")
        try:
            is_owner = (int(u_id) == int(store["user_id"])) or (user.get("role") == "admin")
        except Exception:
            is_owner = False

    clean_query = query.strip() if query else None

    # Si no es dueño, no está logueado y no pasó query, retornar vacío
    if not is_owner and not user and not clean_query:
        return {"ok": True, "orders": [], "is_owner": False}

    orders = []
    async with aiosqlite.connect(db.DB) as conn:
        conn.row_factory = aiosqlite.Row

        # Mapa de iconos para imágenes reales de productos
        icon_map = {}
        try:
            async with conn.execute("SELECT game_name, icon_url FROM game_icons WHERE icon_url IS NOT NULL AND icon_url != ''") as cur:
                for irow in await cur.fetchall():
                    icon_map[irow["game_name"].strip().lower()] = irow["icon_url"]
            async with conn.execute("SELECT category_id, image_url, name FROM fzr_catalog_categories WHERE image_url IS NOT NULL AND image_url != ''") as cur:
                for crow in await cur.fetchall():
                    if crow["image_url"]:
                        icon_map[str(crow["category_id"]).strip().lower()] = crow["image_url"]
                        if crow["name"]:
                            icon_map[str(crow["name"]).strip().lower()] = crow["image_url"]
        except Exception as e:
            log.warning(f"Error cargando iconos para órdenes de tienda: {e}")

        select_cols = """
            id, merchant_order_id, product_id, product_name, quantity, sell_price, currency,
            order_status, refund_status, recharge_config, card_data, payment_method,
            payment_status, payment_currency, payment_amount,
            cup_amount_snapshot, cup_payment_reference, provider_code, provider_order_id,
            provider_offer_id, created_at, updated_at
        """

        if is_owner:
            if clean_query:
                sql = f"""
                    SELECT {select_cols}
                    FROM orders
                    WHERE sales_channel = ?
                      AND (
                          CAST(id AS TEXT) = ? OR
                          merchant_order_id LIKE ? OR
                          recharge_config LIKE ? OR
                          cup_payment_reference LIKE ? OR
                          product_name LIKE ?
                      )
                    ORDER BY created_at DESC LIMIT 100
                """
                like_q = f"%{clean_query}%"
                params = [store_channel, clean_query, like_q, like_q, like_q, like_q]
            else:
                sql = f"""
                    SELECT {select_cols}
                    FROM orders
                    WHERE sales_channel = ?
                    ORDER BY created_at DESC LIMIT 100
                """
                params = [store_channel]
        elif user and not clean_query:
            # Buscar órdenes del cliente logueado (por user_id o por recharge_config)
            u_id = user.get("id") or user.get("user_id")
            u_id_int = int(u_id) if u_id and str(u_id).isdigit() else -1
            u_id_str = str(u_id) if u_id else ""
            u_email = str(user.get("email") or "")
            id_needle = f'%"buyer_user_id": {u_id_str}%'
            id_needle_str = f'%"buyer_user_id": "{u_id_str}"%'
            email_needle = f'%"buyer_email": "{u_email}"%'
            sql = f"""
                SELECT {select_cols}
                FROM orders
                WHERE sales_channel = ?
                  AND (
                      user_id = ? OR
                      recharge_config LIKE ? OR
                      recharge_config LIKE ? OR
                      (? != '' AND recharge_config LIKE ?)
                  )
                ORDER BY created_at DESC LIMIT 50
            """
            params = [store_channel, u_id_int, id_needle, id_needle_str, u_email, email_needle]
        else:
            # Búsqueda pública por query específico (Player ID, número de orden, teléfono)
            if not clean_query or len(clean_query) < 3:
                return {"ok": True, "orders": [], "is_owner": False, "message": "Escribe al menos 3 caracteres para buscar"}
            like_q = f"%{clean_query}%"
            sql = f"""
                SELECT {select_cols}
                FROM orders
                WHERE sales_channel = ?
                  AND (
                      CAST(id AS TEXT) = ? OR
                      merchant_order_id LIKE ? OR
                      recharge_config LIKE ? OR
                      cup_payment_reference LIKE ?
                  )
                ORDER BY created_at DESC LIMIT 30
            """
            params = [store_channel, clean_query, like_q, like_q, like_q]

        cur = await conn.execute(sql, params)
        rows = await cur.fetchall()
        for r in rows:
            cfg = _parse_json_dict(r["recharge_config"])
            st = r["order_status"]
            pay_st = r["payment_status"] or ""
            prov_code = (r["provider_code"] or "").lower()
            prov_offer = r["provider_offer_id"] or ""
            card_data = r["card_data"] or ""

            if st == 2:
                status_label = "Completado"
                status_code = "completed"
            elif st == 1 or pay_st in ("paid", "completed"):
                status_label = "Procesando"
                status_code = "processing"
            elif st in (-1, 3) or pay_st in ("refunded", "cancelled"):
                status_label = "Cancelado / Reembolsado"
                status_code = "cancelled"
            else:
                status_label = "Pendiente de Pago"
                status_code = "pending"

            is_sms = prov_code == "sms" or "sms" in (r["product_name"] or "").lower() or bool(cfg.get("fivesim_order_id")) or bool(cfg.get("phone"))
            is_streaming = prov_code in ("streaming", "streamzone") or "streaming" in (r["product_name"] or "").lower() or bool(cfg.get("credentials"))
            is_manual = prov_code == "manual"

            order_type = "sms" if is_sms else ("streaming" if is_streaming else ("manual" if is_manual else ("fzr" if prov_code == "fzr" else "auto")))

            phone = cfg.get("phone") or ""
            sms_code = cfg.get("sms_code") or cfg.get("code") or ""
            fivesim_id = cfg.get("fivesim_order_id") or prov_offer or ""

            # Si es SMS, consultar estado actual de sms_orders para obtener el live code
            if is_sms and fivesim_id:
                try:
                    async with conn.execute(
                        "SELECT phone, code, status FROM sms_orders WHERE fivesim_order_id = ? OR id = ? LIMIT 1",
                        (str(fivesim_id), str(cfg.get("sms_order_id") or fivesim_id))
                    ) as s_cur:
                        s_row = await s_cur.fetchone()
                        if s_row:
                            if s_row["phone"] and not phone:
                                phone = s_row["phone"]
                            if s_row["code"]:
                                sms_code = s_row["code"]
                            if s_row["status"]:
                                if s_row["status"] == "completed":
                                    status_label = "Completado"
                                    status_code = "completed"
                                elif s_row["status"] in ("canceled", "refunded", "timeout"):
                                    status_label = "Cancelado / Reembolsado"
                                    status_code = "cancelled"
                except Exception:
                    pass

            if is_sms and not sms_code and st == 2:
                sms_code = cfg.get("sms_code") or cfg.get("code") or ""

            # Resolver imagen del producto
            product_image = ""
            p_name = (r["product_name"] or "").strip().lower()
            g_name = (cfg.get("game_name") or "").strip().lower()

            if g_name and g_name in icon_map:
                product_image = icon_map[g_name]
            elif p_name:
                for k, url in icon_map.items():
                    if k in p_name or p_name.startswith(k):
                        product_image = url
                        break
            if not product_image:
                if "free fire" in p_name:
                    product_image = icon_map.get("free fire") or "/game-covers/freefire.jpg"
                elif "mobile legends" in p_name or "mlbb" in p_name:
                    product_image = icon_map.get("mobile legends") or "/game-covers/mobilelegends.jpg"
                elif "roblox" in p_name:
                    product_image = icon_map.get("roblox") or "/game-covers/roblox.jpg"
                elif "cod" in p_name or "call of duty" in p_name:
                    product_image = icon_map.get("call of duty") or "/game-covers/codm.jpg"
                elif "pubg" in p_name:
                    product_image = icon_map.get("pubg mobile") or "/game-covers/pubg.jpg"
                elif is_sms or "sms" in p_name:
                    product_image = "https://img.icons8.com/color/512/sim-card.png"

            # Parsear credenciales si existen
            credentials = cfg.get("credentials") or []
            if isinstance(credentials, str):
                try:
                    credentials = json.loads(credentials)
                except Exception:
                    credentials = []

            # Lista de detalles de recarga
            recharge_details = []
            if cfg.get("player_id"):
                recharge_details.append({"label": "ID de Jugador", "value": str(cfg["player_id"])})
            if cfg.get("zone_id"):
                recharge_details.append({"label": "Zona / Servidor", "value": str(cfg["zone_id"])})
            if cfg.get("server"):
                recharge_details.append({"label": "Servidor", "value": str(cfg["server"])})
            if cfg.get("nickname"):
                recharge_details.append({"label": "Apodo / Nickname", "value": str(cfg["nickname"])})
            if cfg.get("client_name"):
                recharge_details.append({"label": "Cliente", "value": str(cfg["client_name"])})
            if cfg.get("client_contact"):
                recharge_details.append({"label": "Contacto", "value": str(cfg["client_contact"])})

            orders.append({
                "id": r["id"],
                "merchant_order_id": r["merchant_order_id"],
                "product_name": r["product_name"],
                "quantity": r["quantity"],
                "sell_price": float(r["sell_price"] or 0.0),
                "currency": r["currency"] or "USD",
                "order_status": st,
                "status_label": status_label,
                "status_code": status_code,
                "type": order_type,
                "product_image": product_image,
                "payment_method": r["payment_method"],
                "payment_status": pay_st,
                "payment_amount": float(r["payment_amount"] or 0.0),
                "payment_currency": r["payment_currency"] or "USD",
                "cup_amount": float(r["cup_amount_snapshot"] or 0.0) if r["cup_amount_snapshot"] else None,
                "cup_reference": r["cup_payment_reference"],
                "created_at": r["created_at"],
                "player_id": cfg.get("player_id"),
                "zone_id": cfg.get("zone_id"),
                "game_name": cfg.get("game_name"),
                "client_name": cfg.get("client_name"),
                "client_contact": cfg.get("client_contact"),
                "phone": phone,
                "sms_code": sms_code,
                "code": sms_code,
                "country": cfg.get("country"),
                "service": cfg.get("service"),
                "fivesim_order_id": fivesim_id,
                "card_data": card_data,
                "credentials": credentials,
                "recharge_details": recharge_details,
            })

    return {"ok": True, "orders": orders, "is_owner": is_owner}


# ══════════════════════════════════════════════════════════════════
#  ENDPOINTS DE GESTIÓN PARA EL REVENDEDOR
# ══════════════════════════════════════════════════════════════════

@router.get("/reseller/my-web-store")
async def get_my_web_store(user: dict = Depends(get_current_user)):
    """Devuelve la tienda del usuario actual con su estado de suscripción y planes disponibles."""
    user_id = user["id"]
    store = await db.get_web_store_by_user(user_id)
    user_db = await db.get_user(user_id)
    current_balance = float(user_db.get("balance", 0.0) if user_db else 0.0)

    now = time.time()
    store_data = None
    if store:
        expires_at = float(store.get("expires_at") or 0)
        days_left = max(0, int((expires_at - now) / 86400))
        is_expired = expires_at < now
        plan_key = store.get("plan", "basico")

        tc = _parse_json_dict(store.get("theme_config"))
        store_data = {
            **store,
            "theme_config": tc,
            "sms_config": tc.get("sms_config") or {
                "enabled": True, 
                "markup_percent": float(store.get("markup_percent") or 15.0),
                "featured_services": ["whatsapp", "telegram", "google", "openai", "tiktok"]
            },
            "game_markups": _parse_json_dict(store.get("game_markups")),
            "payment_methods": _parse_json_dict(store.get("payment_methods")),
            "email_config": _parse_json_dict(store.get("email_config")),
            "notification_prefs": _parse_json_dict(store.get("notification_prefs")) or {"notify_telegram": True, "notify_email": True},
            "telegram_bot_token": store.get("telegram_bot_token") or "",
            "telegram_bot_username": store.get("telegram_bot_username") or "",
            "telegram_bot_active": bool(store.get("telegram_bot_active")),
            "store_mode": store.get("store_mode") or "both",
            "bot_url": f"https://t.me/{store['telegram_bot_username']}" if store.get("telegram_bot_username") else "",
            "mini_app_url": f"https://franchoshop.com/s/{store['slug']}",
            "days_left": days_left,
            "is_expired": is_expired,
            "expires_at_formatted": time.strftime("%Y-%m-%d %H:%M", time.localtime(expires_at)),
            "plan_info": PLANS_CONFIG.get(plan_key, PLANS_CONFIG["basico"]),
            "subdomain_url": f"https://{store['slug']}.franchoshop.com",
            "vip_subdomain_url": f"https://{store['slug']}.topupsh.com" if plan_key in ("oro", "pro", "tienda_pro") else None
        }

    return {
        "ok": True,
        "store": store_data,
        "plans": PLANS_CONFIG,
        "user_balance": current_balance
    }


@router.post("/reseller/my-web-store/save")
async def save_my_web_store(req: StoreSaveRequest, user: dict = Depends(get_current_user)):
    """Crea o actualiza la configuración de la tienda del usuario."""
    user_id = user["id"]

    slug = req.slug.strip().lower()
    if not re.match(r"^[a-z0-9][a-z0-9\-]{1,28}[a-z0-9]$", slug):
        raise HTTPException(
            400,
            "El subdominio debe tener entre 3 y 30 caracteres, solo letras minúsculas, números o guiones."
        )

    if slug in RESERVED_SLUGS:
        raise HTTPException(400, f"El subdominio '{slug}' está reservado para el sistema.")

    # Verificar si el slug ya está en uso por otro usuario (los admin comparten propiedad)
    existing_slug = await db.get_web_store_by_slug(slug)
    is_admin_same = (user_id in getattr(config, "ADMIN_IDS", []) and existing_slug and existing_slug.get("user_id") in getattr(config, "ADMIN_IDS", []))
    if existing_slug and existing_slug["user_id"] != user_id and not is_admin_same:
        raise HTTPException(400, f"El subdominio '{slug}' ya está ocupado por otro revendedor.")

    # Verificar dominio propio
    custom_domain = (req.custom_domain or "").strip().lower()
    if custom_domain:
        # Verificar si su plan permite dominio propio
        current_store = await db.get_web_store_by_user(user_id)
        current_plan = (current_store.get("plan") or "bronce").lower().strip() if current_store else "bronce"
        plan_info = PLANS_CONFIG.get(current_plan, {})
        allowed = plan_info.get("allowed_features", {}).get("custom_domain", False)
        if not allowed and current_plan not in ("oro", "pro", "tienda_pro"):
            raise HTTPException(403, "El dominio propio está disponible exclusivamente en el Plan Oro VIP ($7.99/mes).")

        existing_dom = await db.get_web_store_by_domain(custom_domain)
        if existing_dom and existing_dom["user_id"] != user_id:
            raise HTTPException(400, f"El dominio '{custom_domain}' ya está registrado.")

    store_dict = req.dict()
    if req.email_config:
        ec = dict(req.email_config)
        if "smtp_app_password" in ec and ec["smtp_app_password"]:
            ec["smtp_app_password"] = str(ec["smtp_app_password"]).replace(" ", "").strip()
        store_dict["email_config"] = ec
        if ec.get("smtp_user") and not store_dict.get("contact_email"):
            store_dict["contact_email"] = ec.get("smtp_user")
    if req.sms_config:
        tc = store_dict.get("theme_config") or {}
        tc["sms_config"] = req.sms_config
        store_dict["theme_config"] = tc
    updated_store = await db.upsert_web_store(user_id, store_dict)
    _store_catalog_cache.clear()
    _store_products_cache.clear()

    if updated_store.get("slug"):
        asyncio.create_task(provision_subdomain_ssl(updated_store["slug"]))
    if custom_domain:
        asyncio.create_task(provision_custom_domain_ssl(custom_domain))

    return {
        "ok": True,
        "message": "¡Tienda guardada con éxito!",
        "store": updated_store,
        "url": f"https://{updated_store['slug']}.franchoshop.com"
    }


@router.post("/reseller/my-web-store/test-smtp")
async def test_reseller_smtp(req: ResellerSmtpTestRequest, user: dict = Depends(get_current_user)):
    """Prueba las credenciales de Gmail (correo y contraseña de aplicación de 16 caracteres) del revendedor."""
    clean_user = req.smtp_user.strip()
    clean_pass = req.smtp_app_password.replace(" ", "").strip()
    clean_sender = (req.sender_name or "Mi Tienda").strip()
    target_email = (req.test_recipient or clean_user).strip()

    if not clean_user or "@" not in clean_user:
        raise HTTPException(400, "Debes ingresar una dirección de correo Gmail válida.")
    if not clean_pass or len(clean_pass) < 14:
        raise HTTPException(400, "La contraseña de aplicación de Google debe tener 16 caracteres (sin espacios).")

    subject = f"🧪 Prueba de Conexión Exitosa — {clean_sender}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 520px; margin: auto;">
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #22c55e22; border: 1px solid #22c55e; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px;">
                ✅
            </div>
            <h2 style="color: #22c55e; margin: 12px 0 4px 0;">¡Conexión Gmail Verificada!</h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">Configuración de Correo para {clean_sender}</p>
        </div>
        <div style="background-color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 6px 0; font-size: 14px;"><b>📧 Remitente:</b> {clean_user}</p>
            <p style="margin: 6px 0; font-size: 14px;"><b>🏷️ Nombre Comercial:</b> {clean_sender}</p>
            <p style="margin: 6px 0; font-size: 14px;"><b>🔐 Autenticación:</b> Google App Password (16 caracteres)</p>
            <p style="margin: 6px 0; font-size: 14px;"><b>⚡ Estado:</b> Listo para enviar notificaciones automáticas a tus clientes</p>
        </div>
        <p style="color: #cbd5e1; font-size: 13px; line-height: 1.5;">
            Tus clientes recibirán confirmaciones de compra, entregas de cuentas y alertas directamente con tu nombre y dirección de correo.
        </p>
        <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 24px;">
            Enviado desde el sistema de tiendas de revendedores Francho Shop
        </p>
    </div>
    """

    ok, err_msg = await send_email_ex(
        to=target_email,
        subject=subject,
        html_body=html_body,
        smtp_user=clean_user,
        smtp_pass=clean_pass,
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        sender_name=clean_sender
    )

    if not ok:
        raise HTTPException(400, f"Error al verificar credenciales con Google: {err_msg}")

    return {
        "ok": True,
        "message": f"¡Correo de prueba enviado con éxito a {target_email}! Revisa tu bandeja de entrada o spam."
    }


@router.post("/reseller/my-web-store/subscribe")
async def subscribe_my_web_store(req: SubscribeRequest, user: dict = Depends(get_current_user)):
    """Paga o renueva la suscripción de la tienda usando el saldo del usuario."""
    user_id = user["id"]
    plan_key = req.plan
    cycle = req.billing_cycle

    plan_info = PLANS_CONFIG.get(plan_key)
    if not plan_info:
        raise HTTPException(400, "Plan no válido")

    cycle_key = cycle
    if cycle == "monthly":
        cycle_key = "1_month"
    elif cycle == "yearly":
        cycle_key = "12_months"

    cycles_dict = plan_info.get("cycles", {})
    if cycle_key in cycles_dict:
        cycle_info = cycles_dict[cycle_key]
        cost = float(cycle_info["price"])
        duration_days = int(cycle_info["days"])
    else:
        cost = plan_info["price_yearly"] if cycle in ("yearly", "12_months") else plan_info["price_monthly"]
        duration_days = 365 if cycle in ("yearly", "12_months") else 30

    # Obtener o crear tienda borrador si el usuario aún no la ha guardado
    store = await db.get_web_store_by_user(user_id)
    if not store:
        chosen_slug = (req.slug or "").strip().lower()
        if chosen_slug:
            chosen_slug = re.sub(r"[^a-z0-9-]", "", chosen_slug)[:30]
        if not chosen_slug or len(chosen_slug) < 3 or chosen_slug in RESERVED_SLUGS:
            user_db = await db.get_user(user_id)
            chosen_slug = re.sub(r"[^a-z0-9]", "", (user_db.get("username") or f"user{user_id}").lower())[:15]
            if len(chosen_slug) < 3:
                chosen_slug = f"store{user_id}"
        
        # Verificar que el slug no exista
        if await db.get_web_store_by_slug(chosen_slug):
            chosen_slug = f"{chosen_slug}{random.randint(10, 99)}"

        user_db = await db.get_user(user_id)
        chosen_name = (req.store_name or "").strip() or (user_db.get("first_name") or f"Tienda {user_id}")

        store = await db.upsert_web_store(user_id, {
            "slug": chosen_slug,
            "store_name": chosen_name,
            "markup_percent": 10.0
        })

    # Verificar saldo
    current_balance = await db.get_balance(user_id)
    if current_balance < cost:
        raise HTTPException(
            400,
            f"Saldo insuficiente. Esta suscripción cuesta ${cost:.2f} USDT y tu saldo disponible es de ${current_balance:.2f} USDT. Recarga saldo en tu billetera para activar."
        )

    # Descontar saldo atómicamente
    ref_id = f"WS_SUB_{store['id']}_{int(time.time())}"
    note = f"Suscripción Tienda Web: {plan_info['name']} ({cycle})"
    ok = await db.spend_balance(user_id, cost, ref_id=ref_id, note=note)
    if not ok:
        raise HTTPException(400, "No se pudo procesar el cobro de saldo.")

    # Extender vigencia y registrar factura
    updated_store = await db.record_web_store_subscription(
        store_id=store["id"],
        user_id=user_id,
        plan=plan_key,
        billing_cycle=cycle,
        days=duration_days,
        amount=cost
    )

    new_balance = await db.get_balance(user_id)

    if updated_store.get("slug"):
        asyncio.create_task(provision_subdomain_ssl(updated_store["slug"]))

    return {
        "ok": True,
        "message": f"¡Suscripción al {plan_info['name']} activada exitosamente por {duration_days} días!",
        "store": updated_store,
        "new_balance": new_balance,
        "expires_at_formatted": time.strftime("%Y-%m-%d %H:%M", time.localtime(updated_store["expires_at"]))
    }


# ══════════════════════════════════════════════════════════════════
#  TELEGRAM BOT & MINI APP AUTOMATION (ONE-CLICK SETUP)
# ══════════════════════════════════════════════════════════════════

@router.post("/reseller/my-web-store/setup-telegram-bot")
async def setup_my_web_store_telegram_bot(
    req: SetupTelegramBotRequest,
    user: dict = Depends(get_current_user)
):
    """
    Configura y valida el Bot de Telegram del revendedor en 1 solo paso:
    1. Valida el token con getMe de Telegram.
    2. Configura el botón de menú inferior del bot (Mini App / web_app) apuntando a la tienda.
    3. Configura la descripción y descripción corta del bot.
    4. Activa el webhook para atender automáticamente el comando /start con bienvenida y botón de apertura.
    5. Guarda el token y estado activo en la base de datos.
    """
    user_id = user["id"]
    store = await db.get_web_store_by_user(user_id)
    if not store:
        raise HTTPException(404, "Debes guardar la configuración básica de tu tienda antes de vincular tu Bot de Telegram.")

    token = req.bot_token.strip()
    if not re.match(r"^\d{8,12}:[A-Za-z0-9_-]{35,}$", token):
        raise HTTPException(400, "Formato de Token de Bot de Telegram inválido. Asegúrate de copiar el token completo entregado por @BotFather.")

    slug = store["slug"]
    store_name = store.get("store_name", "Mi Tienda")
    store_url = f"https://franchoshop.com/s/{slug}"
    webhook_url = f"https://franchoshop.com/api/public/reseller-bot/webhook/{slug}"

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
        # 1. Validar Token con getMe
        try:
            async with session.get(f"https://api.telegram.org/bot{token}/getMe") as resp:
                data = await resp.json()
                if not data.get("ok"):
                    desc = data.get("description", "Token inválido")
                    raise HTTPException(400, f"Telegram rechazó el token: {desc}")
                bot_info = data.get("result", {})
                bot_username = bot_info.get("username", "")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(502, f"Error al contactar con la API de Telegram: {e}")

        # 2. Configurar botón de Menú (Mini App directa)
        try:
            menu_payload = {
                "menu_button": {
                    "type": "web_app",
                    "text": "Web",
                    "web_app": {
                        "url": store_url
                    }
                }
            }
            async with session.post(f"https://api.telegram.org/bot{token}/setChatMenuButton", json=menu_payload) as resp:
                menu_res = await resp.json()
                if not menu_res.get("ok"):
                    log.warning(f"Advertencia al configurar setChatMenuButton para @{bot_username}: {menu_res}")
        except Exception as e:
            log.warning(f"Error configurando botón de menú en Telegram: {e}")

        # 3. Configurar descripciones del bot
        try:
            desc_payload = {
                "description": (
                    f"👋 Bienvenido a la Tienda Oficial de {store_name}.\n\n"
                    f"🎮 Recargas automáticas 24/7 (Free Fire, Mobile Legends, COD, Roblox)\n"
                    f"🎬 Cuentas Premium de Streaming y entretenimiento\n"
                    f"📲 Números virtuales SMS instantáneos\n\n"
                    f"Toca el botón 'Web' o escribe /start para ver el catálogo y comprar."
                )
            }
            async with session.post(f"https://api.telegram.org/bot{token}/setMyDescription", json=desc_payload):
                pass

            short_desc_payload = {
                "short_description": f"Tienda Oficial de {store_name} 🛍️ Recargas de juegos y streaming 24/7"
            }
            async with session.post(f"https://api.telegram.org/bot{token}/setMyShortDescription", json=short_desc_payload):
                pass
        except Exception as e:
            log.warning(f"Error configurando descripciones del bot: {e}")

        # 4. Configurar Webhook para auto-respuesta al /start
        try:
            wh_payload = {
                "url": webhook_url,
                "drop_pending_updates": True,
                "allowed_updates": ["message"]
            }
            async with session.post(f"https://api.telegram.org/bot{token}/setWebhook", json=wh_payload) as resp:
                wh_res = await resp.json()
                if not wh_res.get("ok"):
                    log.warning(f"Advertencia configurando webhook del bot @{bot_username}: {wh_res}")
        except Exception as e:
            log.warning(f"Error configurando webhook en Telegram: {e}")

    # 5. Guardar en Base de Datos
    np_prefs = req.notification_prefs or {"notify_telegram": True, "notify_email": True}
    now = time.time()
    async with aiosqlite.connect(db.DB) as conn:
        await conn.execute("""
            UPDATE reseller_web_stores
            SET telegram_bot_token = ?,
                telegram_bot_username = ?,
                telegram_bot_active = 1,
                notification_prefs = ?,
                store_mode = ?,
                updated_at = ?
            WHERE user_id = ?
        """, (token, bot_username, json.dumps(np_prefs), req.store_mode or "both", now, user_id))
        await conn.commit()

    return {
        "ok": True,
        "message": f"¡Bot @{bot_username} vinculado exitosamente y configurado como Telegram Mini App!",
        "bot_username": bot_username,
        "bot_url": f"https://t.me/{bot_username}",
        "mini_app_url": store_url,
        "store_mode": req.store_mode or "both",
        "notification_prefs": np_prefs
    }


@router.post("/reseller/my-web-store/disconnect-telegram-bot")
async def disconnect_my_web_store_telegram_bot(user: dict = Depends(get_current_user)):
    """Desvincula el bot de Telegram y desactiva el webhook y el botón de menú."""
    user_id = user["id"]
    store = await db.get_web_store_by_user(user_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")

    token = store.get("telegram_bot_token")
    if token:
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as session:
                await session.post(f"https://api.telegram.org/bot{token}/deleteWebhook")
                await session.post(f"https://api.telegram.org/bot{token}/setChatMenuButton", json={"menu_button": {"type": "default"}})
        except Exception as e:
            log.warning(f"Error limpiando bot en Telegram al desconectar: {e}")

    now = time.time()
    async with aiosqlite.connect(db.DB) as conn:
        await conn.execute("""
            UPDATE reseller_web_stores
            SET telegram_bot_token = NULL,
                telegram_bot_username = NULL,
                telegram_bot_active = 0,
                updated_at = ?
            WHERE user_id = ?
        """, (now, user_id))
        await conn.commit()

    return {"ok": True, "message": "Bot de Telegram desconectado correctamente."}


@router.post("/public/reseller-bot/webhook/{identifier}")
async def handle_reseller_bot_webhook(identifier: str, request: Request):
    """
    Atiende automáticamente las interacciones de los clientes en el Bot de Telegram del revendedor.
    Cuando un cliente envía /start, responde con saludo de marca y botón nativo para abrir la Mini App.
    """
    clean_id = normalize_store_identifier(identifier)
    store = await db.get_web_store_by_slug(clean_id) or await db.get_web_store_by_domain(clean_id)
    if not store or not store.get("telegram_bot_token") or not store.get("telegram_bot_active"):
        return {"ok": True, "ignored": "Store not found or bot inactive"}

    token = store["telegram_bot_token"]
    try:
        body = await request.json()
    except Exception:
        return {"ok": True, "error": "Invalid JSON"}

    message = body.get("message")
    if not message:
        return {"ok": True}

    chat_id = message.get("chat", {}).get("id")
    text = (message.get("text") or "").strip()
    from_user = message.get("from", {})
    first_name = from_user.get("first_name", "Gamer")
    user_id = from_user.get("id")

    store_name = store.get("store_name", "Mi Tienda")
    tagline = store.get("tagline") or "Recargas y Cuentas 24/7"
    slug = store["slug"]
    store_url = f"https://franchoshop.com/s/{slug}"
    whatsapp = store.get("whatsapp_number") or ""

    is_owner = (user_id and (user_id == store.get("user_id") or str(user_id) == str(store.get("user_id"))))

    # Teclado inline con botón de Mini App
    keyboard_rows = [
        [
            {
                "text": "🛍️ Abrir Tienda (Mini App)",
                "web_app": {"url": store_url}
            }
        ]
    ]

    if whatsapp:
        clean_wa = re.sub(r"[^0-9]", "", whatsapp)
        keyboard_rows.append([
            {
                "text": "💬 Soporte por WhatsApp",
                "url": f"https://wa.me/{clean_wa}"
            }
        ])

    if is_owner:
        keyboard_rows.append([
            {
                "text": "👑 Modo Dueño (Ajustes)",
                "web_app": {"url": f"{store_url}?owner=1"}
            }
        ])

    reply_text = (
        f"👋 <b>¡Hola, {first_name}!</b> Bienvenido a <b>{store_name}</b> 🎮\n\n"
        f"<i>{tagline}</i>\n\n"
        f"⚡ <b>¿Qué puedes comprar aquí?</b>\n"
        f"• 💎 <b>Recargas de Juegos:</b> Free Fire, Mobile Legends, COD, Roblox...\n"
        f"• 🍿 <b>Streaming & Apps:</b> Netflix, Disney+, Spotify, Canva, ChatGPT...\n"
        f"• 📲 <b>Números Virtuales SMS:</b> Verificaciones inmediatas en +80 países.\n\n"
        f"👇 <b>Toca el botón abajo para explorar el catálogo y comprar en segundos:</b>"
    )

    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as session:
            await session.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": reply_text,
                    "parse_mode": "HTML",
                    "reply_markup": {
                        "inline_keyboard": keyboard_rows
                    }
                }
            )
    except Exception as ex:
        log.warning(f"Error respondiendo en webhook del bot {slug}: {ex}")

    return {"ok": True}


# ══════════════════════════════════════════════════════════════════
#  SUBIDA DE IMÁGENES / LOGOS DESDE LA GALERÍA DEL DISPOSITIVO
# ══════════════════════════════════════════════════════════════════

@router.post("/reseller/my-web-store/upload-image")
async def reseller_upload_image(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Permite al revendedor o admin subir logos, portadas e iconos para su tienda web desde la galería."""
    content_type = (file.content_type or "").lower()
    allowed = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/svg+xml": ".svg",
    }
    ext = allowed.get(content_type)
    if not ext:
        orig = (file.filename or "").lower()
        for valid_ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"):
            if orig.endswith(valid_ext):
                ext = ".jpg" if valid_ext == ".jpeg" else valid_ext
                break
    if not ext:
        raise HTTPException(400, "Formato de imagen no permitido. Usa JPG, PNG, WEBP, GIF o SVG.")

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(400, "La imagen es demasiado grande. Máximo 10 MB.")

    from pathlib import Path
    safe_name = f"store-reseller-{user['id']}-{int(time.time())}-{uuid.uuid4().hex[:6]}{ext}"
    icons_dir = Path("/home/ubuntu/gamestore/data/game_icons")
    icons_dir.mkdir(parents=True, exist_ok=True)
    filepath = icons_dir / safe_name
    filepath.write_bytes(raw)
    return {"ok": True, "url": f"/api/icons/{safe_name}"}


# ══════════════════════════════════════════════════════════════════
#  CATÁLOGO COMPLETO DE JUEGOS Y MÁRGENES
# ══════════════════════════════════════════════════════════════════

@router.get("/reseller/my-web-store/catalog-games")
async def get_reseller_catalog_games(user: dict = Depends(get_current_user)):
    """Devuelve la lista completa y ordenada de todos los juegos, apps de streaming y gift cards disponibles para configurar márgenes."""
    async with aiosqlite.connect(db.DB) as conn:
        conn.row_factory = aiosqlite.Row
        cur = await conn.execute("""
            SELECT c.provider_type, c.category_id, c.name, c.image_url, c.is_available,
                   m.display_name, m.icon_url, m.region_key
            FROM fzr_catalog_categories c
            LEFT JOIN fzr_catalog_mappings m 
              ON m.provider_type = c.provider_type AND m.category_id = c.category_id
            WHERE c.is_available = 1
        """)
        rows = [dict(r) for r in await cur.fetchall()]

    from collections import defaultdict
    groups = defaultdict(list)
    for r in rows:
        disp = r.get("display_name") or r.get("name") or ""
        base = clean_fzr_base_game_name(disp)
        ptype = r.get("provider_type") or "topup"
        cat_kind = "giftcard" if ptype in ("giftcard", "gamekey") else "topup"
        groups[(cat_kind, base)].append(r)

    games_list = []
    for (cat_kind, base_name), items in groups.items():
        cat_ids = [it["category_id"] for it in items]
        prio = fzr_catalog_priority(base_name, cat_ids)
        best_item = next((it for it in items if it.get("icon_url")), items[0])
        display_title = base_name if (cat_kind == "topup" or "gift card" in base_name.lower() or "pin" in base_name.lower()) else f"{base_name} (Gift Card)"
        games_list.append({
            "name": display_title,
            "base_name": base_name,
            "kind": cat_kind,
            "category": "Direct Top-Up" if cat_kind == "topup" else "Gift Cards & Pines",
            "icon_url": best_item.get("icon_url") or best_item.get("image_url") or "",
            "priority": prio,
            "options_count": len(items)
        })

    # Inyectar Apps de Streaming (StreamZone)
    try:
        from webapp.api.streamzone_client import streamzone_client
        sz_prods = await streamzone_client.get_catalog()
        for p in sz_prods:
            games_list.append({
                "name": p["name"],
                "kind": "streaming",
                "category": p.get("category") or "Streaming & Apps",
                "icon_url": p.get("image_url") or "",
                "priority": -850,
                "options_count": 1,
                "wholesale_cost": float(p.get("price_usd") or 0.0),
                "duration_days": p.get("duration_days") or 30
            })
    except Exception as e:
        log.warning(f"Error cargando streaming en catálogo de revendedor: {e}")

    # Inyectar Servicios Digitales & Apps
    games_list.append({
        "name": "Telegram Stars VIP",
        "kind": "apps",
        "category": "Apps & Servicios",
        "icon_url": "https://cdn.simpleicons.org/telegram/ffffff",
        "priority": -920,
        "options_count": 14
    })
    games_list.append({
        "name": "CapCut Pro",
        "kind": "apps",
        "category": "Apps & Servicios",
        "icon_url": "https://cdn.simpleicons.org/capcut/ffffff",
        "priority": -910,
        "options_count": 3
    })
    games_list.append({
        "name": "Números Virtuales (SMS)",
        "kind": "sms",
        "category": "SMS Virtual",
        "icon_url": "/api/icons/manual-1782655319-e35b38c8.png",
        "priority": -960,
        "options_count": 150
    })

    games_list.sort(key=lambda g: (g["priority"], g["name"].lower()))
    return {"ok": True, "total": len(games_list), "games": games_list}


# ══════════════════════════════════════════════════════════════════
#  ENDPOINTS DE PRODUCTOS MANUALES DEL REVENDEDOR
# ══════════════════════════════════════════════════════════════════

@router.get("/reseller/my-web-store/manual-products")
async def get_my_web_store_manual_products(
    store_slug: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Lista todos los productos manuales creados por el revendedor autenticado."""
    target_user_id = user["id"]
    store = None
    if store_slug:
        st = await db.get_web_store_by_slug(store_slug.strip().lower()) or await db.get_web_store_by_domain(store_slug.strip().lower())
        if st and (st.get("user_id") == user["id"] or user.get("role") == "admin" or user.get("id") in getattr(config, "ADMIN_IDS", [])):
            target_user_id = st["user_id"]
            store = st
        else:
            return {"ok": True, "products": [], "cup_rate": 320.0}
    else:
        store = await db.get_web_store_by_user(target_user_id)
    
    target_slug = store.get("slug") if store else None
    if target_slug:
        raw_products = await db.get_manual_products(active_only=False, store_slug=target_slug)
    else:
        raw_products = []
    cup_rate = 320.0
    if store:
        pm = _parse_json_dict(store.get("payment_methods"))
        cup_rate = float(pm.get("cup_manual", {}).get("exchange_rate_cup", 320.0))

    products = []
    for p in raw_products:
        usd = float(p.get("price") or 0.0)
        cup = int(round(usd * cup_rate)) if cup_rate > 0 else 0
        raw_opts = p.get("options") or []
        parsed_opts = []
        for o in raw_opts:
            o_usd = float(o.get("price") or 0.0)
            o_cup = int(round(o_usd * cup_rate)) if cup_rate > 0 else 0
            parsed_opts.append({
                "id": o.get("id"),
                "name": o.get("name"),
                "price": o_usd,
                "sell_price": o_usd,
                "cup_price": o_cup,
                "stock": int(o.get("stock", -1) if o.get("stock") is not None else -1),
                "is_active": bool(o.get("is_active", 1)),
                "sort_order": int(o.get("sort_order", 0))
            })
        products.append({
            "id": p["id"],
            "name": p["name"],
            "description": p.get("description") or "",
            "category": p.get("category") or "service",
            "price": usd,
            "sell_price": usd,
            "cup_price": cup,
            "icon_url": p.get("icon_url") or "",
            "delivery_type": p.get("delivery_type") or "manual",
            "instructions": p.get("instructions") or "",
            "delivery_time": p.get("delivery_time") or "Inmediato",
            "stock": int(p.get("stock", -1)),
            "is_active": bool(p.get("is_active", 1)),
            "options": parsed_opts,
            "created_at": p.get("created_at"),
            "is_manual": True
        })

    return {"ok": True, "products": products, "cup_rate": cup_rate}


@router.post("/reseller/my-web-store/manual-products")
async def create_my_web_store_manual_product(req: ResellerManualProductCreate, user: dict = Depends(get_current_user)):
    """Crea un nuevo producto manual para la tienda web del revendedor."""
    target_user_id = user["id"]
    st = None
    if req.store_slug:
        st = await db.get_web_store_by_slug(req.store_slug.strip().lower()) or await db.get_web_store_by_domain(req.store_slug.strip().lower())
        if not st or (st.get("user_id") != user["id"] and user.get("role") != "admin" and user.get("id") not in getattr(config, "ADMIN_IDS", [])):
            raise HTTPException(403, "No tienes permiso para gestionar esta tienda web")
        target_user_id = st["user_id"]
    else:
        st = await db.get_web_store_by_user(target_user_id)
        if not st:
            raise HTTPException(400, "No tienes una tienda web configurada")

    target_slug = st["slug"]

    data = {
        "name": req.name.strip(),
        "description": (req.description or "").strip(),
        "category": (req.category or "service").strip(),
        "price": float(req.price),
        "icon_url": (req.icon_url or "").strip(),
        "delivery_type": req.delivery_type or "manual",
        "instructions": (req.instructions or "").strip(),
        "delivery_time": (req.delivery_time or "Inmediato").strip(),
        "stock": req.stock if req.stock is not None else -1,
        "is_active": 1 if req.is_active else 0,
        "created_by": target_user_id,
        "store_slug": target_slug,
    }
    if req.options is not None:
        data["options"] = req.options
    product_id = await db.create_manual_product(data)
    return {
        "ok": True,
        "product_id": product_id,
        "message": "¡Producto creado con éxito! Ya está disponible en tu tienda web."
    }


@router.put("/reseller/my-web-store/manual-products/{product_id}")
async def update_my_web_store_manual_product(product_id: int, req: ResellerManualProductUpdate, user: dict = Depends(get_current_user)):
    """Actualiza un producto manual creado por el revendedor."""
    user_id = user["id"]
    p = await db.get_manual_product(product_id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    if p.get("created_by") != user_id and user.get("role") != "admin" and user_id not in getattr(config, "ADMIN_IDS", []):
        raise HTTPException(403, "No tienes permiso para modificar este producto")

    update_data = {}
    if req.name is not None:
        update_data["name"] = req.name.strip()
    if req.description is not None:
        update_data["description"] = req.description.strip()
    if req.category is not None:
        update_data["category"] = req.category.strip()
    if req.price is not None:
        update_data["price"] = float(req.price)
    if req.icon_url is not None:
        update_data["icon_url"] = req.icon_url.strip()
    if req.delivery_type is not None:
        update_data["delivery_type"] = req.delivery_type.strip()
    if req.instructions is not None:
        update_data["instructions"] = req.instructions.strip()
    if req.delivery_time is not None:
        update_data["delivery_time"] = req.delivery_time.strip()
    if req.stock is not None:
        update_data["stock"] = int(req.stock)
    if req.is_active is not None:
        update_data["is_active"] = 1 if req.is_active else 0
    if req.store_slug is not None:
        update_data["store_slug"] = req.store_slug.strip().lower() or None
    if req.options is not None:
        update_data["options"] = req.options

    await db.update_manual_product(product_id, update_data)
    return {"ok": True, "message": "¡Producto actualizado exitosamente!"}


@router.delete("/reseller/my-web-store/manual-products/{product_id}")
async def delete_my_web_store_manual_product(product_id: int, user: dict = Depends(get_current_user)):
    """Elimina un producto manual creado por el revendedor."""
    user_id = user["id"]
    p = await db.get_manual_product(product_id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    if p.get("created_by") != user_id and user.get("role") != "admin" and user_id not in getattr(config, "ADMIN_IDS", []):
        raise HTTPException(403, "No tienes permiso para eliminar este producto")

    await db.delete_manual_product(product_id)
    return {"ok": True, "message": "¡Producto eliminado exitosamente!"}


# ══════════════════════════════════════════════════════════════════
#  ENDPOINTS DE ADMINISTRACIÓN (Solo Admin)
# ══════════════════════════════════════════════════════════════════

@router.get("/admin/web-stores")
async def admin_list_web_stores(user: dict = Depends(get_current_user)):
    """Lista todas las tiendas de revendedores activas e inactivas."""
    user_db = await db.get_user(user["id"])
    if not user_db or user_db.get("role") != "admin":
        raise HTTPException(403, "Acceso solo para administradores")

    stores = await db.list_all_web_stores(limit=200)
    now = time.time()
    for s in stores:
        exp = float(s.get("expires_at") or 0)
        s["days_left"] = max(0, int((exp - now) / 86400))
        s["is_expired"] = exp < now

    return {"ok": True, "stores": stores}


@router.post("/admin/web-stores/{store_id}/extend")
async def admin_extend_web_store(store_id: int, days: int = Query(30), user: dict = Depends(get_current_user)):
    """Permite al admin regalar o extender días de suscripción a una tienda."""
    user_db = await db.get_user(user["id"])
    if not user_db or user_db.get("role") != "admin":
        raise HTTPException(403, "Acceso solo para administradores")

    updated = await db.record_web_store_subscription(
        store_id=store_id,
        user_id=user["id"],
        plan="pro",
        billing_cycle="courtesy",
        days=days,
        amount=0.0
    )

    return {"ok": True, "message": f"Se extendieron {days} días a la tienda.", "store": updated}
