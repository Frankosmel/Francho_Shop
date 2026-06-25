"""
🎮 GameStore Bot — Bot principal completo.
BuffPin API + OxaPay USDT + Sistema dual de precios + Panel admin

Este archivo contiene TODO el bot en un solo módulo (monolítico) pero
organizado en secciones claras delimitadas por banners.

Secciones:
1. Setup & imports
2. Helpers compartidos
3. Menú principal
4. Wallet (OxaPay USDT)
5. Catálogo y búsqueda
6. Detalle de producto
7. Flujo de compra
8. Mis pedidos
9. Revendedor (solicitar, ver estado)
10. Panel de admin (dashboard, users, productos, config, broadcast, cupones)
11. Webhooks (OxaPay + BuffPin)
12. Tareas periódicas
13. Main loop
"""
import asyncio
import json
import logging
import math
import re
import time
from collections import defaultdict
from contextlib import suppress

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message,
    BufferedInputFile, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
    WebAppInfo, MenuButtonWebApp, MenuButtonDefault,
)
from aiohttp import web

import config
import database as db
import keyboards as kb
from buffpin_client import BuffPinClient, BuffPinError
from oxapay_client import OxaPayClient, OxaPayError
from modules import settings, pricing

# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 1: SETUP
# ══════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
log = logging.getLogger("gamestore")

bot = Bot(token=config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()
router = Router(name="main")
dp.include_router(router)

buffpin = BuffPinClient()
oxapay = OxaPayClient()

CACHE_TTL = 600  # 10 minutos

ORDER_STATUS = {
    0: "⏳ Pendiente", 1: "🔄 Procesando", 2: "✅ Completado",
    3: "⚠️ Parcial", 4: "❌ Fallido",
}
REFUND_STATUS = {0: "", 1: "💸 Reembolso parcial", 2: "💸 Reembolso total"}

# Roles legibles
ROLE_LABELS = {"user": "🛒 Cliente", "reseller": "💼 Revendedor", "admin": "👑 Admin"}


# ══════════════════════════════════════════════════════════════════
#  FSM STATES
# ══════════════════════════════════════════════════════════════════

class DepositFlow(StatesGroup):
    waiting_amount = State()

class OrderFlow(StatesGroup):
    filling_fields = State()
    confirm = State()

class ResellerFlow(StatesGroup):
    waiting_business_desc = State()

class AdminFlow(StatesGroup):
    # Configuración
    edit_retail_markup = State()
    edit_reseller_markup = State()
    edit_welcome_msg = State()
    edit_support = State()
    edit_min_deposit = State()
    edit_min_withdrawal = State()

    # Usuarios
    search_user = State()
    adjust_balance = State()
    ban_user_reason = State()
    reject_application_reason = State()

    # Productos
    search_product = State()
    edit_product_price = State()

    # Broadcast
    broadcast_text = State()

    # Cupones
    coupon_code = State()
    coupon_discount = State()
    coupon_min = State()
    coupon_max_uses = State()


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 2: HELPERS
# ══════════════════════════════════════════════════════════════════

async def get_effective_role(user_id: int) -> str:
    """Rol efectivo del usuario (considerando ADMIN_IDS)."""
    if user_id in config.ADMIN_IDS:
        return "admin"
    return await db.get_user_role(user_id)


async def is_admin(user_id: int) -> bool:
    return user_id in config.ADMIN_IDS or (await db.get_user_role(user_id)) == "admin"


async def ensure_products():
    if await db.get_cache_age() > CACHE_TTL:
        await refresh_products()


async def refresh_products():
    try:
        items = await buffpin.get_all_products()
        await db.cache_products(items)
        log.info("Catálogo refrescado: %d productos", len(items))
    except BuffPinError as e:
        log.error("Error refrescando: %s", e)


async def check_maintenance(user_id: int) -> bool:
    """Si está en mantenimiento y NO es admin, devuelve True."""
    if await settings.get_bool("maintenance_mode"):
        if user_id not in config.ADMIN_IDS:
            return True
    return False


def parse_platform_config(raw: str) -> list[dict]:
    try:
        return json.loads(raw) if raw else []
    except (json.JSONDecodeError, TypeError):
        return []


def format_order_short(o: dict) -> str:
    """Formato breve de una orden."""
    status = ORDER_STATUS.get(o.get("order_status", 0), "❓")
    ts = time.strftime("%d/%m %H:%M", time.localtime(o.get("created_at", 0)))
    text = (
        f"📦 <b>{o.get('product_name', '—')}</b>\n"
        f"🆔 <code>{o.get('merchant_order_id', '—')}</code>\n"
        f"💵 ${o.get('sell_price', 0):.2f}  •  {status}\n"
    )
    if o.get("refund_status", 0) > 0:
        text += f"{REFUND_STATUS.get(o['refund_status'], '')}\n"
    if o.get("card_data"):
        try:
            for c in json.loads(o["card_data"]):
                text += f"🔑 PIN: <tg-spoiler>{c.get('cardPass', '—')}</tg-spoiler>"
                if c.get("cardNumber"):
                    text += f"  Nº: <code>{c['cardNumber']}</code>"
                text += "\n"
        except Exception:
            pass
    if o.get("error_message"):
        text += f"⚠️ {o['error_message']}\n"
    text += f"🕐 {ts}"
    return text


def back_kb(target: str = "menu", label: str = "🔙 Atrás") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=label, callback_data=target)]
    ])


async def notify_admins(text: str, exclude: int = None):
    for aid in config.ADMIN_IDS:
        if aid == exclude:
            continue
        with suppress(Exception):
            await bot.send_message(aid, text)


# ══════════════════════════════════════════════════════════════════
#  HELPERS DE PRODUCTOS (limpieza + agrupación por juego)
# ══════════════════════════════════════════════════════════════════

def clean_product_name(name: str) -> str:
    """Quita caracteres chinos y paréntesis con chino del nombre."""
    if not name:
        return ""
    # Quita paréntesis que contengan chino
    name = re.sub(r"\([^)]*[\u4e00-\u9fff]+[^)]*\)", "", name)
    # Quita cualquier carácter chino suelto
    name = re.sub(r"[\u4e00-\u9fff]+", "", name)
    # Limpia espacios dobles
    name = re.sub(r"\s+", " ", name).strip()
    return name


def get_ca(product: dict) -> str:
    """Obtiene el campo 'ca' del producto desde raw_json (campo de BuffPin)."""
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


GAME_PATTERNS = [
    # ─── GIFT CARDS (primero para que "Apple" no matchee antes que otros patrones) ───
    ("🍎 Apple Gift Card", ["apple"]),
    ("▶️ Google Play Gift Card", ["google play", "googleplay"]),
    ("🎁 Steam Gift Card", ["steam"]),
    ("🎬 Netflix Gift Card", ["netflix"]),
    ("🎵 Spotify Gift Card", ["spotify"]),
    ("🎮 PlayStation Gift Card", ["playstation", "psn"]),
    ("🎮 Xbox Gift Card", ["xbox"]),
    ("🛒 Amazon Gift Card", ["amazon"]),

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
    ("👑 Honor of Kings", ["honor of kings", "honorofkings"]),
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


CATALOG_SECTIONS = [
    {
        "id": "direct",
        "label": "🎮 Recargas directas por ID",
        "title": "Recargas directas por ID",
        "desc": "Juegos donde normalmente escribes ID, servidor o región.",
    },
    {
        "id": "gift",
        "label": "🎁 Gift cards y códigos",
        "title": "Gift cards y códigos",
        "desc": "Tarjetas digitales, códigos y productos para canjear.",
    },
    {
        "id": "console",
        "label": "🕹 Consolas y membresías",
        "title": "Consolas y membresías",
        "desc": "PlayStation, Xbox, Nintendo, Game Pass y productos similares.",
    },
    {
        "id": "services",
        "label": "🌐 Servicios y cuentas",
        "title": "Servicios y cuentas",
        "desc": "Airalo, Discord, Visa, PayPal/Rewarble y otros productos digitales.",
    },
    {
        "id": "other",
        "label": "📦 Otros productos",
        "title": "Otros productos",
        "desc": "Productos que no encajan claramente en otra categoría.",
    },
]
CATALOG_SECTION_BY_ID = {section["id"]: section for section in CATALOG_SECTIONS}
CATALOG_LABEL_TO_ID = {section["label"]: section["id"] for section in CATALOG_SECTIONS}

DIRECT_GAME_HINTS = [
    "free fire", "freefire", "mobile legends", "mlbb", "pubg", "genshin", "honkai",
    "blood strike", "arena breakout", "call of duty", "cod mobile", "codm", "delta force",
    "honor of kings", "clash of clans", "clash royale", "brawl stars", "roblox",
    "valorant", "wild rift", "league of legends", "efootball", "asphalt", "identity v",
    "lifeafter", "rise of kingdoms", "lords mobile",
]
CONSOLE_HINTS = ["playstation", "psn", "xbox", "game pass", "nintendo", "eshop", "e-shop", "switch"]
SERVICE_HINTS = ["airalo", "esim", "discord", "nitro", "visa", "paypal", "rewarble", "prepaid center", "walmart"]
GIFT_HINTS = [
    "gift card", "giftcard", "itunes", "apple", "google play", "steam", "razer gold",
    "netflix", "spotify", "amazon", "card", "cd-key", "cd key", "key",
]


def product_search_text(product: dict) -> str:
    if not isinstance(product, dict):
        return str(product or "").lower()
    raw = product.get("raw_json")
    extra = ""
    if raw:
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
            if isinstance(parsed, dict):
                extra = " ".join(str(parsed.get(k) or "") for k in ("ca", "type", "goodsType", "category", "goods_name", "goodsName"))
        except (json.JSONDecodeError, TypeError):
            extra = ""
    return " ".join([
        str(product.get("goods_name") or product.get("goodsName") or ""),
        str(product.get("type") or ""),
        get_ca(product),
        extra,
    ]).lower()


def classify_catalog_section(product: dict) -> str:
    text = product_search_text(product)
    if any(h in text for h in CONSOLE_HINTS):
        return "console"
    if any(h in text for h in SERVICE_HINTS):
        return "services"
    if any(h in text for h in GIFT_HINTS):
        return "gift"
    if any(h in text for h in DIRECT_GAME_HINTS):
        return "direct"
    return "other"


def group_products_by_catalog_section(products: list[dict]) -> dict[str, list[dict]]:
    grouped = {section["id"]: [] for section in CATALOG_SECTIONS}
    for product in products:
        grouped.setdefault(classify_catalog_section(product), []).append(product)
    return {key: items for key, items in grouped.items() if items}


def filter_products_by_catalog_section(products: list[dict], section_id: str = "") -> list[dict]:
    if not section_id or section_id == "all":
        return products
    return [product for product in products if classify_catalog_section(product) == section_id]


def detect_game(product) -> str:
    """
    Detecta el juego usando 'ca' como fuente principal, con fallback al goods_name.
    Acepta dict (producto completo) o str (solo nombre, para compatibilidad).
    """
    if isinstance(product, dict):
        ca = get_ca(product).lower()
        name = (product.get("goods_name") or product.get("goodsName") or "").lower()
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


def group_products_by_game(products: list[dict]) -> dict[str, list[dict]]:
    grouped = defaultdict(list)
    for p in products:
        raw = p.get("goods_name", "") or p.get("goodsName", "")
        # Pasar el producto completo para que use el campo 'ca'
        game = detect_game(p)
        p["display_name"] = clean_product_name(raw) or raw
        grouped[game].append(p)
    # Otros al final, resto alfabético
    return dict(sorted(grouped.items(), key=lambda x: (x[0] == "📦 Otros", x[0])))


# ─────── Extracción de región desde platform_config (fuente verdadera) ───────
def extract_regions(platform_config_raw: str) -> list[str]:
    """
    Extrae las regiones REALES del producto desde platform_config.
    La API de BuffPin devuelve algo como:
        [{"name":"Server Info","selected":1,"values":[
            {"serverId":"1","serverName":"Asia"},
            {"serverId":"2","serverName":"Europe"}
        ]}]
    """
    if not platform_config_raw:
        return []
    try:
        cfg = json.loads(platform_config_raw)
    except (json.JSONDecodeError, TypeError):
        return []

    regions = []
    for field in cfg:
        if not isinstance(field, dict):
            continue
        if field.get("selected") == 1 and isinstance(field.get("values"), list):
            for v in field["values"]:
                name = v.get("serverName") or v.get("name")
                if name:
                    regions.append(name)
    return regions


# Mapeo de serverName → emoji bandera (opcional, mejora visual)
REGION_FLAGS = {
    "asia": "🌏", "europe": "🇪🇺", "europa": "🇪🇺", "america": "🌎",
    "global": "🌍", "indonesia": "🇮🇩", "brazil": "🇧🇷", "brasil": "🇧🇷",
    "tw, hk, mo": "🇹🇼", "korea": "🇰🇷", "japan": "🇯🇵", "japón": "🇯🇵",
    "vietnam": "🇻🇳", "thailand": "🇹🇭", "philippines": "🇵🇭",
    "singapore": "🇸🇬", "malaysia": "🇲🇾", "india": "🇮🇳",
    "russia": "🇷🇺", "rusia": "🇷🇺", "mexico": "🇲🇽", "méxico": "🇲🇽",
    "us": "🇺🇸", "latam": "🌎", "world": "🌍", "mena": "🌍", "usd": "💵",
}


def region_with_flag(region: str) -> str:
    """Añade un emoji bandera al nombre de la región si lo conocemos."""
    if not region:
        return "🌐 Estándar"
    flag = REGION_FLAGS.get(region.lower().strip(), "🌐")
    return f"{flag} {region}"


def group_products_by_real_region(items: list[dict]) -> dict[str, list[dict]]:
    """
    Subagrupa productos de un juego usando platform_config real.
    Si un producto NO tiene regiones (extract_regions vacío), va a "🌐 Estándar".
    Un mismo producto puede aparecer en varias regiones (esto está OK porque el
    usuario elige la región al comprar).
    """
    grouped = defaultdict(list)
    for p in items:
        game = detect_game(p)
        if game == "🩸 Blood Strike":
            ca = get_ca(p)
            name = (p.get("goods_name") or p.get("goodsName") or "").lower()
            r = "MENA" if ("mena" in ca.lower() or "mena" in name) else "Global"
            grouped[region_with_flag(r)].append(p)
            continue

        regs = extract_regions(p.get("platform_config", "") or "")
        if not regs:
            grouped["🌐 Estándar"].append(p)
        else:
            for r in regs:
                grouped[region_with_flag(r)].append(p)
    # Estándar al final
    return dict(sorted(grouped.items(), key=lambda x: (x[0] == "🌐 Estándar", x[0])))


def clean_name_for_game(name: str, game: str = "", max_len: int = 28) -> str:
    """
    Limpia el nombre del producto quitando SOLO el nombre del juego al inicio.
    Mantiene el resto (cantidad, bonus). NO toca regiones porque la región
    real viene del platform_config.
    """
    if not name:
        return "?"
    n = name
    # Quitar caracteres chinos sueltos
    n = re.sub(r"[\u4e00-\u9fff]+", "", n)
    # Quitar paréntesis con chino
    n = re.sub(r"\([^)]*[\u4e00-\u9fff]+[^)]*\)", "", n)
    # Quitar el nombre del juego (sin emojis) del inicio
    if game:
        game_clean = re.sub(r"[^\w\s]", "", game).strip()
        if game_clean and n.lower().startswith(game_clean.lower()):
            n = n[len(game_clean):].strip()
    n = re.sub(r"\(\s*\)", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    if not n:
        n = name
    if len(n) > max_len:
        n = n[:max_len - 1] + "…"
    return n


# Alias para compatibilidad con código viejo
def short_product_name(name: str, max_len: int = 28) -> str:
    return clean_name_for_game(name, "", max_len)


# Alias compat: el código viejo llama a group_products_by_region
def group_products_by_region(items: list[dict]) -> dict[str, list[dict]]:
    return group_products_by_real_region(items)


# ══════════════════════════════════════════════════════════════════
#  REPLY KEYBOARD (botones bajo el teclado, siempre visibles)
# ══════════════════════════════════════════════════════════════════

async def main_reply_kb(user_id: int) -> ReplyKeyboardMarkup:
    bal = await db.get_balance(user_id)
    role = await get_effective_role(user_id)
    webapp_url = getattr(config, "WEBAPP_URL", None)
    return kb.kb_main(role, bal, webapp_url=webapp_url)


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 3: MENÚ PRINCIPAL
# ══════════════════════════════════════════════════════════════════

async def build_main_menu(user_id: int) -> InlineKeyboardMarkup:
    """Menú dinámico según el rol del usuario."""
    bal = await db.get_balance(user_id)
    role = await get_effective_role(user_id)

    rows = [
        [InlineKeyboardButton(text="🛒 Catálogo", callback_data="catalog"),
         InlineKeyboardButton(text="🔍 Buscar", callback_data="search")],
        [InlineKeyboardButton(text=f"💰 Saldo: ${bal:.2f}", callback_data="wallet")],
        [InlineKeyboardButton(text="📋 Mis pedidos", callback_data="my_orders")],
    ]

    # Badge de rol
    if role == "reseller":
        rows.append([InlineKeyboardButton(
            text="💼 Panel Revendedor", callback_data="reseller_panel",
        )])
    elif role == "user":
        rows.append([InlineKeyboardButton(
            text="💼 Ser revendedor", callback_data="become_reseller",
        )])

    rows.append([InlineKeyboardButton(text="ℹ️ Ayuda", callback_data="help")])

    if role == "admin":
        rows.append([InlineKeyboardButton(text="👑 Panel Admin", callback_data="admin_panel")])

    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.message(CommandStart())
async def cmd_start(msg: Message, state: FSMContext):
    await state.clear()
    await db.upsert_user(msg.from_user.id, msg.from_user.username, msg.from_user.first_name)

    # Check ban
    if await db.is_banned(msg.from_user.id):
        await msg.answer("🚫 Tu cuenta está suspendida. Contacta al soporte.",
                         reply_markup=ReplyKeyboardRemove())
        return

    # Mantenimiento
    if await check_maintenance(msg.from_user.id):
        maint_msg = await settings.get("maintenance_message")
        await msg.answer(maint_msg)
        return

    welcome = await settings.get("welcome_message")
    role = await get_effective_role(msg.from_user.id)

    if role == "reseller":
        welcome = f"💼 <b>Bienvenido, Revendedor</b>\n\n" + welcome
    elif role == "admin":
        welcome = f"👑 <b>Bienvenido, Admin</b>\n\n" + welcome

    # Reply keyboard SIEMPRE visible bajo el teclado
    await msg.answer(welcome, reply_markup=await main_reply_kb(msg.from_user.id))


@router.message(Command("shop"))
async def cmd_shop(msg: Message):
    """Comando /shop: envía mensaje con botón inline para abrir la mini app."""
    webapp_url = getattr(config, "WEBAPP_URL", None)
    if not webapp_url:
        await msg.answer("⚠️ Mini app no configurada todavía.")
        return

    text = (
        "🛍 <b>Francho Shop</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Toca el botón abajo para abrir nuestra tienda y ver "
        "todas las recargas y gift cards disponibles.\n\n"
        "💡 También puedes usar el botón <b>Shop</b> al lado "
        "del campo de texto."
    )
    inline_kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🛒 Abrir Francho Shop",
            web_app=WebAppInfo(url=webapp_url),
        )],
    ])
    await msg.answer(text, reply_markup=inline_kb)


@router.callback_query(F.data == "menu")
async def cb_menu(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    await state.clear()
    with suppress(Exception):
        await cq.message.delete()
    welcome = await settings.get("welcome_message")
    role = await get_effective_role(cq.from_user.id)
    if role == "reseller":
        welcome = f"💼 <b>Panel de Revendedor</b>\n\n" + welcome
    elif role == "admin":
        welcome = f"👑 <b>Menú Admin</b>\n\n" + welcome
    await bot.send_message(
        cq.from_user.id, welcome,
        reply_markup=await main_reply_kb(cq.from_user.id),
    )


@router.callback_query(F.data == "help")
async def cb_help(cq: CallbackQuery):
    await cq.answer()
    support = await settings.get("support_handle")
    role = await get_effective_role(cq.from_user.id)

    text = (
        "ℹ️ <b>¿Cómo funciona?</b>\n\n"
        "1️⃣ <b>Recarga saldo</b> → Billetera → Paga con USDT\n"
        "2️⃣ <b>Busca tu juego</b> → Catálogo o Búsqueda\n"
        "3️⃣ <b>Selecciona producto</b> → Ve precio y regiones\n"
        "4️⃣ <b>Ingresa datos</b> → Validamos tu cuenta\n"
        "5️⃣ <b>Confirma</b> → Descontamos de tu saldo\n"
        "6️⃣ <b>Recibe tu recarga</b> → Instantánea\n\n"
    )

    if role == "reseller":
        reseller_mk = await settings.get_float("reseller_markup")
        text += (
            f"💼 <b>Tu precio de revendedor:</b>\n"
            f"Costo + {reseller_mk}% (precio especial para ti)\n\n"
        )
    elif role == "user":
        retail_mk = await settings.get_float("retail_markup")
        text += (
            f"💰 Precios: costo + {retail_mk}% de margen\n\n"
            f"💼 ¿Compras mucho? Puedes ser revendedor y "
            f"obtener precios especiales.\n\n"
        )

    text += f"📞 <b>Soporte:</b> {support}"

    await cq.message.edit_text(text, reply_markup=back_kb())
    await cq.answer()


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 4: WALLET — OxaPay USDT
# ══════════════════════════════════════════════════════════════════

@router.callback_query(F.data == "wallet")
async def cb_wallet(cq: CallbackQuery):
    await cq.answer()
    bal = await db.get_balance(cq.from_user.id)
    role = await get_effective_role(cq.from_user.id)
    min_dep = await settings.get_float("min_deposit")

    text = (
        f"💰 <b>Tu billetera</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"📊 Saldo disponible: <b>${bal:.2f} USDT</b>\n"
        f"🎭 Rol: {ROLE_LABELS.get(role, role)}\n"
        f"📥 Mínimo depósito: ${min_dep:.2f} USDT\n\n"
    )

    if role == "reseller":
        text += (
            "💎 <b>Como revendedor, compras con descuento.</b>\n"
            "Recarga saldo para empezar a revender.\n\n"
        )

    text += "Selecciona cuánto recargar con USDT:"

    # Teclado
    rows = []
    preset_row = []
    for amt in config.DEPOSIT_PRESETS:
        preset_row.append(InlineKeyboardButton(text=f"${amt}", callback_data=f"dep:{amt}"))
        if len(preset_row) == 3:
            rows.append(preset_row)
            preset_row = []
    if preset_row:
        rows.append(preset_row)
    rows.append([InlineKeyboardButton(text="✏️ Otro monto", callback_data="dep:custom")])
    rows.append([InlineKeyboardButton(text="📜 Historial depósitos", callback_data="dep:history")])
    rows.append([InlineKeyboardButton(text="📊 Historial saldo", callback_data="balance_history")])
    rows.append([InlineKeyboardButton(text="🔙 Menú", callback_data="menu")])

    await cq.message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
    await cq.answer()


@router.callback_query(F.data.startswith("dep:"))
async def cb_deposit_action(cq: CallbackQuery, state: FSMContext):
    val = cq.data.split(":")[1]
    min_dep = await settings.get_float("min_deposit")

    if val == "custom":
        await cq.message.edit_text(
            f"✏️ <b>Monto personalizado</b>\n\n"
            f"Escribe el monto en USDT que deseas depositar.\n"
            f"Mínimo: <b>${min_dep:.2f}</b>",
            reply_markup=back_kb("wallet"),
        )
        await state.set_state(DepositFlow.waiting_amount)
        await cq.answer()
        return

    if val == "history":
        deps = await db.get_user_deposits(cq.from_user.id, 10)
        if not deps:
            await cq.message.edit_text("📭 Sin depósitos aún.", reply_markup=back_kb("wallet"))
        else:
            text = "📜 <b>Tus depósitos</b>\n\n"
            emojis = {"pending": "⏳", "Paying": "🔄", "paid": "✅",
                      "expired": "⌛", "failed": "❌"}
            for d in deps:
                em = emojis.get(d["status"], "❓")
                ts = time.strftime("%d/%m %H:%M", time.localtime(d["created_at"]))
                text += f"{em} ${d['amount_usd']:.2f} USDT — {d['status']} — {ts}\n"
            await cq.message.edit_text(text, reply_markup=back_kb("wallet"))
        await cq.answer()
        return

    # Monto preset
    amount = float(val)
    await create_oxapay_invoice(cq, amount)
    await cq.answer()


@router.callback_query(F.data == "balance_history")
async def cb_balance_history(cq: CallbackQuery):
    await cq.answer()
    history = await db.get_balance_history(cq.from_user.id, 15)
    if not history:
        await cq.message.edit_text("📭 Sin movimientos.", reply_markup=back_kb("wallet"))
        await cq.answer()
        return

    text = "📊 <b>Historial de saldo</b>\n\n"
    type_emojis = {
        "deposit": "💵", "purchase": "🛒", "refund": "💸",
        "admin_adjust": "👑", "referral": "👥",
    }
    for h in history:
        em = type_emojis.get(h["type"], "💰")
        sign = "+" if h["amount"] >= 0 else ""
        ts = time.strftime("%d/%m %H:%M", time.localtime(h["created_at"]))
        text += f"{em} {sign}${h['amount']:.2f} USDT — {h.get('note', h['type'])} — {ts}\n"

    await cq.message.edit_text(text, reply_markup=back_kb("wallet"))
    await cq.answer()


@router.message(DepositFlow.waiting_amount)
async def msg_deposit_amount(msg: Message, state: FSMContext):
    try:
        amount = float(msg.text.strip().replace(",", "."))
    except ValueError:
        await msg.answer("❌ Monto inválido. Escribe un número.")
        return

    min_dep = await settings.get_float("min_deposit")
    if amount < min_dep:
        await msg.answer(f"❌ Mínimo: ${min_dep:.2f} USDT")
        return
    if amount > 10000:
        await msg.answer("❌ Máximo: $10,000 USDT")
        return

    await state.clear()
    await create_oxapay_invoice(msg, amount)


async def create_oxapay_invoice(event, amount: float):
    user_id = event.from_user.id
    is_cb = isinstance(event, CallbackQuery)
    msg = event.message if is_cb else event

    callback_url = (
        f"{config.WEBHOOK_HOST}{config.OXAPAY_CALLBACK_PATH}"
        if config.WEBHOOK_HOST else None
    )

    try:
        dep_id = db.gen_deposit_id()
        result = await oxapay.create_invoice(
            amount=amount,
            order_id=dep_id,
            description=f"GameStore - Recarga ${amount:.2f} USDT",
            callback_url=callback_url,
        )

        track_id = result.get("track_id", "")
        pay_link = result.get("pay_link", "")

        if not pay_link or not pay_link.startswith(("http://", "https://")):
            raise OxaPayError(500, "OxaPay no devolvió un link de pago válido")

        await db.create_deposit(user_id, amount, track_id, pay_link)

        invoice_kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="💳 Pagar con USDT", url=pay_link)],
            [InlineKeyboardButton(text="🔄 Verificar pago", callback_data=f"chkdep:{track_id}")],
        ])

        text = (
            f"🧾 <b>Factura de depósito</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"💵 Monto: <b>${amount:.2f} USDT</b>\n"
            f"💎 Método: USDT (vía OxaPay)\n"
            f"⏱ Expira en: 60 minutos\n"
            f"🆔 Ref: <code>{dep_id}</code>\n\n"
            f"Presiona el botón para pagar."
        )

        if is_cb:
            await msg.edit_text(text, reply_markup=invoice_kb)
        else:
            await msg.answer(text, reply_markup=invoice_kb)

    except OxaPayError as e:
        err = f"⚠️ Error creando factura: {e.message}"
        if is_cb:
            await msg.edit_text(err, reply_markup=back_kb("wallet"))
        else:
            await msg.answer(err, reply_markup=back_kb("wallet"))


@router.callback_query(F.data.startswith("chkdep:"))
async def cb_check_deposit(cq: CallbackQuery):
    track_id = cq.data.split(":")[1]
    dep = await db.get_deposit_by_track(track_id)
    if not dep:
        await cq.answer("No encontrado", show_alert=True)
        return

    if dep["status"] == "paid":
        await cq.answer("✅ Ya acreditado", show_alert=True)
        return

    try:
        info = await oxapay.get_payment(track_id)
        status = info.get("status", "")

        if status == "paid":
            await process_paid_deposit(track_id, dep["amount_usd"], dep["user_id"])
            bal = await db.get_balance(dep["user_id"])
            await cq.message.edit_text(
                f"✅ <b>¡Depósito acreditado!</b>\n\n"
                f"💵 +${dep['amount_usd']:.2f} USDT\n"
                f"📊 Saldo actual: <b>${bal:.2f} USDT</b>",
                reply_markup=back_kb("wallet"),
            )
        elif status in ("Paying", "paying"):
            await cq.answer("🔄 Pago detectado, esperando confirmación...", show_alert=True)
        elif status == "expired":
            await db.update_deposit(track_id, "expired")
            await cq.answer("⌛ Factura expirada", show_alert=True)
        else:
            await cq.answer(f"⏳ Estado: {status}", show_alert=True)
    except OxaPayError as e:
        await cq.answer(f"Error: {e.message}", show_alert=True)


async def process_paid_deposit(track_id: str, amount: float, user_id: int):
    dep = await db.get_deposit_by_track(track_id)
    if dep and dep["status"] == "paid":
        return
    await db.update_deposit(track_id, "paid")
    await db.add_balance(user_id, amount, "deposit", track_id, f"Depósito USDT ${amount:.2f}")

    bal = await db.get_balance(user_id)
    with suppress(Exception):
        await bot.send_message(
            user_id,
            f"✅ <b>¡Depósito acreditado!</b>\n\n"
            f"💵 +${amount:.2f} USDT\n"
            f"📊 Saldo actual: <b>${bal:.2f} USDT</b>",
            reply_markup=back_kb("menu", "🔙 Menú"),
        )

    user = await db.get_user(user_id)
    uname = f"@{user['username']}" if user and user.get("username") else f"ID:{user_id}"
    await notify_admins(
        f"💰 <b>Nuevo depósito</b>\n"
        f"👤 {uname}\n"
        f"💵 ${amount:.2f} USDT\n"
        f"📊 Balance ahora: ${bal:.2f} USDT"
    )


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 5: CATÁLOGO Y BÚSQUEDA
# ══════════════════════════════════════════════════════════════════

@router.callback_query(F.data == "catalog")
async def cb_catalog(cq: CallbackQuery):
    await cq.answer()
    if await check_maintenance(cq.from_user.id):
        return
    await ensure_products()
    prods = await db.get_cached_products()
    if not prods:
        await cq.message.edit_text("⚠️ Catálogo vacío", reply_markup=back_kb())
        return

    sections = group_products_by_catalog_section(prods)
    rows = []
    for section in CATALOG_SECTIONS:
        items = sections.get(section["id"], [])
        if not items:
            continue
        rows.append([InlineKeyboardButton(
            text=f"{section['label']}  ({len(items)})",
            callback_data=f"cat:{section['id']}",
        )])
    rows.append([InlineKeyboardButton(text="🔎 Buscar producto", callback_data="search")])
    rows.append([InlineKeyboardButton(text="🔙 Cerrar", callback_data="close_inline")])

    await cq.message.edit_text(
        f"📂 <b>Catálogo Francho Shop</b>\n"
        f"<i>{len(prods)} productos organizados por categoría</i>\n\n"
        f"Selecciona qué quieres comprar:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


@router.callback_query(F.data.startswith("cat:"))
async def cb_catalog_section(cq: CallbackQuery):
    await cq.answer()
    section_id = cq.data.split(":", 1)[1]
    await show_catalog_section(cq, section_id)


async def show_catalog_section(cq: CallbackQuery, section_id: str):
    prods = await db.get_cached_products()
    items = filter_products_by_catalog_section(prods, section_id)
    section = CATALOG_SECTION_BY_ID.get(section_id, {"label": "📦 Catálogo", "title": "Catálogo", "desc": "Productos disponibles."})
    if not items:
        await cq.message.edit_text("📭 Sin productos en esta categoría", reply_markup=back_kb("catalog"))
        return

    grouped = group_products_by_game(items)
    rows = []
    for game, gitems in grouped.items():
        rows.append([InlineKeyboardButton(
            text=f"{game}  ({len(gitems)})",
            callback_data=f"cgame:{section_id}:{game}",
        )])
    rows.append([InlineKeyboardButton(text="🔙 Categorías", callback_data="catalog")])

    await cq.message.edit_text(
        f"{section['label']}\n"
        f"<b>{section['title']}</b>\n"
        f"<i>{section['desc']}</i>\n\n"
        f"{len(items)} productos en {len(grouped)} grupos. Selecciona:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


@router.callback_query(F.data.startswith("game:"))
async def cb_game_select(cq: CallbackQuery):
    await cq.answer()
    game = cq.data.split(":", 1)[1]
    await show_game_regions(cq, "all", game)


@router.callback_query(F.data.startswith("cgame:"))
async def cb_category_game_select(cq: CallbackQuery):
    await cq.answer()
    parts = cq.data.split(":", 2)
    section_id = parts[1]
    game = parts[2]
    await show_game_regions(cq, section_id, game)


async def show_game_regions(cq: CallbackQuery, section_id: str, game: str):
    prods = await db.get_cached_products()
    scoped = filter_products_by_catalog_section(prods, section_id)
    grouped = group_products_by_game(scoped)
    items = grouped.get(game, [])
    if not items:
        await cq.message.edit_text("📭 Sin productos", reply_markup=back_kb("catalog"))
        return

    by_region = group_products_by_region(items)
    if len(by_region) == 1:
        region = list(by_region.keys())[0]
        await show_region_page(cq, game, region, 1, section_id=section_id)
        return

    rows = []
    for region, ritems in by_region.items():
        rows.append([InlineKeyboardButton(
            text=f"{region}  ({len(ritems)})",
            callback_data=f"creg:{section_id}:{game}:{region}",
        )])
    rows.append([InlineKeyboardButton(text="🔙 Grupos", callback_data=f"cat:{section_id}" if section_id != "all" else "catalog")])

    section = CATALOG_SECTION_BY_ID.get(section_id)
    prefix = f"{section['label']}\n" if section else ""
    await cq.message.edit_text(
        f"{prefix}<b>{game}</b>\n"
        f"<i>{len(items)} productos en {len(by_region)} regiones</i>\n\n"
        f"🌐 Selecciona tu región:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


@router.callback_query(F.data.startswith("reg:"))
async def cb_region_select(cq: CallbackQuery):
    await cq.answer()
    parts = cq.data.split(":", 2)
    game = parts[1]
    region = parts[2]
    await show_region_page(cq, game, region, 1)


@router.callback_query(F.data.startswith("creg:"))
async def cb_category_region_select(cq: CallbackQuery):
    await cq.answer()
    parts = cq.data.split(":", 3)
    section_id = parts[1]
    game = parts[2]
    region = parts[3]
    await show_region_page(cq, game, region, 1, section_id=section_id)


@router.callback_query(F.data.startswith("rpg:"))
async def cb_region_pg(cq: CallbackQuery):
    await cq.answer()
    parts = cq.data.split(":", 3)
    game = parts[1]
    region = parts[2]
    page = int(parts[3])
    await show_region_page(cq, game, region, page)


@router.callback_query(F.data.startswith("crpg:"))
async def cb_category_region_pg(cq: CallbackQuery):
    await cq.answer()
    parts = cq.data.split(":", 4)
    section_id = parts[1]
    game = parts[2]
    region = parts[3]
    page = int(parts[4])
    await show_region_page(cq, game, region, page, section_id=section_id)


async def show_region_page(cq: CallbackQuery, game: str, region: str, page: int, section_id: str = "all"):
    prods = await db.get_cached_products()
    scoped = filter_products_by_catalog_section(prods, section_id)
    grouped = group_products_by_game(scoped)
    items = grouped.get(game, [])
    by_region = group_products_by_region(items)
    region_items = by_region.get(region, items)

    if not region_items:
        await cq.message.edit_text("📭 Sin productos", reply_markup=back_kb("catalog"))
        return

    role = await get_effective_role(cq.from_user.id)
    retail_mk, reseller_mk = await pricing.preload_markups()

    PER_PAGE = 10
    total = max(1, math.ceil(len(region_items) / PER_PAGE))
    page = max(1, min(page, total))
    page_items = region_items[(page - 1) * PER_PAGE: page * PER_PAGE]

    rows = []
    row_pair = []
    for p in page_items:
        if p.get("custom_price"):
            price = p["custom_price"]
        else:
            price = await pricing.calculate_price_sync(
                p["pay_price"], role, retail_mk, reseller_mk
            )
        raw_name = p.get("goods_name", "?")
        short = clean_name_for_game(raw_name, game, max_len=26)
        btn_text = f"{short}\n💵 ${price:.2f}"

        row_pair.append(InlineKeyboardButton(
            text=btn_text,
            callback_data=f"prod:{p['id']}",
        ))
        if len(row_pair) == 2:
            rows.append(row_pair)
            row_pair = []
    if row_pair:
        rows.append(row_pair)

    nav = []
    page_cb = "crpg" if section_id != "all" else "rpg"
    if page > 1:
        cb = f"{page_cb}:{section_id}:{game}:{region}:{page-1}" if section_id != "all" else f"rpg:{game}:{region}:{page-1}"
        nav.append(InlineKeyboardButton(text="◀️", callback_data=cb))
    nav.append(InlineKeyboardButton(text=f"📄 {page}/{total}", callback_data="noop"))
    if page < total:
        cb = f"{page_cb}:{section_id}:{game}:{region}:{page+1}" if section_id != "all" else f"rpg:{game}:{region}:{page+1}"
        nav.append(InlineKeyboardButton(text="▶️", callback_data=cb))
    if len(nav) > 1:
        rows.append(nav)

    if len(by_region) > 1:
        rows.append([InlineKeyboardButton(text="🔙 Regiones", callback_data=f"cgame:{section_id}:{game}" if section_id != "all" else f"game:{game}")])
    else:
        rows.append([InlineKeyboardButton(text="🔙 Grupos", callback_data=f"cat:{section_id}" if section_id != "all" else "catalog")])

    badge = "💼 <i>Precios revendedor</i>\n" if role == "reseller" else ""
    section = CATALOG_SECTION_BY_ID.get(section_id)
    prefix = f"{section['label']}\n" if section else ""
    await cq.message.edit_text(
        f"{prefix}<b>{game}</b> — {region}\n"
        f"<i>{len(region_items)} productos</i>\n{badge}",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


@router.callback_query(F.data.startswith("gpg:"))
async def cb_game_pg_legacy(cq: CallbackQuery):
    """Compatibilidad con la versión anterior."""
    await cq.answer()
    parts = cq.data.split(":", 2)
    game = parts[1]
    await cb_game_select(CallbackQuery(
        id=cq.id, from_user=cq.from_user, chat_instance=cq.chat_instance,
        message=cq.message, data=f"game:{game}",
    ))


@router.callback_query(F.data == "close_inline")
async def cb_close_inline(cq: CallbackQuery):
    await cq.answer()
    with suppress(Exception):
        await cq.message.delete()


# ══════════════════════════════════════════════════════════════════
#  HANDLERS DE REPLY KEYBOARD
# ══════════════════════════════════════════════════════════════════

@router.message(F.text == kb.BTN_CATALOG)
async def kb_catalog(msg: Message, state: FSMContext):
    if await check_maintenance(msg.from_user.id):
        await msg.answer("🛠 Mantenimiento en curso")
        return
    await ensure_products()
    prods = await db.get_cached_products()
    if not prods:
        await msg.answer("⚠️ Catálogo vacío")
        return
    sections = group_products_by_catalog_section(prods)
    categories = [f"{section['label']}  ({len(sections[section['id']])})" for section in CATALOG_SECTIONS if section['id'] in sections]
    await state.update_data(nav="catalog_categories")
    await msg.answer(
        f"📂 <b>Catálogo Francho Shop</b>\n"
        f"<i>{len(prods)} productos organizados por categoría</i>\n\n"
        f"Selecciona qué quieres comprar 👇",
        reply_markup=kb.kb_catalog_categories(categories),
    )


# Handler que detecta selección de un juego (texto coincide con un juego del catálogo)
@router.message(F.text.regexp(r"^[^\(]+\s+\(\d+\)$"))
async def kb_game_or_region_selected(msg: Message, state: FSMContext):
    """Detecta cuando el usuario toca una categoría, juego o región."""
    data = await state.get_data()
    nav = data.get("nav", "")
    text = msg.text.strip()
    label = re.sub(r"\s*\(\d+\)\s*$", "", text).strip()

    prods = await db.get_cached_products()

    if nav == "catalog_categories":
        section_id = CATALOG_LABEL_TO_ID.get(label)
        if not section_id:
            await msg.answer("📭 Categoría no encontrada", reply_markup=await main_reply_kb(msg.from_user.id))
            await state.clear()
            return
        scoped = filter_products_by_catalog_section(prods, section_id)
        grouped = group_products_by_game(scoped)
        games_list = [f"{g}  ({len(items)})" for g, items in grouped.items()]
        section = CATALOG_SECTION_BY_ID[section_id]
        await state.update_data(nav="games", current_section=section_id)
        await msg.answer(
            f"{section['label']}\n"
            f"<b>{section['title']}</b>\n"
            f"<i>{section['desc']}</i>\n\n"
            f"Selecciona un grupo 👇",
            reply_markup=kb.kb_games(games_list),
        )
        return

    if nav == "games":
        section_id = data.get("current_section", "all")
        scoped = filter_products_by_catalog_section(prods, section_id)
        grouped = group_products_by_game(scoped)
        items = grouped.get(label, [])
        if not items:
            await msg.answer("📭 Juego no encontrado", reply_markup=await main_reply_kb(msg.from_user.id))
            await state.clear()
            return

        by_region = group_products_by_region(items)
        if len(by_region) == 1:
            region = list(by_region.keys())[0]
            await state.update_data(nav="products", current_game=label, current_region=region, current_section=section_id, page=1)
            await show_products_page(msg, label, region, 1, section_id=section_id)
            return

        regions_list = [f"{r}  ({len(ri)})" for r, ri in by_region.items()]
        await state.update_data(nav="regions", current_game=label, current_section=section_id)
        await msg.answer(
            f"<b>{label}</b>\n"
            f"<i>{len(items)} productos en {len(by_region)} regiones</i>\n\n"
            f"🌐 Selecciona tu región 👇",
            reply_markup=kb.kb_regions(regions_list),
        )
        return

    if nav == "regions":
        game = data.get("current_game", "")
        section_id = data.get("current_section", "all")
        scoped = filter_products_by_catalog_section(prods, section_id)
        grouped = group_products_by_game(scoped)
        items = grouped.get(game, [])
        by_region = group_products_by_region(items)
        region_items = by_region.get(label, [])
        if not region_items:
            await msg.answer("📭 Región sin productos")
            return
        await state.update_data(nav="products", current_region=label, current_section=section_id, page=1)
        await show_products_page(msg, game, label, 1, section_id=section_id)
        return


async def show_products_page(msg: Message, game: str, region: str, page: int, section_id: str = "all"):
    """Muestra productos de una región. Productos van INLINE (necesitan ID),
    navegación va REPLY KEYBOARD."""
    prods = await db.get_cached_products()
    scoped = filter_products_by_catalog_section(prods, section_id)
    grouped = group_products_by_game(scoped)
    items = grouped.get(game, [])
    by_region = group_products_by_region(items)
    region_items = by_region.get(region, items)

    if not region_items:
        await msg.answer("📭 Sin productos")
        return

    role = await get_effective_role(msg.from_user.id)
    retail_mk, reseller_mk = await pricing.preload_markups()

    PER_PAGE = 10
    total = max(1, math.ceil(len(region_items) / PER_PAGE))
    page = max(1, min(page, total))
    page_items = region_items[(page - 1) * PER_PAGE: page * PER_PAGE]

    # Inline buttons para los productos (necesitan callback con ID)
    inline_rows = []
    pair = []
    for p in page_items:
        if p.get("custom_price"):
            price = p["custom_price"]
        else:
            price = await pricing.calculate_price_sync(
                p["pay_price"], role, retail_mk, reseller_mk
            )
        raw_name = p.get("goods_name", "?")
        # Limpiar pasando el juego para quitar el prefijo correcto
        short = clean_name_for_game(raw_name, game, max_len=22)
        pair.append(InlineKeyboardButton(
            text=f"{short}\n💵 ${price:.2f}",
            callback_data=f"prod:{p['id']}",
        ))
        if len(pair) == 2:
            inline_rows.append(pair); pair = []
    if pair:
        inline_rows.append(pair)

    badge = "💼 <i>Precios revendedor</i>\n" if role == "reseller" else ""
    text = (
        f"<b>{game}</b> — {region}\n"
        f"<i>Página {page}/{total} · {len(region_items)} productos</i>\n{badge}\n"
        f"Toca un producto para comprarlo 👇"
    )

    # Mensaje 1: productos inline
    await msg.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=inline_rows))

    # Mensaje 2: navegación reply keyboard
    has_prev = page > 1
    has_next = page < total
    await msg.answer(
        f"📄 Página <b>{page}/{total}</b>",
        reply_markup=kb.kb_products_nav(has_prev, has_next, page, total),
    )


# Navegación de páginas vía reply keyboard
@router.message(F.text == kb.BTN_PREV)
async def kb_prev_page(msg: Message, state: FSMContext):
    data = await state.get_data()
    if data.get("nav") != "products":
        return
    page = max(1, data.get("page", 1) - 1)
    await state.update_data(page=page)
    await show_products_page(msg, data.get("current_game"), data.get("current_region"), page, section_id=data.get("current_section", "all"))


@router.message(F.text == kb.BTN_NEXT)
async def kb_next_page(msg: Message, state: FSMContext):
    data = await state.get_data()
    if data.get("nav") != "products":
        return
    page = data.get("page", 1) + 1
    await state.update_data(page=page)
    await show_products_page(msg, data.get("current_game"), data.get("current_region"), page, section_id=data.get("current_section", "all"))


@router.message(F.text == kb.BTN_BACK)
async def kb_back(msg: Message, state: FSMContext):
    data = await state.get_data()
    nav = data.get("nav", "")
    if nav == "products":
        # Volver a regiones del juego actual
        game = data.get("current_game", "")
        prods = await db.get_cached_products()
        section_id = data.get("current_section", "all")
        scoped = filter_products_by_catalog_section(prods, section_id)
        grouped = group_products_by_game(scoped)
        items = grouped.get(game, [])
        by_region = group_products_by_region(items)
        if len(by_region) <= 1:
            # No hay regiones intermedias, volver a juegos
            await kb_home(msg, state)
            return
        regions_list = [f"{r}  ({len(ri)})" for r, ri in by_region.items()]
        await state.update_data(nav="regions")
        await msg.answer(
            f"<b>{game}</b>\n🌐 Selecciona tu región 👇",
            reply_markup=kb.kb_regions(regions_list),
        )
    elif nav == "regions":
        await kb_catalog(msg, state)
    else:
        await kb_home(msg, state)


@router.message(F.text == kb.BTN_HOME)
async def kb_home(msg: Message, state: FSMContext):
    await state.clear()
    welcome = await settings.get("welcome_message")
    await msg.answer(welcome, reply_markup=await main_reply_kb(msg.from_user.id))


@router.message(F.text == kb.BTN_CANCEL)
async def kb_cancel(msg: Message, state: FSMContext):
    await state.clear()
    await msg.answer("❌ Cancelado", reply_markup=await main_reply_kb(msg.from_user.id))


@router.message(F.text == "🔍 Buscar")
async def kb_search(msg: Message, state: FSMContext):
    await msg.answer(
        "🔍 <b>Buscar producto</b>\n\n"
        "Escribe el nombre del juego:\n"
        "Ej: <code>PUBG</code>, <code>Free Fire</code>, <code>Steam</code>",
    )
    await state.set_state("searching")


@router.message(F.text.startswith("💰 Saldo") | (F.text == kb.BTN_WALLET))
async def kb_wallet(msg: Message):
    bal = await db.get_balance(msg.from_user.id)
    role = await get_effective_role(msg.from_user.id)
    min_dep = await settings.get_float("min_deposit")
    webapp_url = getattr(config, "WEBAPP_URL", None)
    text = (
        f"💰 <b>Tu billetera</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"📊 Saldo: <b>${bal:.2f} USDT</b>\n"
        f"🎭 Rol: {ROLE_LABELS.get(role, role)}\n"
        f"📥 Mín depósito: ${min_dep:.2f} USDT\n\n"
        f"💵 Elige un monto para recargar con USDT 👇\n"
        f"🛒 O abre el catálogo si ya tienes saldo"
    )
    await msg.answer(text, reply_markup=kb.kb_wallet(webapp_url=webapp_url))


# Handlers de presets de depósito (reply keyboard)
@router.message(F.text.in_({kb.BTN_DEP_5, kb.BTN_DEP_10, kb.BTN_DEP_25,
                              kb.BTN_DEP_50, kb.BTN_DEP_100, kb.BTN_DEP_250}))
async def kb_deposit_preset(msg: Message):
    amount = float(msg.text.replace("💵 $", "").strip())
    await create_oxapay_invoice(msg, amount)


@router.message(F.text == kb.BTN_DEP_CUSTOM)
async def kb_deposit_custom(msg: Message, state: FSMContext):
    min_dep = await settings.get_float("min_deposit")
    await state.set_state(DepositFlow.waiting_amount)
    await msg.answer(
        f"✏️ <b>Monto personalizado</b>\n\n"
        f"Escribe el monto en USDT a depositar.\n"
        f"Mínimo: <b>${min_dep:.2f}</b>",
        reply_markup=kb.kb_cancel(),
    )


@router.message(F.text == kb.BTN_DEP_HISTORY)
async def kb_dep_history(msg: Message):
    deps = await db.get_user_deposits(msg.from_user.id, 10)
    if not deps:
        await msg.answer("📭 Sin depósitos aún.")
        return
    text = "📜 <b>Tus depósitos</b>\n\n"
    emojis = {"pending": "⏳", "Paying": "🔄", "paid": "✅",
              "expired": "⌛", "failed": "❌"}
    for d in deps:
        em = emojis.get(d["status"], "❓")
        ts = time.strftime("%d/%m %H:%M", time.localtime(d["created_at"]))
        text += f"{em} ${d['amount_usd']:.2f} USDT — {d['status']} — {ts}\n"
    await msg.answer(text)


@router.message(F.text == kb.BTN_BAL_HISTORY)
async def kb_bal_history(msg: Message):
    history = await db.get_balance_history(msg.from_user.id, 15)
    if not history:
        await msg.answer("📭 Sin movimientos.")
        return
    text = "📊 <b>Historial de saldo</b>\n\n"
    type_emojis = {"deposit": "💵", "purchase": "🛒", "refund": "💸",
                   "admin_adjust": "👑", "referral": "👥"}
    for h in history:
        em = type_emojis.get(h["type"], "💰")
        sign = "+" if h["amount"] >= 0 else ""
        ts = time.strftime("%d/%m %H:%M", time.localtime(h["created_at"]))
        text += f"{em} {sign}${h['amount']:.2f} USDT — {h.get('note', h['type'])} — {ts}\n"
    await msg.answer(text)


@router.message(F.text == "📋 Mis pedidos")
async def kb_orders(msg: Message):
    orders = await db.get_user_orders(msg.from_user.id, 10)
    if not orders:
        await msg.answer("📭 No tienes pedidos.")
        return
    text = "📋 <b>Tus pedidos</b>\n\n"
    for o in orders:
        text += format_order_short(o) + "\n\n"
    rows = []
    if any(o.get("order_status", 0) in (0, 1) for o in orders):
        rows.append([InlineKeyboardButton(text="🔄 Actualizar", callback_data="refresh_orders")])
    rows.append([InlineKeyboardButton(text="🔙 Cerrar", callback_data="close_inline")])
    await msg.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.message(F.text == "ℹ️ Ayuda")
async def kb_help(msg: Message):
    support = await settings.get("support_handle")
    role = await get_effective_role(msg.from_user.id)
    text = (
        "ℹ️ <b>¿Cómo funciona?</b>\n\n"
        "1️⃣ <b>Recarga saldo</b> → 💰 → Paga con USDT\n"
        "2️⃣ <b>Abre el catálogo</b> → 🛒\n"
        "3️⃣ <b>Elige juego</b> → producto → región\n"
        "4️⃣ <b>Ingresa tu ID</b> → validamos\n"
        "5️⃣ <b>Confirma</b> → recibe instantáneo\n\n"
    )
    if role == "reseller":
        rmk = await settings.get_float("reseller_markup")
        text += f"💎 Precio especial: costo + {rmk}%\n\n"
    text += f"📞 <b>Soporte:</b> {support}"
    await msg.answer(text)


@router.message(F.text == "💼 Ser revendedor")
async def kb_become_reseller(msg: Message, state: FSMContext):
    await become_reseller(msg, state)


@router.message(F.text == "💼 Panel Revendedor")
async def kb_reseller_panel(msg: Message):
    role = await get_effective_role(msg.from_user.id)
    if role not in ("reseller", "admin"):
        return
    bal = await db.get_balance(msg.from_user.id)
    reseller_mk = await settings.get_float("reseller_markup")
    retail_mk = await settings.get_float("retail_markup")
    orders = await db.get_user_orders(msg.from_user.id, limit=1000)
    total_orders = len(orders)
    text = (
        "💼 <b>Panel Revendedor</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"💰 Saldo: <b>${bal:.2f}</b>\n"
        f"📦 Compras: {total_orders}\n\n"
        f"💎 <b>Tu precio especial:</b>\n"
        f"Costo + {reseller_mk}% (vs retail +{retail_mk}%)"
    )
    await msg.answer(text)


@router.message(F.text == "👑 Admin")
async def kb_admin(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    await cmd_admin(msg)


@router.message(F.text == kb.BTN_HIDE)
async def kb_hide_menu(msg: Message):
    await msg.answer(
        "✅ Menú ocultado.\n\n"
        "Usa /menu o /start para mostrarlo de nuevo.",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(Command("menu"))
async def cmd_menu(msg: Message):
    await msg.answer(
        "📱 Menú activo",
        reply_markup=await main_reply_kb(msg.from_user.id),
    )


@router.callback_query(F.data == "search")
async def cb_search(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    await cq.message.edit_text(
        "🔍 <b>Buscar producto</b>\n\n"
        "Escribe el nombre del juego:\n"
        "Ej: <code>PUBG</code>, <code>Free Fire</code>, <code>Steam</code>",
        reply_markup=back_kb(),
    )
    await state.set_state("searching")
    await cq.answer()


async def handle_search(msg: Message, state: FSMContext):
    await ensure_products()
    q = msg.text.strip()
    await state.clear()

    results = await db.get_cached_products(search=q)
    if not results:
        await msg.answer(
            f"😕 Sin resultados para \"<b>{q}</b>\".",
            reply_markup=back_kb(),
        )
        return

    role = await get_effective_role(msg.from_user.id)
    retail_mk, reseller_mk = await pricing.preload_markups()

    rows = []
    for p in results[:15]:
        if p.get("custom_price"):
            price = p["custom_price"]
        else:
            price = await pricing.calculate_price_sync(
                p["pay_price"], role, retail_mk, reseller_mk
            )
        name = p.get("display_name") or p["goods_name"]
        rows.append([InlineKeyboardButton(
            text=f"{name}  •  ${price:.2f}",
            callback_data=f"prod:{p['id']}",
        )])
    rows.append([InlineKeyboardButton(text="🔙 Menú", callback_data="menu")])

    await msg.answer(
        f"🔍 <b>Resultados para \"{q}\"</b>  ({len(results)})\n\nSelecciona:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 6: DETALLE DE PRODUCTO (con regiones completas)
# ══════════════════════════════════════════════════════════════════

@router.callback_query(F.data.startswith("prod:"))
async def cb_product_detail(cq: CallbackQuery):
    prod_id = int(cq.data.split(":")[1])
    product = await db.get_cached_product(prod_id)
    if not product:
        await cq.answer("No encontrado", show_alert=True)
        return

    if product.get("is_hidden"):
        await cq.answer("Producto no disponible", show_alert=True)
        return

    role = await get_effective_role(cq.from_user.id)

    # Precio
    if product.get("custom_price"):
        price = product["custom_price"]
        markup_info = ""
    else:
        pricing_info = await pricing.calculate_price(product["pay_price"], role)
        price = pricing_info["sell_price"]
        if role == "reseller":
            markup_info = f"💎 <i>Precio revendedor (-{pricing_info['markup_pct']}% vs retail)</i>\n"
        else:
            markup_info = ""

    fields = parse_platform_config(product.get("platform_config", "[]"))
    emoji, cat_name = config.PRODUCT_TYPES.get(product["type"], ("📦", "Otros"))
    display_name = product.get("display_name") or product["goods_name"]

    # Texto detallado
    text = (
        f"{emoji} <b>{display_name}</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"💰 Precio: <b>${price:.2f} USDT</b>\n"
        f"{markup_info}"
        f"📂 Categoría: {cat_name}\n"
    )

    if product.get("admin_note"):
        text += f"📝 {product['admin_note']}\n"

    # Mostrar campos requeridos con regiones/opciones
    if fields:
        text += "\n📋 <b>Datos requeridos:</b>\n"
        for f in fields:
            name = f.get("name", "Campo")
            tip = f.get("tip", "")
            is_select = f.get("selected") == 1
            values = f.get("values", [])

            if is_select and values:
                opts = [v.get("serverName", v.get("name", "?")) for v in values]
                # Mostrar todas las opciones claramente
                text += f"\n  🌐 <b>{name}:</b>\n"
                for i, opt in enumerate(opts, 1):
                    text += f"     {i}. {opt}\n"
            else:
                text += f"\n  ✏️ <b>{name}:</b> <i>{tip}</i>\n"

    # Balance y botón de compra
    bal = await db.get_balance(cq.from_user.id)
    can_buy = bal >= price

    if can_buy:
        buy_btn = InlineKeyboardButton(
            text=f"🛒 Comprar (${price:.2f})",
            callback_data=f"buy:{prod_id}",
        )
    else:
        missing = price - bal
        buy_btn = InlineKeyboardButton(
            text=f"💰 Recargar (faltan ${missing:.2f})",
            callback_data="wallet",
        )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [buy_btn],
        [InlineKeyboardButton(text="🔙 Atrás", callback_data="catalog")],
    ])

    text += f"\n💳 Tu saldo: ${bal:.2f}"
    await cq.message.edit_text(text, reply_markup=kb)
    await cq.answer()

# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 7: FLUJO DE COMPRA
# ══════════════════════════════════════════════════════════════════

@router.callback_query(F.data.startswith("buy:"))
async def cb_start_buy(cq: CallbackQuery, state: FSMContext):
    if await check_maintenance(cq.from_user.id):
        await cq.answer("🛠 Mantenimiento", show_alert=True)
        return

    # Rate limit
    max_per_hour = await settings.get_int("max_orders_per_hour", 20)
    recent = await db.count_user_orders_last_hour(cq.from_user.id)
    if recent >= max_per_hour:
        await cq.answer(f"⏱ Límite: {max_per_hour} compras/hora. Intenta más tarde.", show_alert=True)
        return

    prod_id = int(cq.data.split(":")[1])
    product = await db.get_cached_product(prod_id)
    if not product or product.get("is_hidden"):
        await cq.answer("No disponible", show_alert=True)
        return

    role = await get_effective_role(cq.from_user.id)
    if product.get("custom_price"):
        price = product["custom_price"]
        markup_pct = 0
    else:
        pi = await pricing.calculate_price(product["pay_price"], role)
        price = pi["sell_price"]
        markup_pct = pi["markup_pct"]

    bal = await db.get_balance(cq.from_user.id)
    if bal < price:
        await cq.answer(f"❌ Saldo insuficiente: ${bal:.2f} < ${price:.2f}", show_alert=True)
        return

    fields = parse_platform_config(product.get("platform_config", "[]"))

    await state.update_data(
        product_id=prod_id,
        product_name=product.get("display_name") or product["goods_name"],
        cost_price=product["pay_price"],
        sell_price=price,
        markup_pct=markup_pct,
        fields=fields,
        current_field=0,
        filled=[],
    )

    if not fields:
        await show_confirm(cq.message, state, cq.from_user.id, edit=True)
    else:
        await ask_next_field(cq.message, state, edit=True)

    await cq.answer()


async def ask_next_field(msg: Message, state: FSMContext, edit: bool = False):
    data = await state.get_data()
    idx = data["current_field"]
    fields = data["fields"]

    if idx >= len(fields):
        await show_confirm(msg, state, msg.chat.id, edit=edit)
        return

    field = fields[idx]
    name = field.get("name", "Campo")
    tip = field.get("tip", f"Ingresa {name}")
    is_select = field.get("selected") == 1
    values = field.get("values", [])

    if is_select and values:
        rows = []
        for v in values:
            label = v.get("serverName", v.get("name", "?"))
            sid = v.get("serverId", "0")
            rows.append([InlineKeyboardButton(
                text=f"🌐 {label}", callback_data=f"fsel:{idx}:{sid}",
            )])
        rows.append([InlineKeyboardButton(text="❌ Cancelar", callback_data="menu")])

        text = (
            f"📝 <b>Paso {idx+1}/{len(fields)}</b>\n\n"
            f"🌐 <b>{name}</b>\n"
            f"<i>{tip}</i>\n\n"
            f"Selecciona una opción:"
        )
        await state.set_state(OrderFlow.filling_fields)
        fn = msg.edit_text if edit else msg.answer
        await fn(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
    else:
        text = (
            f"📝 <b>Paso {idx+1}/{len(fields)}</b>\n\n"
            f"✏️ <b>{name}</b>\n"
            f"<i>{tip}</i>"
        )
        await state.set_state(OrderFlow.filling_fields)
        fn = msg.edit_text if edit else msg.answer
        await fn(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="❌ Cancelar", callback_data="menu")],
        ]))


@router.callback_query(F.data.startswith("fsel:"))
async def cb_field_select(cq: CallbackQuery, state: FSMContext):
    parts = cq.data.split(":")
    idx = int(parts[1])
    sid = parts[2]

    data = await state.get_data()
    field = data["fields"][idx]

    selected = None
    for v in field.get("values", []):
        if str(v.get("serverId")) == sid:
            selected = v
            break

    filled = data["filled"]
    fc = dict(field)
    fc["value"] = selected or {"serverId": sid}
    filled.append(fc)

    next_idx = idx + 1
    await state.update_data(filled=filled, current_field=next_idx)
    await ask_next_field(cq.message, state, edit=True)
    await cq.answer()


async def show_confirm(msg: Message, state: FSMContext, user_id: int, edit: bool = False):
    data = await state.get_data()
    filled = data.get("filled", [])
    bal = await db.get_balance(user_id)

    # Validar cuenta si hay playerid
    player_id, server_id, account_name = None, None, None
    for f in filled:
        fn = f.get("filedName", "")
        if fn == "playerid":
            player_id = str(f.get("value", ""))
        elif fn == "server":
            v = f.get("value", {})
            if isinstance(v, dict):
                server_id = str(v.get("serverId", ""))

    if player_id:
        try:
            info = await buffpin.validate_user(player_id, server_id=server_id)
            if info.get("exist") == 0:
                fn = msg.edit_text if edit else msg.answer
                await fn(
                    f"❌ <b>Cuenta no encontrada</b>\n\n"
                    f"El ID <code>{player_id}</code> no existe.\n"
                    "Verifica e intenta de nuevo.",
                    reply_markup=back_kb(),
                )
                await state.clear()
                return
            if info.get("exist") == 1:
                account_name = info.get("accountName", "")
        except Exception:
            pass

    text = (
        "📋 <b>Confirmar compra</b>\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"🎮 <b>{data['product_name']}</b>\n"
    )
    for f in filled:
        fn_name = f.get("name", "")
        val = f.get("value", "")
        if isinstance(val, dict):
            val = val.get("serverName", val.get("name", str(val)))
        text += f"  • {fn_name}: <code>{val}</code>\n"

    if account_name:
        text += f"  • Nickname: <b>{account_name}</b>\n"

    text += (
        f"\n💰 Precio: <b>${data['sell_price']:.2f}</b>\n"
        f"📊 Tu saldo: ${bal:.2f}\n"
        f"📊 Después: ${bal - data['sell_price']:.2f}\n"
    )

    recharge_config = json.dumps(filled, ensure_ascii=False, default=str)
    await state.update_data(recharge_config=recharge_config)
    await state.set_state(OrderFlow.confirm)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"✅ Confirmar (${data['sell_price']:.2f})", callback_data="confirm_buy")],
        [InlineKeyboardButton(text="❌ Cancelar", callback_data="menu")],
    ])

    fn = msg.edit_text if edit else msg.answer
    await fn(text, reply_markup=kb)


@router.callback_query(F.data == "confirm_buy", OrderFlow.confirm)
async def cb_confirm_buy(cq: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    user_id = cq.from_user.id
    price = data["sell_price"]
    role = await get_effective_role(user_id)

    ok = await db.spend_balance(user_id, price)
    if not ok:
        await cq.answer("❌ Saldo insuficiente", show_alert=True)
        return

    merchant_oid = await db.create_order(
        user_id=user_id,
        user_role=role,
        product_id=data["product_id"],
        product_name=data["product_name"],
        quantity=1,
        cost_price=data["cost_price"],
        sell_price=price,
        markup_pct=data.get("markup_pct", 0),
        recharge_config=data.get("recharge_config", "[]"),
    )

    await state.clear()
    await cq.message.edit_text(
        "✅ <b>¡Compra realizada!</b>\n\n"
        f"🎮 {data['product_name']}\n"
        f"💵 ${price:.2f} descontados de tu saldo\n\n"
        "🔄 Procesando tu recarga..."
    )

    try:
        notify_url = (
            f"{config.WEBHOOK_HOST}{config.BUFFPIN_CALLBACK_PATH}"
            if config.WEBHOOK_HOST else None
        )
        result = await buffpin.submit_order(
            merchant_order_id=merchant_oid,
            product_id=data["product_id"],
            qty=1,
            recharge_config=data.get("recharge_config", "[]"),
            notify_url=notify_url,
        )

        bp_oid = str(result.get("orderId", ""))
        status = result.get("orderStatus", 0)
        await db.update_order_buffpin(merchant_oid, bp_oid, status)

        # Cards inmediatas
        items = result.get("orderItemsList", [])
        if items:
            cards = items[0].get("orderCardsList", [])
            if cards:
                await db.update_order_status(
                    merchant_order_id=merchant_oid,
                    card_data=json.dumps(cards, ensure_ascii=False),
                    status=items[0].get("orderStatus", status),
                )

        if status == 2:
            await notify_order_complete(user_id, merchant_oid)
        else:
            order = await db.get_order(merchant_oid)
            if order:
                await bot.send_message(
                    user_id,
                    f"📦 Pedido en proceso\n\n{format_order_short(order)}",
                    reply_markup=back_kb(),
                )

        # Notificar admins
        user = await db.get_user(user_id)
        uname = f"@{user['username']}" if user and user.get("username") else f"ID:{user_id}"
        role_badge = "💼" if role == "reseller" else "🛒"
        await notify_admins(
            f"🛒 <b>Nueva compra</b> {role_badge}\n"
            f"👤 {uname}\n"
            f"🎮 {data['product_name']}\n"
            f"💰 ${price:.2f}\n"
            f"💎 Ganancia: ${price - data['cost_price']:.2f}\n"
            f"🆔 {merchant_oid}"
        )

    except BuffPinError as e:
        await db.add_balance(user_id, price, "refund", merchant_oid, f"Reembolso: {e.message}")
        await db.update_order_status(merchant_order_id=merchant_oid, status=4, error_message=str(e))
        bal = await db.get_balance(user_id)
        await bot.send_message(
            user_id,
            f"⚠️ <b>Error al procesar</b>\n\n{e.message}\n\n"
            f"💸 ${price:.2f} devueltos.\n📊 Saldo: ${bal:.2f}",
            reply_markup=back_kb(),
        )

    await cq.answer()


async def notify_order_complete(user_id: int, merchant_oid: str):
    order = await db.get_order(merchant_oid)
    if not order:
        return
    with suppress(Exception):
        await bot.send_message(
            user_id,
            f"🎉 <b>¡Recarga completada!</b>\n\n{format_order_short(order)}",
            reply_markup=back_kb(),
        )


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 8: MIS PEDIDOS
# ══════════════════════════════════════════════════════════════════

@router.callback_query(F.data == "my_orders")
async def cb_my_orders(cq: CallbackQuery):
    await cq.answer()
    orders = await db.get_user_orders(cq.from_user.id, 10)
    if not orders:
        await cq.message.edit_text("📭 No tienes pedidos.", reply_markup=back_kb())
        await cq.answer()
        return

    text = "📋 <b>Tus pedidos</b>\n\n"
    for o in orders:
        text += format_order_short(o) + "\n\n"

    rows = []
    if any(o.get("order_status", 0) in (0, 1) for o in orders):
        rows.append([InlineKeyboardButton(text="🔄 Actualizar", callback_data="refresh_orders")])
    rows.append([InlineKeyboardButton(text="🔙 Menú", callback_data="menu")])

    await cq.message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
    await cq.answer()


@router.callback_query(F.data == "refresh_orders")
async def cb_refresh_orders(cq: CallbackQuery):
    await cq.answer()
    orders = await db.get_user_orders(cq.from_user.id, 10)
    updated = 0
    for o in [x for x in orders if x.get("order_status", 0) in (0, 1)]:
        try:
            detail = await buffpin.get_order(merchant_order_id=o["merchant_order_id"])
            ns = detail.get("orderStatus", o["order_status"])
            cd, em = None, None
            items = detail.get("orderItemsList", [])
            if items:
                cards = items[0].get("orderCardsList", [])
                if cards:
                    cd = json.dumps(cards, ensure_ascii=False)
                em = items[0].get("returnMessage")
            await db.update_order_status(
                merchant_order_id=o["merchant_order_id"],
                status=ns, refund_status=detail.get("refundStatus"),
                card_data=cd, error_message=em,
            )
            if ns != o["order_status"]:
                updated += 1
        except Exception:
            pass
    await cq.answer(f"✅ {updated} actualizadas" if updated else "Sin cambios")
    await cb_my_orders(cq)


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 9: REVENDEDOR (solicitar, ver estado, panel)
# ══════════════════════════════════════════════════════════════════

@router.callback_query(F.data == "become_reseller")
@router.message(Command("become_reseller"))
async def become_reseller(event, state: FSMContext):
    user_id = event.from_user.id
    role = await get_effective_role(user_id)

    if role in ("reseller", "admin"):
        text = "✅ Ya eres revendedor."
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="💼 Panel Revendedor", callback_data="reseller_panel")],
            [InlineKeyboardButton(text="🔙 Menú", callback_data="menu")],
        ])
        if isinstance(event, CallbackQuery):
            await event.message.edit_text(text, reply_markup=kb)
            await event.answer()
        else:
            await event.answer(text, reply_markup=kb)
        return

    # Verificar si aplicaciones están abiertas
    if not await settings.get_bool("reseller_applications_open"):
        text = "⚠️ Las solicitudes de revendedor están cerradas temporalmente."
        if isinstance(event, CallbackQuery):
            await event.message.edit_text(text, reply_markup=back_kb())
            await event.answer()
        else:
            await event.answer(text, reply_markup=back_kb())
        return

    # Verificar si ya hay solicitud pendiente
    pending = await db.get_user_pending_application(user_id)
    if pending:
        ts = time.strftime("%d/%m/%Y", time.localtime(pending["created_at"]))
        text = (
            "⏳ <b>Solicitud pendiente</b>\n\n"
            f"Ya enviaste una solicitud el {ts}.\n"
            "Te notificaremos cuando sea revisada."
        )
        if isinstance(event, CallbackQuery):
            await event.message.edit_text(text, reply_markup=back_kb())
            await event.answer()
        else:
            await event.answer(text, reply_markup=back_kb())
        return

    reseller_mk = await settings.get_float("reseller_markup")
    retail_mk = await settings.get_float("retail_markup")
    discount = retail_mk - reseller_mk

    text = (
        "💼 <b>Conviértete en Revendedor</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Como revendedor obtienes:\n\n"
        f"✅ <b>Descuento del {discount:.1f}%</b> en todos los productos\n"
        f"   (precio retail: +{retail_mk}% → tuyo: +{reseller_mk}%)\n"
        "✅ Recarga saldo por USDT con OxaPay\n"
        "✅ Compra al por mayor\n"
        "✅ Revende a tus clientes con tu margen\n"
        "✅ Próximamente: tu propio bot de Telegram\n\n"
        "📝 <b>Envía una descripción de tu negocio</b>\n"
        "(tu experiencia, clientes, volumen estimado, etc.)\n\n"
        "Un admin revisará tu solicitud y te notificará."
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Enviar solicitud", callback_data="reseller_apply")],
        [InlineKeyboardButton(text="🔙 Menú", callback_data="menu")],
    ])

    if isinstance(event, CallbackQuery):
        await event.message.edit_text(text, reply_markup=kb)
        await event.answer()
    else:
        await event.answer(text, reply_markup=kb)


@router.callback_query(F.data == "reseller_apply")
async def cb_reseller_apply(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    await state.set_state(ResellerFlow.waiting_business_desc)
    await cq.message.edit_text(
        "📝 <b>Describe tu negocio</b>\n\n"
        "Escribe un mensaje con:\n"
        "• Tu experiencia vendiendo recargas\n"
        "• Cuántos clientes tienes\n"
        "• Volumen estimado mensual\n"
        "• Por qué quieres ser revendedor\n\n"
        "<i>Mínimo 50 caracteres.</i>",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="❌ Cancelar", callback_data="menu")],
        ]),
    )
    await cq.answer()


@router.message(ResellerFlow.waiting_business_desc)
async def msg_reseller_desc(msg: Message, state: FSMContext):
    desc = msg.text.strip()
    if len(desc) < 50:
        await msg.answer(f"❌ Mínimo 50 caracteres (tienes {len(desc)}).")
        return
    if len(desc) > 2000:
        await msg.answer("❌ Máximo 2000 caracteres.")
        return

    app_id = await db.create_reseller_application(msg.from_user.id, desc)
    await state.clear()

    await msg.answer(
        "✅ <b>¡Solicitud enviada!</b>\n\n"
        f"🆔 ID: #{app_id}\n"
        "⏱ Un admin la revisará pronto.\n"
        "Te notificaremos el resultado.",
        reply_markup=back_kb("menu", "🔙 Menú"),
    )

    # Notificar admins
    user = await db.get_user(msg.from_user.id)
    uname = f"@{user['username']}" if user and user.get("username") else f"ID:{msg.from_user.id}"

    for aid in config.ADMIN_IDS:
        with suppress(Exception):
            await bot.send_message(
                aid,
                f"💼 <b>Nueva solicitud de revendedor</b>\n\n"
                f"🆔 #{app_id}\n"
                f"👤 {uname}\n"
                f"📊 Depositado: ${user.get('total_deposit', 0):.2f}\n"
                f"💸 Gastado: ${user.get('total_spent', 0):.2f}\n\n"
                f"📝 <i>{desc[:500]}{'...' if len(desc) > 500 else ''}</i>",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="✅ Aprobar", callback_data=f"app_ok:{app_id}"),
                     InlineKeyboardButton(text="❌ Rechazar", callback_data=f"app_no:{app_id}")],
                    [InlineKeyboardButton(text="📋 Ver todas", callback_data="adm_applications")],
                ]),
            )


@router.callback_query(F.data == "reseller_panel")
async def cb_reseller_panel(cq: CallbackQuery):
    await cq.answer()
    role = await get_effective_role(cq.from_user.id)
    if role not in ("reseller", "admin"):
        await cq.answer("❌ No autorizado", show_alert=True)
        return

    user = await db.get_user(cq.from_user.id)
    bal = await db.get_balance(cq.from_user.id)
    retail_mk = await settings.get_float("retail_markup")
    reseller_mk = await settings.get_float("reseller_markup")

    # Estadísticas propias
    orders = await db.get_user_orders(cq.from_user.id, limit=1000)
    total_orders = len(orders)
    total_spent = sum(o.get("sell_price", 0) for o in orders if o.get("order_status") == 2)

    text = (
        "💼 <b>Panel de Revendedor</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"👤 {user.get('first_name', '?')}\n"
        f"💰 Saldo: <b>${bal:.2f}</b>\n"
        f"📊 Compras totales: {total_orders}\n"
        f"💸 Gastado: ${total_spent:.2f}\n\n"
        f"💎 <b>Tu precio especial:</b>\n"
        f"Costo + {reseller_mk}% (vs retail +{retail_mk}%)\n\n"
        f"🔧 <i>El panel para gestionar tu propio bot estará\n"
        f"disponible pronto (Fase 2).</i>"
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💰 Recargar saldo", callback_data="wallet"),
         InlineKeyboardButton(text="🛒 Catálogo", callback_data="catalog")],
        [InlineKeyboardButton(text="📋 Mis compras", callback_data="my_orders")],
        [InlineKeyboardButton(text="🔙 Menú", callback_data="menu")],
    ])

    await cq.message.edit_text(text, reply_markup=kb)
    await cq.answer()


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 10: PANEL DE ADMIN
# ══════════════════════════════════════════════════════════════════

@router.message(Command("admin"))
@router.callback_query(F.data == "admin_panel")
async def cmd_admin(event, **kwargs):
    if not await is_admin(event.from_user.id):
        return

    users_count = await db.count_users_by_role()
    stats_24h = await db.get_order_stats(days=1)
    pending_apps = await db.get_pending_applications()

    bp_balance = "?"
    try:
        bp = await buffpin.get_balance()
        bp_balance = f"{bp.get('balance', 0):.2f} {bp.get('currency', 'USD')}"
    except Exception:
        pass

    text = (
        "👑 <b>Panel de Administración</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"👥 Total: <b>{users_count.get('total', 0)}</b>  "
        f"(🛒 {users_count.get('user', 0)} · 💼 {users_count.get('reseller', 0)} · 🚫 {users_count.get('banned', 0)})\n\n"
        f"💰 24h: ${stats_24h['revenue']:.2f}  ({stats_24h['total']} órdenes)\n"
        f"💎 Profit 24h: ${stats_24h['profit']:.2f}\n"
        f"🏦 BuffPin: {bp_balance}\n"
    )
    if pending_apps:
        text += f"\n⏳ Solicitudes pendientes: <b>{len(pending_apps)}</b>\n"
    text += "\n👇 Selecciona una sección"

    if isinstance(event, CallbackQuery):
        await event.message.answer(text, reply_markup=kb.kb_admin())
        await event.answer()
    else:
        await event.answer(text, reply_markup=kb.kb_admin())


# ─────── Helper para reusar handlers callback como handlers de mensaje ───────
class _FakeCQ:
    def __init__(self, msg):
        self.from_user = msg.from_user
        self.message = msg
        self.data = ""
    async def answer(self, *a, **kw):
        pass


# ─────── Handlers reply keyboard del admin ───────

@router.message(F.text == kb.BTN_ADM_DASHBOARD)
async def kb_adm_dashboard(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    await cb_adm_dashboard(_FakeCQ(msg))


@router.message(F.text == kb.BTN_ADM_CONFIG)
async def kb_adm_config_h(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    retail = await settings.get_float("retail_markup")
    reseller = await settings.get_float("reseller_markup")
    min_dep = await settings.get_float("min_deposit")
    min_wd = await settings.get_float("min_withdrawal")
    maint = await settings.get_bool("maintenance_mode")
    apps_open = await settings.get_bool("reseller_applications_open")
    support = await settings.get("support_handle")
    text = (
        "⚙️ <b>Configuración</b>\n━━━━━━━━━━━━━━━━━━\n\n"
        f"💰 Retail: <b>{retail}%</b>   💎 Reseller: <b>{reseller}%</b>\n"
        f"📥 Mín dep: ${min_dep:.2f}   📤 Mín retiro: ${min_wd:.2f}\n\n"
        f"🛠 Mantenimiento: {'🔴 ON' if maint else '🟢 OFF'}\n"
        f"💼 Solicitudes: {'🟢 Abiertas' if apps_open else '🔴 Cerradas'}\n"
        f"📞 Soporte: {support}\n\n"
        f"<i>Cambios en caliente, sin reiniciar.</i>"
    )
    await msg.answer(text, reply_markup=kb.kb_admin_config())


@router.message(F.text == kb.BTN_ADM_USERS)
async def kb_adm_users_h(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    await cb_adm_users(_FakeCQ(msg), None)


@router.message(F.text == kb.BTN_ADM_PRODUCTS)
async def kb_adm_products_h(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    total = len(await db.get_cached_products(include_hidden=True))
    visible = len(await db.get_cached_products(include_hidden=False))
    text = (
        "🛒 <b>Productos</b>\n\n"
        f"📦 Total: {total}\n👁 Visibles: {visible}\n🙈 Ocultos: {total - visible}"
    )
    await msg.answer(text, reply_markup=kb.kb_admin_products())


@router.message(F.text == kb.BTN_ADM_ORDERS_ALL)
async def kb_adm_orders_h(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    await cb_adm_orders(_FakeCQ(msg))


@router.message(F.text == kb.BTN_ADM_DEPOSITS)
async def kb_adm_deposits_h(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    await cb_adm_deposits(_FakeCQ(msg))


@router.message(F.text.startswith("💼 Solicitudes"))
async def kb_adm_apps_h(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    await cb_adm_apps(_FakeCQ(msg))


@router.message(F.text == kb.BTN_ADM_BROADCAST)
async def kb_adm_broadcast_h(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    counts = await db.count_users_by_role()
    text = (
        "📢 <b>Broadcast</b>\n\n"
        f"🛒 Clientes: {counts.get('user', 0)}\n"
        f"💼 Revendedores: {counts.get('reseller', 0)}\n"
        f"📊 Total: {counts.get('total', 0)}\n\n"
        f"👇 Selecciona audiencia"
    )
    await msg.answer(text, reply_markup=kb.kb_admin_broadcast())


@router.message(F.text == kb.BTN_BC_ALL)
async def kb_bc_all(msg: Message, state: FSMContext):
    await state.update_data(broadcast_target="all")
    await state.set_state(AdminFlow.broadcast_text)
    await msg.answer("📢 Escribe el mensaje (HTML permitido):", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_BC_USERS)
async def kb_bc_users(msg: Message, state: FSMContext):
    await state.update_data(broadcast_target="user")
    await state.set_state(AdminFlow.broadcast_text)
    await msg.answer("📢 Mensaje para clientes:", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_BC_RESELLERS)
async def kb_bc_resellers(msg: Message, state: FSMContext):
    await state.update_data(broadcast_target="reseller")
    await state.set_state(AdminFlow.broadcast_text)
    await msg.answer("📢 Mensaje para revendedores:", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_ADM_AUDIT)
async def kb_adm_audit_h(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    await cb_adm_audit(_FakeCQ(msg))


# ─────── Config admin: handlers de los botones del teclado ───────

@router.message(F.text == kb.BTN_CFG_RETAIL)
async def kb_cfg_retail(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    await state.set_state(AdminFlow.edit_retail_markup)
    await msg.answer("💰 Nuevo retail markup % (ej: 20):", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_CFG_RESELLER)
async def kb_cfg_reseller(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    await state.set_state(AdminFlow.edit_reseller_markup)
    await msg.answer("💎 Nuevo reseller markup % (ej: 8):", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_CFG_MIN_DEP)
async def kb_cfg_mindep(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    await state.set_state(AdminFlow.edit_min_deposit)
    await msg.answer("📥 Nuevo mínimo de depósito USDT:", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_CFG_MIN_WD)
async def kb_cfg_minwd(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    await state.set_state(AdminFlow.edit_min_withdrawal)
    await msg.answer("📤 Nuevo mínimo de retiro USDT:", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_CFG_WELCOME)
async def kb_cfg_welcome(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    await state.set_state(AdminFlow.edit_welcome_msg)
    await msg.answer("💬 Nuevo mensaje de bienvenida:", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_CFG_SUPPORT)
async def kb_cfg_support(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    await state.set_state(AdminFlow.edit_support)
    await msg.answer("📞 Nuevo @username de soporte:", reply_markup=kb.kb_cancel())


@router.message(F.text == kb.BTN_CFG_MAINT)
async def kb_cfg_maint_toggle(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    current = await settings.get_bool("maintenance_mode")
    await settings.set_value("maintenance_mode", "0" if current else "1", msg.from_user.id)
    await db.audit(msg.from_user.id, "toggle_maintenance", "setting", "maintenance_mode",
                   f"{'OFF' if current else 'ON'}")
    await msg.answer(f"🛠 Mantenimiento: <b>{'OFF' if current else 'ON'}</b>")


@router.message(F.text == kb.BTN_CFG_APPS)
async def kb_cfg_apps_toggle(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    current = await settings.get_bool("reseller_applications_open")
    await settings.set_value("reseller_applications_open", "0" if current else "1", msg.from_user.id)
    await db.audit(msg.from_user.id, "toggle_apps", "setting", "reseller_applications_open",
                   f"{'closed' if current else 'open'}")
    await msg.answer(f"💼 Solicitudes: <b>{'Cerradas' if current else 'Abiertas'}</b>")


# ─────── Productos admin (botones del teclado) ───────

@router.message(F.text == kb.BTN_PROD_REFRESH)
async def kb_prod_refresh(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    await msg.answer("🔄 Actualizando catálogo...")
    await refresh_products()
    n = len(await db.get_cached_products(include_hidden=True))
    await db.audit(msg.from_user.id, "refresh_products", "products", "all", f"{n} items")
    await msg.answer(f"✅ {n} productos actualizados")


@router.message(F.text == kb.BTN_PROD_SEARCH)
async def kb_prod_search(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    await state.set_state(AdminFlow.search_product)
    await msg.answer("🔍 Escribe el nombre a buscar:", reply_markup=kb.kb_cancel())


# ═══════════════════════════════════════════════════════════
#  GESTIÓN DE ICONOS DE JUEGOS (para mini app Francho Shop)
# ═══════════════════════════════════════════════════════════

class IconFlow(StatesGroup):
    editing_game = State()
    waiting_input = State()


@router.message(Command("iconsdiag"))
async def cmd_icons_diag(msg: Message):
    """Diagnóstico de iconos: lista archivos guardados y asociaciones DB."""
    if not await is_admin(msg.from_user.id):
        return

    import os
    icons_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "game_icons")
    exists = os.path.exists(icons_dir)

    files = []
    if exists:
        for fname in sorted(os.listdir(icons_dir)):
            fpath = os.path.join(icons_dir, fname)
            if os.path.isfile(fpath):
                size_kb = os.path.getsize(fpath) / 1024
                files.append(f"  • <code>{fname}</code> ({size_kb:.1f} KB)")

    import aiosqlite
    assocs = []
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT game_name, icon_url FROM game_icons WHERE icon_url IS NOT NULL"
        ) as c:
            for r in await c.fetchall():
                assocs.append(f"  • <b>{r['game_name']}</b>\n    → <code>{r['icon_url']}</code>")

    webapp_url = getattr(config, "WEBAPP_URL", "")
    text = (
        f"🔍 <b>Diagnóstico de iconos</b>\n━━━━━━━━━━━━━━━━━━\n\n"
        f"📁 Directorio: <code>{icons_dir}</code>\n"
        f"📂 Existe: {'✅' if exists else '❌'}\n"
        f"📦 Archivos: <b>{len(files)}</b>\n\n"
    )
    if files:
        text += "<b>Archivos:</b>\n" + "\n".join(files[:20]) + "\n\n"
    else:
        text += "⚠️ Carpeta vacía\n\n"

    text += f"<b>Asociaciones en DB:</b>\n"
    if assocs:
        text += "\n".join(assocs[:20]) + "\n\n"
    else:
        text += "⚠️ Sin asociaciones\n\n"

    if webapp_url and files:
        text += f"🌐 <b>Probar URL de ejemplo:</b>\n"
        text += f"<code>{webapp_url}/api/icons/{files[0].split('<code>')[1].split('</code>')[0]}</code>"

    # Dividir en chunks si es muy largo
    if len(text) > 4000:
        text = text[:3900] + "\n\n<i>(truncado)</i>"

    await msg.answer(text)


# ════════════════════════════════════════════════════════
#   GESTIÓN DE SMTP / GMAIL (para notificaciones por email)
# ════════════════════════════════════════════════════════

class SmtpFlow(StatesGroup):
    waiting_email = State()
    waiting_app_password = State()
    waiting_test_email = State()


# ════════════════════════════════════════════════════════
#   VINCULAR EMAIL / CONTRASEÑA WEB (para cualquier usuario)
# ════════════════════════════════════════════════════════

class EmailFlow(StatesGroup):
    waiting_email = State()
    waiting_code = State()
    waiting_password = State()


class LinkCodeFlow(StatesGroup):
    waiting_code = State()


@router.message(Command("email"))
async def cmd_email(msg: Message, state: FSMContext):
    """Vincular email a la cuenta de Telegram para acceder desde la web."""
    user_id = msg.from_user.id
    u = await db.get_user(user_id)
    current_email = u.get("email") if u else None

    if current_email and u.get("email_verified"):
        text = (
            f"📧 <b>Tu email vinculado</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n\n"
            f"📨 Email: <code>{current_email}</code>\n"
            f"✅ Verificado\n"
            f"🔑 Contraseña: {'✅ Configurada' if u.get('password_hash') else '❌ Sin configurar'}\n\n"
            f"Con este email puedes entrar a la web sin necesidad de Telegram."
        )
        rows = [
            [InlineKeyboardButton(text="📨 Cambiar email", callback_data="email_change")],
            [InlineKeyboardButton(text="🔑 Cambiar contraseña web", callback_data="email_setpwd")],
        ]
        await msg.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
    else:
        await state.set_state(EmailFlow.waiting_email)
        await msg.answer(
            "📧 <b>Vincular email</b>\n\n"
            "Envía tu email para vincularlo a tu cuenta.\n"
            "Podrás acceder a Francho Shop desde cualquier navegador.\n\n"
            "📨 Escribe tu email:"
        )


@router.message(EmailFlow.waiting_email)
async def msg_email_input(msg: Message, state: FSMContext):
    email = msg.text.strip().lower()
    if "@" not in email or "." not in email:
        await msg.answer("❌ Email inválido. Ejemplo: tu_email@gmail.com")
        return

    user_id = msg.from_user.id

    # Verificar que no esté en uso por otro usuario
    existing = await db.get_user_by_email(email)
    if existing and existing["user_id"] != user_id:
        await msg.answer("⚠️ Este email ya está vinculado a otra cuenta.")
        await state.clear()
        return

    # Guardar email temporal y enviar código
    await db.set_user_email(user_id, email, verified=False)
    code = await db.create_email_code(email, "verify", ttl_minutes=30, user_id=user_id)

    # Intentar enviar el código por email
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent / "webapp" / "api"))
        from web_auth import send_email, email_template
        sent = await send_email(
            to=email,
            subject="🔑 Código de verificación — Francho Shop",
            html_body=email_template(
                "Verifica tu email",
                f"<p>Tu código de verificación para vincular tu cuenta de Telegram es:</p>",
                code=code,
            ),
        )
    except Exception as e:
        log.warning("No se pudo enviar email: %s", e)
        sent = False

    if sent:
        await state.update_data(email=email)
        await state.set_state(EmailFlow.waiting_code)
        await msg.answer(
            f"📬 Código enviado a <code>{email}</code>\n\n"
            f"Revisa tu bandeja (y spam). Envía el código de 6 dígitos:"
        )
    else:
        # Si SMTP no está configurado, mostrar el código directo (para testing)
        await state.update_data(email=email)
        await state.set_state(EmailFlow.waiting_code)
        await msg.answer(
            f"⚠️ No se pudo enviar email (SMTP no configurado).\n\n"
            f"Tu código de verificación es: <code>{code}</code>\n\n"
            f"Envíalo aquí para confirmar:"
        )


@router.message(EmailFlow.waiting_code)
async def msg_email_code(msg: Message, state: FSMContext):
    code = msg.text.strip()
    data = await state.get_data()
    email = data.get("email", "")

    verification = await db.verify_email_code(code, email, "verify")
    if not verification:
        await msg.answer("❌ Código inválido o expirado. Intenta de nuevo con /email")
        await state.clear()
        return

    user_id = msg.from_user.id
    await db.set_user_email(user_id, email, verified=True)
    await state.set_state(EmailFlow.waiting_password)
    await msg.answer(
        f"✅ Email <code>{email}</code> verificado.\n\n"
        f"🔑 Ahora escribe una <b>contraseña</b> para poder entrar desde la web.\n"
        f"(mínimo 8 caracteres)\n\n"
        f"<i>Borraré tu mensaje después por seguridad.</i>"
    )


@router.message(EmailFlow.waiting_password)
async def msg_email_password(msg: Message, state: FSMContext):
    password = msg.text.strip()
    if len(password) < 8:
        await msg.answer("❌ Mínimo 8 caracteres.")
        return

    user_id = msg.from_user.id
    data = await state.get_data()
    email = data.get("email", "")

    # Hash y guardar
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent / "webapp" / "api"))
        from web_auth import hash_password
        pwd_hash = hash_password(password)
    except Exception:
        import hashlib, secrets as sec
        salt = sec.token_hex(16)
        h = hashlib.sha256((salt + password).encode()).hexdigest()
        pwd_hash = f"sha256${salt}${h}"

    await db.set_user_password(user_id, pwd_hash)
    await state.clear()

    # Borrar mensaje con contraseña
    with suppress(Exception):
        await msg.delete()

    await msg.answer(
        f"✅ <b>¡Todo listo!</b>\n\n"
        f"Ahora puedes entrar a Francho Shop desde cualquier navegador:\n\n"
        f"🌐 <code>https://franchoshop.reenvioplusbot.xyz</code>\n"
        f"📧 Email: <code>{email}</code>\n"
        f"🔑 Contraseña: la que acabas de escribir\n\n"
        f"Tu saldo, pedidos y todo está sincronizado entre Telegram y la web."
    )


@router.callback_query(F.data == "email_change")
async def cb_email_change(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    await state.set_state(EmailFlow.waiting_email)
    await cq.message.answer("📨 Escribe tu nuevo email:")


@router.callback_query(F.data == "email_setpwd")
async def cb_email_setpwd(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    await state.set_state(EmailFlow.waiting_password)
    await cq.message.answer(
        "🔑 Escribe tu nueva contraseña web (mínimo 8 caracteres).\n\n"
        "<i>Borraré tu mensaje después por seguridad.</i>"
    )


@router.message(Command("vincular"))
async def cmd_link_code(msg: Message, state: FSMContext):
    """Vincular cuenta web con Telegram usando un código de la web."""
    await state.set_state(LinkCodeFlow.waiting_code)
    await msg.answer(
        "🔗 <b>Vincular cuenta web</b>\n\n"
        "En tu perfil de la web (franchoshop.reenvioplusbot.xyz), "
        "toca 'Vincular Telegram' y te dará un código de 6 dígitos.\n\n"
        "Envíame ese código aquí:"
    )


@router.message(LinkCodeFlow.waiting_code)
async def msg_link_code(msg: Message, state: FSMContext):
    code = msg.text.strip()
    await state.clear()

    # Buscar código de vinculación
    import aiosqlite, time
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("""
            SELECT * FROM email_verifications
            WHERE code=? AND purpose='link_telegram' AND used=0 AND expires_at > ?
        """, (code, time.time())) as c:
            row = await c.fetchone()

    if not row:
        await msg.answer("❌ Código inválido o expirado. Genera uno nuevo desde la web.")
        return

    web_user_id = row["user_id"]
    tg_user_id = msg.from_user.id

    # Verificar que este Telegram ID no tenga ya email
    tg_user = await db.get_user(tg_user_id)
    web_user = await db.get_user(web_user_id)

    if not web_user:
        await msg.answer("❌ Usuario web no encontrado.")
        return

    web_email = web_user.get("email", "")

    # Transferir el email y password_hash al usuario de Telegram
    # y transferir el saldo del usuario web al de Telegram
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        web_balance = web_user.get("balance", 0)

        # Actualizar usuario Telegram con email y password
        await conn.execute("""
            UPDATE users SET
                email = ?, email_verified = 1,
                password_hash = ?, auth_method = 'telegram+email'
            WHERE user_id = ?
        """, (web_email, web_user.get("password_hash"), tg_user_id))

        # Transferir saldo si el web user tenía
        if web_balance > 0:
            await conn.execute(
                "UPDATE users SET balance = balance + ? WHERE user_id = ?",
                (web_balance, tg_user_id),
            )

        # Marcar usuario web como vinculado (redirigir al ID de Telegram)
        await conn.execute(
            "DELETE FROM users WHERE user_id = ?", (web_user_id,)
        )

        # Actualizar sesiones web para apuntar al user de Telegram
        await conn.execute(
            "UPDATE web_sessions SET user_id = ? WHERE user_id = ?",
            (tg_user_id, web_user_id),
        )

        # Marcar código como usado
        await conn.execute(
            "UPDATE email_verifications SET used=1 WHERE code=?", (code,)
        )
        await conn.commit()

    balance_msg = f"\n💰 Saldo transferido: ${web_balance:.2f}" if web_balance > 0 else ""
    await msg.answer(
        f"✅ <b>¡Cuentas vinculadas!</b>\n\n"
        f"📧 Email: <code>{web_email}</code>\n"
        f"📱 Telegram: @{msg.from_user.username or msg.from_user.id}\n"
        f"{balance_msg}\n\n"
        f"Ahora puedes usar la web y Telegram con la misma cuenta."
    )


@router.message(Command("smtp"))
async def cmd_smtp(msg: Message):
    """Configurar SMTP de Gmail para enviar notificaciones por email."""
    if not await is_admin(msg.from_user.id):
        return

    smtp_user = await settings.get("smtp_user") or "—"
    smtp_pass = await settings.get("smtp_password")
    has_pass = "✅ Configurada" if smtp_pass else "❌ No configurada"
    smtp_enabled = await settings.get_bool("smtp_enabled")

    text = (
        "📧 <b>Configuración SMTP (Gmail)</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"📨 Email: <code>{smtp_user}</code>\n"
        f"🔑 Password: {has_pass}\n"
        f"🔌 Estado: {'🟢 Activo' if smtp_enabled else '🔴 Inactivo'}\n\n"
        "<b>📋 ¿Cómo obtener la App Password de Gmail?</b>\n"
        "1. Activa verificación en 2 pasos en tu cuenta\n"
        "2. Ve a https://myaccount.google.com/apppasswords\n"
        "3. Crea una nueva app password (16 caracteres)\n"
        "4. Pégala aquí cuando el bot la pida\n\n"
        "<i>⚠️ La contraseña se guarda cifrada y solo se usa para envíos.</i>"
    )

    rows = [
        [InlineKeyboardButton(text="📨 Cambiar email", callback_data="smtp_email")],
        [InlineKeyboardButton(text="🔑 Cambiar App Password", callback_data="smtp_pass")],
        [InlineKeyboardButton(
            text="🔴 Desactivar SMTP" if smtp_enabled else "🟢 Activar SMTP",
            callback_data="smtp_toggle",
        )],
        [InlineKeyboardButton(text="🧪 Enviar email de prueba", callback_data="smtp_test")],
        [InlineKeyboardButton(text="🗑 Borrar configuración", callback_data="smtp_clear")],
    ]
    await msg.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(F.data == "smtp_email")
async def cb_smtp_email(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    await state.set_state(SmtpFlow.waiting_email)
    await cq.message.answer("📨 Envía tu email de Gmail (ej: <code>tu_email@gmail.com</code>):")


@router.message(SmtpFlow.waiting_email)
async def msg_smtp_email(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    email = msg.text.strip().lower()
    if "@" not in email or "." not in email:
        await msg.answer("❌ Email inválido. Ejemplo: tu_email@gmail.com")
        return
    await settings.set_value("smtp_user", email, msg.from_user.id)
    await settings.set_value("smtp_host", "smtp.gmail.com", msg.from_user.id)
    await settings.set_value("smtp_port", "587", msg.from_user.id)
    await state.clear()
    # Borrar el mensaje del usuario por seguridad
    with suppress(Exception):
        await msg.delete()
    await msg.answer(f"✅ Email guardado: <code>{email}</code>\n\nUsa /smtp para configurar la App Password.")


@router.callback_query(F.data == "smtp_pass")
async def cb_smtp_pass(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    await state.set_state(SmtpFlow.waiting_app_password)
    await cq.message.answer(
        "🔑 Envía la <b>App Password</b> de Gmail (16 caracteres, sin espacios).\n\n"
        "<i>📌 Después de enviarla, borraré tu mensaje automáticamente por seguridad.</i>"
    )


@router.message(SmtpFlow.waiting_app_password)
async def msg_smtp_pass(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    pwd = msg.text.strip().replace(" ", "")
    if len(pwd) < 12:
        await msg.answer("❌ La App Password debe tener al menos 12 caracteres.")
        return
    await settings.set_value("smtp_password", pwd, msg.from_user.id)
    await state.clear()
    # Borrar el mensaje con el password por seguridad
    with suppress(Exception):
        await msg.delete()
    await msg.answer(
        "✅ App Password guardada y mensaje borrado.\n\n"
        "Activa SMTP con /smtp y prueba enviando un email de test."
    )


@router.callback_query(F.data == "smtp_toggle")
async def cb_smtp_toggle(cq: CallbackQuery):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    current = await settings.get_bool("smtp_enabled")
    smtp_user = await settings.get("smtp_user")
    smtp_pass = await settings.get("smtp_password")
    if not current and (not smtp_user or not smtp_pass):
        await cq.message.answer("⚠️ Configura email y App Password primero.")
        return
    await settings.set_value("smtp_enabled", "0" if current else "1", cq.from_user.id)
    await cq.message.answer(f"🔌 SMTP ahora está {'🔴 INACTIVO' if current else '🟢 ACTIVO'}")


@router.callback_query(F.data == "smtp_clear")
async def cb_smtp_clear(cq: CallbackQuery):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    await settings.set_value("smtp_user", "", cq.from_user.id)
    await settings.set_value("smtp_password", "", cq.from_user.id)
    await settings.set_value("smtp_enabled", "0", cq.from_user.id)
    await cq.message.answer("🗑 Configuración SMTP borrada.")


@router.callback_query(F.data == "smtp_test")
async def cb_smtp_test(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    smtp_user = await settings.get("smtp_user")
    smtp_pass = await settings.get("smtp_password")
    if not smtp_user or not smtp_pass:
        await cq.message.answer("⚠️ Configura email + App Password primero.")
        return
    await state.set_state(SmtpFlow.waiting_test_email)
    await cq.message.answer("📧 ¿A qué email enviar el test? (puede ser el mismo de Gmail):")


@router.message(SmtpFlow.waiting_test_email)
async def msg_smtp_test(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    to_email = msg.text.strip().lower()
    await state.clear()

    smtp_user = await settings.get("smtp_user")
    smtp_pass = await settings.get("smtp_password")
    smtp_host = await settings.get("smtp_host") or "smtp.gmail.com"
    smtp_port = int(await settings.get("smtp_port") or "587")

    await msg.answer("📤 Enviando email de prueba...")

    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        message = MIMEMultipart()
        message["From"] = f"Francho Shop <{smtp_user}>"
        message["To"] = to_email
        message["Subject"] = "🛍 Francho Shop — Email de prueba"
        body = (
            "<h2>¡Configuración SMTP exitosa! 🎉</h2>"
            "<p>Si recibes este email, tu Gmail está correctamente "
            "configurado para enviar notificaciones desde Francho Shop.</p>"
            "<p>Ya puedes recibir alertas de pedidos, recuperación de contraseña "
            "y verificación de cuentas.</p>"
            "<hr><p style='color: #888; font-size: 12px;'>"
            "🛍 Francho Shop · Telegram Bot</p>"
        )
        message.attach(MIMEText(body, "html"))

        await aiosmtplib.send(
            message, hostname=smtp_host, port=smtp_port,
            username=smtp_user, password=smtp_pass,
            start_tls=True, timeout=15,
        )
        await msg.answer(f"✅ Email enviado a <code>{to_email}</code>\n\nRevisa la bandeja de entrada (y spam).")
    except ImportError:
        await msg.answer(
            "❌ Falta instalar <code>aiosmtplib</code>.\n\n"
            "En el VPS ejecuta:\n"
            "<code>pip3 install aiosmtplib --break-system-packages</code>\n\n"
            "Después reinicia el bot."
        )
    except Exception as e:
        await msg.answer(f"❌ Error enviando: <code>{type(e).__name__}: {e}</code>\n\nRevisa que la App Password sea correcta.")


@router.message(Command("icons"))
async def cmd_icons(msg: Message):
    if not await is_admin(msg.from_user.id):
        return
    # Listar todos los juegos detectados + sus overrides
    prods = await db.get_cached_products()
    games = set()
    for p in prods:
        # Usar la misma lógica que la mini app (con 'ca' field)
        game = detect_game(p)
        games.add(game)

    import aiosqlite
    overrides = {}
    async with aiosqlite.connect(config.DB_PATH) as conn:
        # Asegurar tabla
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS game_icons (
                game_name TEXT PRIMARY KEY,
                emoji TEXT, icon_url TEXT, display_name TEXT,
                sort_order INTEGER DEFAULT 100, is_hidden INTEGER DEFAULT 0,
                updated_at REAL DEFAULT (unixepoch())
            )
        """)
        await conn.commit()
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM game_icons") as c:
            for r in await c.fetchall():
                overrides[r["game_name"]] = dict(r)

    text = "🎨 <b>Gestión de iconos (Francho Shop)</b>\n\n"
    text += "<i>Toca un juego para editar emoji/icono/orden</i>\n\n"
    rows = []
    for g in sorted(games):
        ov = overrides.get(g, {})
        marker = "✏️" if g in overrides else "  "
        hidden = "🙈" if ov.get("is_hidden") else ""
        emoji = ov.get("emoji") or (g.split(" ", 1)[0] if " " in g else "🎮")
        name = ov.get("display_name") or g
        rows.append([InlineKeyboardButton(
            text=f"{marker}{hidden} {emoji} {name[:30]}",
            callback_data=f"icon:{g[:40]}",
        )])
    rows.append([InlineKeyboardButton(text="🔙 Admin", callback_data="admin_panel")])

    await msg.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(F.data.startswith("icon:"))
async def cb_icon_edit(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    game = cq.data[5:]  # quitar "icon:"
    await state.update_data(editing_game=game)

    # Obtener config actual
    import aiosqlite
    current = {}
    async with aiosqlite.connect(config.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT * FROM game_icons WHERE game_name = ?", (game,),
        ) as c:
            r = await c.fetchone()
            if r:
                current = dict(r)

    text = (
        f"🎨 <b>{game}</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"Emoji: <b>{current.get('emoji') or '—'}</b>\n"
        f"URL icono: <code>{current.get('icon_url') or '—'}</code>\n"
        f"Nombre mostrar: <b>{current.get('display_name') or '—'}</b>\n"
        f"Orden: <b>{current.get('sort_order') or 100}</b>\n"
        f"Oculto: {'🙈 Sí' if current.get('is_hidden') else '👁 No'}\n"
    )
    kb_inline = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎭 Cambiar emoji", callback_data=f"ico_e:{game}"),
         InlineKeyboardButton(text="🖼 URL icono", callback_data=f"ico_u:{game}")],
        [InlineKeyboardButton(text="📝 Nombre", callback_data=f"ico_n:{game}"),
         InlineKeyboardButton(text="🔢 Orden", callback_data=f"ico_o:{game}")],
        [InlineKeyboardButton(
            text="👁 Mostrar" if current.get("is_hidden") else "🙈 Ocultar",
            callback_data=f"ico_h:{game}")],
        [InlineKeyboardButton(text="🗑 Resetear", callback_data=f"ico_r:{game}")],
        [InlineKeyboardButton(text="🔙 Lista", callback_data="icons_back")],
    ])
    await cq.message.edit_text(text, reply_markup=kb_inline)


@router.callback_query(F.data == "icons_back")
async def cb_icons_back(cq: CallbackQuery):
    await cq.answer()
    await cmd_icons(cq.message.reply_to_message or cq.message)


@router.callback_query(F.data.startswith("ico_h:"))
async def cb_icon_toggle_hide(cq: CallbackQuery):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    game = cq.data[6:]
    import aiosqlite, time
    async with aiosqlite.connect(config.DB_PATH) as conn:
        async with conn.execute(
            "SELECT is_hidden FROM game_icons WHERE game_name = ?", (game,),
        ) as c:
            r = await c.fetchone()
            current_hidden = r[0] if r else 0
        new_val = 0 if current_hidden else 1
        await conn.execute("""
            INSERT INTO game_icons (game_name, is_hidden, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(game_name) DO UPDATE SET
                is_hidden = excluded.is_hidden, updated_at = excluded.updated_at
        """, (game, new_val, time.time()))
        await conn.commit()
    await cq.answer(f"{'🙈 Oculto' if new_val else '👁 Visible'}", show_alert=True)


@router.callback_query(F.data.startswith("ico_r:"))
async def cb_icon_reset(cq: CallbackQuery):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    game = cq.data[6:]
    import aiosqlite
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("DELETE FROM game_icons WHERE game_name = ?", (game,))
        await conn.commit()
    await cq.answer("✅ Restaurado a valores por defecto", show_alert=True)


@router.callback_query(F.data.regexp(r"^ico_[eunо]:"))
async def cb_icon_edit_field(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    if not await is_admin(cq.from_user.id):
        return
    field_code = cq.data[4]  # e, u, n, o
    game = cq.data[6:]
    await state.update_data(icon_game=game, icon_field=field_code)
    await state.set_state(IconFlow.waiting_input)

    prompts = {
        "e": "🎭 Envía el nuevo <b>emoji</b> (ej: 🔥):",
        "u": ("🖼 <b>Envía una foto</b> (como imagen normal, no documento)\n\n"
              "La imagen se guardará en el servidor y se mostrará como icono "
              "del juego en Francho Shop.\n\n"
              "<i>Recomendado: cuadrada, mín 96×96 px, formato PNG o JPG.</i>"),
        "n": "📝 Envía el nuevo <b>nombre</b> a mostrar:",
        "o": "🔢 Envía el <b>orden</b> numérico (menor = primero):",
    }
    await cq.message.edit_text(
        prompts.get(field_code, "?"),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="❌ Cancelar", callback_data=f"icon:{game}")],
        ]),
    )


@router.message(IconFlow.waiting_input, F.photo)
async def msg_icon_photo(msg: Message, state: FSMContext):
    """Recibe foto subida por el admin para usar como icono del juego."""
    if not await is_admin(msg.from_user.id):
        return
    data = await state.get_data()
    game = data.get("icon_game")
    field = data.get("icon_field")

    if field != "u":
        await msg.answer("⚠️ No esperaba una foto. Si querías cambiar otro campo, escribe el texto.")
        return

    # Descargar la foto (mejor calidad)
    photo = msg.photo[-1]
    file = await bot.get_file(photo.file_id)

    # Crear directorio si no existe
    import os
    icons_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "game_icons")
    os.makedirs(icons_dir, exist_ok=True)

    # Nombre seguro: hash del game_name + extensión
    import hashlib
    safe_name = hashlib.md5(game.encode()).hexdigest()[:12]
    filename = f"{safe_name}.jpg"
    filepath = os.path.join(icons_dir, filename)

    await bot.download_file(file.file_path, filepath)

    # URL pública relativa que la web servirá
    icon_url = f"/api/icons/{filename}"
    full_url = f"{getattr(config, 'WEBAPP_URL', '')}{icon_url}"

    import aiosqlite, time
    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute("""
            INSERT INTO game_icons (game_name, icon_url, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(game_name) DO UPDATE SET
                icon_url = excluded.icon_url, updated_at = excluded.updated_at
        """, (game, icon_url, time.time()))
        await conn.commit()

    # Verificar tamaño del archivo guardado
    file_size_kb = os.path.getsize(filepath) / 1024

    await state.clear()
    await msg.answer(
        f"✅ <b>Icono actualizado</b>\n\n"
        f"🎮 Juego: <b>{game}</b>\n"
        f"📁 Archivo: <code>{filename}</code>\n"
        f"📦 Tamaño: {file_size_kb:.1f} KB\n"
        f"🌐 URL pública:\n<code>{full_url}</code>\n\n"
        f"<i>Abre la mini app para verlo (puede tardar unos segundos por el caché del navegador).</i>",
    )
    await cmd_icons(msg)


@router.message(IconFlow.waiting_input)
async def msg_icon_input(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    data = await state.get_data()
    game = data.get("icon_game")
    field = data.get("icon_field")

    if field == "u":
        await msg.answer(
            "⚠️ Para el icono, envía una <b>foto</b> (no texto).\n"
            "Toca el clip 📎 → Galería → selecciona imagen."
        )
        return

    value = msg.text.strip() if msg.text else ""
    import aiosqlite, time
    col_map = {"e": "emoji", "n": "display_name", "o": "sort_order"}
    col = col_map.get(field)
    if not col:
        await state.clear()
        return

    if col == "sort_order":
        try:
            value = int(value)
        except ValueError:
            await msg.answer("❌ Debe ser un número")
            return

    async with aiosqlite.connect(config.DB_PATH) as conn:
        await conn.execute(f"""
            INSERT INTO game_icons (game_name, {col}, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(game_name) DO UPDATE SET
                {col} = excluded.{col}, updated_at = excluded.updated_at
        """, (game, value, time.time()))
        await conn.commit()

    await state.clear()
    await msg.answer(f"✅ <b>{col}</b> actualizado para {game}")
    await cmd_icons(msg)


# ───────────── DASHBOARD ─────────────

@router.callback_query(F.data == "adm_dashboard")
async def cb_adm_dashboard(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return

    stats_all = await db.get_order_stats()
    stats_1d = await db.get_order_stats(days=1)
    stats_7d = await db.get_order_stats(days=7)
    stats_30d = await db.get_order_stats(days=30)

    stats_user = await db.get_order_stats(role="user")
    stats_reseller = await db.get_order_stats(role="reseller")

    top_products = await db.get_top_products(limit=5, days=7)

    text = (
        "📊 <b>Dashboard</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"💰 <b>Ingresos por periodo</b>\n"
        f"• Hoy: ${stats_1d['revenue']:.2f}  ({stats_1d['total']} órdenes)\n"
        f"• 7 días: ${stats_7d['revenue']:.2f}  ({stats_7d['total']})\n"
        f"• 30 días: ${stats_30d['revenue']:.2f}  ({stats_30d['total']})\n"
        f"• Total: ${stats_all['revenue']:.2f}  ({stats_all['total']})\n\n"
        f"💎 <b>Ganancias (profit)</b>\n"
        f"• Hoy: ${stats_1d['profit']:.2f}\n"
        f"• 7 días: ${stats_7d['profit']:.2f}\n"
        f"• Total: ${stats_all['profit']:.2f}\n\n"
        f"📊 <b>Por tipo de cliente</b>\n"
        f"• 🛒 Clientes: {stats_user['total']} órdenes, ${stats_user['revenue']:.2f}\n"
        f"• 💼 Revendedores: {stats_reseller['total']} órdenes, ${stats_reseller['revenue']:.2f}\n\n"
    )

    if top_products:
        text += "🔥 <b>Top 5 productos (7d)</b>\n"
        for i, p in enumerate(top_products, 1):
            text += f"{i}. {p['product_name']} — {p['sales']} ventas\n"

    await cq.message.edit_text(text, reply_markup=back_kb("admin_panel"))
    await cq.answer()


# ───────────── CONFIG (markups en caliente) ─────────────

@router.callback_query(F.data == "adm_config")
async def cb_adm_config(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return

    retail = await settings.get_float("retail_markup")
    reseller = await settings.get_float("reseller_markup")
    min_dep = await settings.get_float("min_deposit")
    min_wd = await settings.get_float("min_withdrawal")
    maint = await settings.get_bool("maintenance_mode")
    apps_open = await settings.get_bool("reseller_applications_open")
    support = await settings.get("support_handle")

    text = (
        "⚙️ <b>Configuración</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"💰 <b>Precios (en caliente)</b>\n"
        f"• Retail markup: <b>{retail}%</b>\n"
        f"• Reseller markup: <b>{reseller}%</b>\n\n"
        f"💵 <b>Límites</b>\n"
        f"• Mín. depósito: ${min_dep:.2f}\n"
        f"• Mín. retiro: ${min_wd:.2f}\n\n"
        f"🎛 <b>Modos</b>\n"
        f"• Mantenimiento: {'🔴 ON' if maint else '🟢 OFF'}\n"
        f"• Solicitudes revendedor: {'🟢 Abiertas' if apps_open else '🔴 Cerradas'}\n\n"
        f"📞 Soporte: {support}\n\n"
        f"<i>Los cambios se aplican inmediatamente.</i>"
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💰 Retail markup", callback_data="cfg:retail"),
         InlineKeyboardButton(text="💎 Reseller markup", callback_data="cfg:reseller")],
        [InlineKeyboardButton(text="📥 Mín depósito", callback_data="cfg:mindep"),
         InlineKeyboardButton(text="📤 Mín retiro", callback_data="cfg:minwd")],
        [InlineKeyboardButton(text="💬 Bienvenida", callback_data="cfg:welcome"),
         InlineKeyboardButton(text="📞 Soporte", callback_data="cfg:support")],
        [InlineKeyboardButton(
            text=f"🛠 Mantenimiento: {'ON' if maint else 'OFF'}",
            callback_data="cfg:maint_toggle")],
        [InlineKeyboardButton(
            text=f"💼 Solicitudes: {'Abiertas' if apps_open else 'Cerradas'}",
            callback_data="cfg:apps_toggle")],
        [InlineKeyboardButton(text="🔙 Admin", callback_data="admin_panel")],
    ])

    await cq.message.edit_text(text, reply_markup=kb)
    await cq.answer()


@router.callback_query(F.data.startswith("cfg:"))
async def cb_cfg_action(cq: CallbackQuery, state: FSMContext):
    if not await is_admin(cq.from_user.id):
        return
    action = cq.data.split(":")[1]

    # Toggles
    if action == "maint_toggle":
        current = await settings.get_bool("maintenance_mode")
        await settings.set_value("maintenance_mode", "0" if current else "1", cq.from_user.id)
        await db.audit(cq.from_user.id, "toggle_maintenance", "setting", "maintenance_mode",
                       f"{'OFF' if current else 'ON'}")
        await cq.answer(f"🛠 Mantenimiento: {'OFF' if current else 'ON'}")
        await cb_adm_config(cq)
        return

    if action == "apps_toggle":
        current = await settings.get_bool("reseller_applications_open")
        await settings.set_value("reseller_applications_open", "0" if current else "1", cq.from_user.id)
        await db.audit(cq.from_user.id, "toggle_apps", "setting", "reseller_applications_open",
                       f"{'closed' if current else 'open'}")
        await cq.answer("✅ Actualizado")
        await cb_adm_config(cq)
        return

    # Text inputs
    prompts = {
        "retail": ("💰 Nuevo retail markup % (ej: 20):", AdminFlow.edit_retail_markup),
        "reseller": ("💎 Nuevo reseller markup % (ej: 8):", AdminFlow.edit_reseller_markup),
        "mindep": ("📥 Nuevo mínimo de depósito USDT:", AdminFlow.edit_min_deposit),
        "minwd": ("📤 Nuevo mínimo de retiro USDT:", AdminFlow.edit_min_withdrawal),
        "welcome": ("💬 Nuevo mensaje de bienvenida (HTML permitido):", AdminFlow.edit_welcome_msg),
        "support": ("📞 Nuevo @username de soporte:", AdminFlow.edit_support),
    }
    prompt, fsm = prompts.get(action, (None, None))
    if not fsm:
        await cq.answer("?", show_alert=True)
        return

    await state.set_state(fsm)
    await cq.message.edit_text(
        prompt,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="❌ Cancelar", callback_data="adm_config")],
        ]),
    )
    await cq.answer()


@router.message(AdminFlow.edit_retail_markup)
@router.message(AdminFlow.edit_reseller_markup)
@router.message(AdminFlow.edit_min_deposit)
@router.message(AdminFlow.edit_min_withdrawal)
async def msg_admin_numeric(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    current_state = await state.get_state()

    try:
        val = float(msg.text.strip().replace(",", ".").replace("%", ""))
    except ValueError:
        await msg.answer("❌ Número inválido")
        return

    key_map = {
        AdminFlow.edit_retail_markup.state: ("retail_markup", "Retail markup", 0, 500),
        AdminFlow.edit_reseller_markup.state: ("reseller_markup", "Reseller markup", 0, 500),
        AdminFlow.edit_min_deposit.state: ("min_deposit", "Mín depósito", 0.1, 10000),
        AdminFlow.edit_min_withdrawal.state: ("min_withdrawal", "Mín retiro", 0.1, 10000),
    }
    key, label, mn, mx = key_map[current_state]
    if not (mn <= val <= mx):
        await msg.answer(f"❌ Fuera de rango ({mn}-{mx})")
        return

    await settings.set_value(key, str(val), msg.from_user.id)
    await db.audit(msg.from_user.id, "update_setting", "setting", key, f"= {val}")
    await state.clear()
    await msg.answer(
        f"✅ <b>{label}</b> actualizado a <b>{val}</b>",
        reply_markup=back_kb("adm_config"),
    )


@router.message(AdminFlow.edit_welcome_msg)
async def msg_edit_welcome(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    new = msg.html_text if msg.entities else msg.text
    if len(new) > 2000:
        await msg.answer("❌ Máximo 2000 caracteres")
        return
    await settings.set_value("welcome_message", new, msg.from_user.id)
    await db.audit(msg.from_user.id, "update_welcome", "setting", "welcome_message", "")
    await state.clear()
    await msg.answer("✅ Bienvenida actualizada", reply_markup=back_kb("adm_config"))


@router.message(AdminFlow.edit_support)
async def msg_edit_support(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    val = msg.text.strip()
    if not val.startswith("@"):
        val = "@" + val
    await settings.set_value("support_handle", val, msg.from_user.id)
    await state.clear()
    await msg.answer(f"✅ Soporte: {val}", reply_markup=back_kb("adm_config"))


# ───────────── USUARIOS ─────────────

@router.callback_query(F.data == "adm_users")
async def cb_adm_users(cq: CallbackQuery, state: FSMContext):
    if not await is_admin(cq.from_user.id):
        return

    counts = await db.count_users_by_role()
    text = (
        "👥 <b>Gestión de Usuarios</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"🛒 Clientes: {counts.get('user', 0)}\n"
        f"💼 Revendedores: {counts.get('reseller', 0)}\n"
        f"👑 Admins: {counts.get('admin', 0)}\n"
        f"🚫 Baneados: {counts.get('banned', 0)}\n"
        f"📊 <b>Total: {counts.get('total', 0)}</b>"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔍 Buscar usuario", callback_data="usr_search")],
        [InlineKeyboardButton(text="🔙 Admin", callback_data="admin_panel")],
    ])
    await cq.message.edit_text(text, reply_markup=kb)
    await cq.answer()


@router.callback_query(F.data == "usr_search")
async def cb_usr_search(cq: CallbackQuery, state: FSMContext):
    await cq.answer()
    await state.set_state(AdminFlow.search_user)
    await cq.message.edit_text(
        "🔍 <b>Buscar usuario</b>\n\n"
        "Escribe:\n"
        "• ID numérico\n"
        "• @username\n"
        "• Nombre",
        reply_markup=back_kb("adm_users"),
    )
    await cq.answer()


@router.message(AdminFlow.search_user)
async def msg_usr_search(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    q = msg.text.strip().lstrip("@")
    results = await db.search_users(q, limit=10)
    await state.clear()

    if not results:
        await msg.answer("😕 Sin resultados", reply_markup=back_kb("adm_users"))
        return

    rows = []
    for u in results:
        uname = f"@{u['username']}" if u.get("username") else (u.get("first_name") or f"ID:{u['user_id']}")
        role_emoji = "👑" if u["role"] == "admin" else "💼" if u["role"] == "reseller" else "🛒"
        ban_emoji = "🚫" if u.get("is_banned") else ""
        rows.append([InlineKeyboardButton(
            text=f"{role_emoji}{ban_emoji} {uname}  •  ${u['balance']:.2f}",
            callback_data=f"usr:{u['user_id']}",
        )])
    rows.append([InlineKeyboardButton(text="🔙", callback_data="adm_users")])

    await msg.answer(
        f"🔍 <b>{len(results)} resultados</b>",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


@router.callback_query(F.data.startswith("usr:"))
async def cb_user_detail(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    user_id = int(cq.data.split(":")[1])
    u = await db.get_user(user_id)
    if not u:
        await cq.answer("No existe", show_alert=True)
        return

    uname = f"@{u['username']}" if u.get("username") else "—"
    created = time.strftime("%d/%m/%Y", time.localtime(u.get("created_at", 0)))
    last_seen = time.strftime("%d/%m %H:%M", time.localtime(u.get("last_seen", 0)))

    text = (
        f"👤 <b>{u.get('first_name', '?')}</b>  {uname}\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🆔 <code>{user_id}</code>\n"
        f"🎭 Rol: {ROLE_LABELS.get(u['role'], u['role'])}\n"
        f"💰 Saldo: <b>${u['balance']:.2f}</b>\n"
        f"📥 Total depositado: ${u['total_deposit']:.2f}\n"
        f"💸 Total gastado: ${u['total_spent']:.2f}\n"
        f"📅 Registro: {created}\n"
        f"🕐 Última vez: {last_seen}\n"
    )
    if u.get("is_banned"):
        text += f"🚫 <b>BANEADO:</b> {u.get('ban_reason', '—')}\n"

    rows = [
        [InlineKeyboardButton(text="💰 Ajustar saldo", callback_data=f"usr_bal:{user_id}"),
         InlineKeyboardButton(text="📋 Sus órdenes", callback_data=f"usr_ord:{user_id}")],
    ]
    if u["role"] == "user":
        rows.append([InlineKeyboardButton(text="💼 Hacer revendedor", callback_data=f"usr_mkres:{user_id}")])
    elif u["role"] == "reseller":
        rows.append([InlineKeyboardButton(text="🛒 Quitar revendedor", callback_data=f"usr_unres:{user_id}")])

    if u.get("is_banned"):
        rows.append([InlineKeyboardButton(text="✅ Desbanear", callback_data=f"usr_unban:{user_id}")])
    else:
        rows.append([InlineKeyboardButton(text="🚫 Banear", callback_data=f"usr_ban:{user_id}")])

    rows.append([InlineKeyboardButton(text="🔙 Usuarios", callback_data="adm_users")])

    await cq.message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
    await cq.answer()


@router.callback_query(F.data.startswith("usr_bal:"))
async def cb_user_adjust_balance(cq: CallbackQuery, state: FSMContext):
    if not await is_admin(cq.from_user.id):
        return
    uid = int(cq.data.split(":")[1])
    await state.update_data(target_user_id=uid)
    await state.set_state(AdminFlow.adjust_balance)
    await cq.message.edit_text(
        f"💰 <b>Ajustar saldo de usuario {uid}</b>\n\n"
        f"Escribe el monto:\n"
        f"• <code>10</code> → añade $10\n"
        f"• <code>-5</code> → resta $5\n\n"
        f"<i>Opcional: añade una nota después del número.</i>\n"
        f"Ej: <code>10 compensación</code>",
        reply_markup=back_kb(f"usr:{uid}"),
    )
    await cq.answer()


@router.message(AdminFlow.adjust_balance)
async def msg_adjust_balance(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    data = await state.get_data()
    uid = data.get("target_user_id")

    parts = msg.text.strip().split(maxsplit=1)
    try:
        amt = float(parts[0].replace(",", "."))
    except ValueError:
        await msg.answer("❌ Monto inválido")
        return

    note = parts[1] if len(parts) > 1 else "Ajuste manual admin"
    await db.adjust_balance_admin(uid, amt, msg.from_user.id, note)
    await db.audit(msg.from_user.id, "adjust_balance", "user", str(uid), f"{amt:+.2f}: {note}")
    await state.clear()

    new_bal = await db.get_balance(uid)
    sign = "+" if amt >= 0 else ""
    await msg.answer(
        f"✅ Saldo ajustado: {sign}${amt:.2f}\n"
        f"📊 Nuevo saldo: ${new_bal:.2f}",
        reply_markup=back_kb(f"usr:{uid}"),
    )

    # Notificar al usuario
    with suppress(Exception):
        await bot.send_message(
            uid,
            f"💰 <b>Ajuste de saldo por admin</b>\n\n"
            f"{'+' if amt >= 0 else ''}${amt:.2f}\n"
            f"📝 {note}\n"
            f"📊 Saldo: ${new_bal:.2f}",
        )


@router.callback_query(F.data.startswith("usr_mkres:"))
async def cb_user_make_reseller(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    uid = int(cq.data.split(":")[1])
    await db.set_user_role(uid, "reseller")
    await db.audit(cq.from_user.id, "promote_reseller", "user", str(uid))
    with suppress(Exception):
        reseller_mk = await settings.get_float("reseller_markup")
        await bot.send_message(
            uid,
            f"🎉 <b>¡Ahora eres Revendedor!</b>\n\n"
            f"💎 Precio especial: costo + {reseller_mk}%\n"
            f"Ya puedes comprar con descuento.",
        )
    await cq.answer("✅ Promovido a revendedor")
    await cb_user_detail(cq)


@router.callback_query(F.data.startswith("usr_unres:"))
async def cb_user_unmake_reseller(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    uid = int(cq.data.split(":")[1])
    await db.set_user_role(uid, "user")
    await db.audit(cq.from_user.id, "demote_reseller", "user", str(uid))
    await cq.answer("✅ Rol quitado")
    await cb_user_detail(cq)


@router.callback_query(F.data.startswith("usr_ban:"))
async def cb_user_ban(cq: CallbackQuery, state: FSMContext):
    if not await is_admin(cq.from_user.id):
        return
    uid = int(cq.data.split(":")[1])
    await state.update_data(ban_user_id=uid)
    await state.set_state(AdminFlow.ban_user_reason)
    await cq.message.edit_text(
        f"🚫 <b>Banear usuario {uid}</b>\n\nEscribe la razón:",
        reply_markup=back_kb(f"usr:{uid}"),
    )
    await cq.answer()


@router.message(AdminFlow.ban_user_reason)
async def msg_ban_reason(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    data = await state.get_data()
    uid = data.get("ban_user_id")
    reason = msg.text.strip()[:200]
    await db.ban_user(uid, reason)
    await db.audit(msg.from_user.id, "ban", "user", str(uid), reason)
    await state.clear()
    await msg.answer(f"🚫 Usuario {uid} baneado", reply_markup=back_kb(f"usr:{uid}"))


@router.callback_query(F.data.startswith("usr_unban:"))
async def cb_user_unban(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    uid = int(cq.data.split(":")[1])
    await db.unban_user(uid)
    await db.audit(cq.from_user.id, "unban", "user", str(uid))
    await cq.answer("✅ Desbaneado")
    await cb_user_detail(cq)


@router.callback_query(F.data.startswith("usr_ord:"))
async def cb_user_orders(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    uid = int(cq.data.split(":")[1])
    orders = await db.get_user_orders(uid, 10)
    if not orders:
        await cq.message.edit_text("📭 Sin órdenes", reply_markup=back_kb(f"usr:{uid}"))
    else:
        text = f"📋 <b>Órdenes de {uid}</b>\n\n"
        for o in orders:
            text += format_order_short(o) + "\n\n"
        await cq.message.edit_text(text, reply_markup=back_kb(f"usr:{uid}"))
    await cq.answer()


# ───────────── SOLICITUDES REVENDEDOR ─────────────

@router.callback_query(F.data == "adm_applications")
async def cb_adm_apps(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    apps = await db.get_pending_applications()
    if not apps:
        await cq.message.edit_text(
            "✅ No hay solicitudes pendientes",
            reply_markup=back_kb("admin_panel"),
        )
        await cq.answer()
        return

    text = f"💼 <b>Solicitudes pendientes: {len(apps)}</b>\n\n"
    rows = []
    for a in apps[:10]:
        uname = f"@{a['username']}" if a.get("username") else a.get("first_name", f"ID:{a['user_id']}")
        ts = time.strftime("%d/%m", time.localtime(a["created_at"]))
        rows.append([InlineKeyboardButton(
            text=f"#{a['id']} · {uname} · {ts}",
            callback_data=f"app_view:{a['id']}",
        )])
    rows.append([InlineKeyboardButton(text="🔙 Admin", callback_data="admin_panel")])
    await cq.message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
    await cq.answer()


@router.callback_query(F.data.startswith("app_view:"))
async def cb_app_view(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    aid = int(cq.data.split(":")[1])
    app_ = await db.get_application(aid)
    if not app_:
        await cq.answer("No existe", show_alert=True)
        return

    user = await db.get_user(app_["user_id"])
    uname = f"@{user['username']}" if user and user.get("username") else f"ID:{app_['user_id']}"

    text = (
        f"💼 <b>Solicitud #{aid}</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"👤 {uname}\n"
        f"📥 Depositado: ${user.get('total_deposit', 0):.2f}\n"
        f"💸 Gastado: ${user.get('total_spent', 0):.2f}\n"
        f"📅 Registro: {time.strftime('%d/%m/%Y', time.localtime(user.get('created_at', 0)))}\n\n"
        f"📝 <b>Descripción:</b>\n{app_['business_desc']}"
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Aprobar", callback_data=f"app_ok:{aid}"),
         InlineKeyboardButton(text="❌ Rechazar", callback_data=f"app_no:{aid}")],
        [InlineKeyboardButton(text="🔙 Solicitudes", callback_data="adm_applications")],
    ])
    await cq.message.edit_text(text, reply_markup=kb)
    await cq.answer()


@router.callback_query(F.data.startswith("app_ok:"))
async def cb_app_approve(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    aid = int(cq.data.split(":")[1])
    app_ = await db.get_application(aid)
    if not app_ or app_["status"] != "pending":
        await cq.answer("Ya procesada", show_alert=True)
        return

    await db.review_application(aid, "approved", cq.from_user.id)
    await db.set_user_role(app_["user_id"], "reseller")
    await db.audit(cq.from_user.id, "approve_application", "application", str(aid))

    reseller_mk = await settings.get_float("reseller_markup")
    with suppress(Exception):
        await bot.send_message(
            app_["user_id"],
            f"🎉 <b>¡Tu solicitud fue APROBADA!</b>\n\n"
            f"💼 Ahora eres <b>Revendedor</b>\n"
            f"💎 Precio especial: costo + {reseller_mk}%\n\n"
            f"Usa /start para ver tu nuevo panel.",
        )
    await cq.answer("✅ Aprobado")
    await cb_adm_apps(cq)


@router.callback_query(F.data.startswith("app_no:"))
async def cb_app_reject(cq: CallbackQuery, state: FSMContext):
    if not await is_admin(cq.from_user.id):
        return
    aid = int(cq.data.split(":")[1])
    await state.update_data(reject_app_id=aid)
    await state.set_state(AdminFlow.reject_application_reason)
    await cq.message.edit_text(
        f"❌ <b>Rechazar solicitud #{aid}</b>\n\nEscribe la razón:",
        reply_markup=back_kb("adm_applications"),
    )
    await cq.answer()


@router.message(AdminFlow.reject_application_reason)
async def msg_reject_reason(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    data = await state.get_data()
    aid = data.get("reject_app_id")
    reason = msg.text.strip()[:500]

    app_ = await db.get_application(aid)
    if not app_:
        return

    await db.review_application(aid, "rejected", msg.from_user.id, reason)
    await db.audit(msg.from_user.id, "reject_application", "application", str(aid), reason)
    await state.clear()

    with suppress(Exception):
        await bot.send_message(
            app_["user_id"],
            f"❌ <b>Tu solicitud de revendedor fue rechazada</b>\n\n"
            f"📝 Razón: {reason}\n\n"
            f"Puedes intentarlo de nuevo más adelante.",
        )
    await msg.answer("✅ Rechazada", reply_markup=back_kb("adm_applications"))


# ───────────── PRODUCTOS (admin) ─────────────

@router.callback_query(F.data == "adm_products")
async def cb_adm_products(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    total = len(await db.get_cached_products(include_hidden=True))
    visible = len(await db.get_cached_products(include_hidden=False))
    text = (
        "🛒 <b>Gestión de productos</b>\n\n"
        f"📦 Total: {total}\n"
        f"👁 Visibles: {visible}\n"
        f"🙈 Ocultos: {total - visible}\n"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Refrescar desde BuffPin", callback_data="prod_refresh")],
        [InlineKeyboardButton(text="🔍 Buscar producto", callback_data="prod_search")],
        [InlineKeyboardButton(text="🔙 Admin", callback_data="admin_panel")],
    ])
    await cq.message.edit_text(text, reply_markup=kb)
    await cq.answer()


@router.callback_query(F.data == "prod_refresh")
async def cb_prod_refresh(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    await cq.answer("🔄 Actualizando...")
    await refresh_products()
    n = len(await db.get_cached_products(include_hidden=True))
    await db.audit(cq.from_user.id, "refresh_products", "products", "all", f"{n} items")
    await cq.message.edit_text(f"✅ {n} productos actualizados", reply_markup=back_kb("adm_products"))


@router.callback_query(F.data == "prod_search")
async def cb_prod_search(cq: CallbackQuery, state: FSMContext):
    if not await is_admin(cq.from_user.id):
        return
    await state.set_state(AdminFlow.search_product)
    await cq.message.edit_text(
        "🔍 Escribe el nombre a buscar:",
        reply_markup=back_kb("adm_products"),
    )
    await cq.answer()


@router.message(AdminFlow.search_product)
async def msg_prod_search(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    q = msg.text.strip()
    results = await db.get_cached_products(search=q, include_hidden=True)
    await state.clear()
    if not results:
        await msg.answer("😕 Sin resultados", reply_markup=back_kb("adm_products"))
        return
    rows = []
    for p in results[:15]:
        hidden = "🙈" if p.get("is_hidden") else "👁"
        featured = "⭐" if p.get("is_featured") else ""
        rows.append([InlineKeyboardButton(
            text=f"{hidden}{featured} {p['goods_name']} (${p['pay_price']:.2f})",
            callback_data=f"pcfg:{p['id']}",
        )])
    rows.append([InlineKeyboardButton(text="🔙", callback_data="adm_products")])
    await msg.answer(
        f"🔍 {len(results)} resultados",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


@router.callback_query(F.data.startswith("pcfg:"))
async def cb_prod_config(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    pid = int(cq.data.split(":")[1])
    p = await db.get_cached_product(pid)
    if not p:
        await cq.answer("No existe", show_alert=True)
        return

    retail_mk = await settings.get_float("retail_markup")
    reseller_mk = await settings.get_float("reseller_markup")
    retail_price = round(p["pay_price"] * (1 + retail_mk / 100), 2)
    reseller_price = round(p["pay_price"] * (1 + reseller_mk / 100), 2)

    text = (
        f"🛒 <b>{p['goods_name']}</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🆔 ID: {pid}\n"
        f"💰 Costo BuffPin: ${p['pay_price']:.2f}\n"
        f"🛒 Precio retail: ${retail_price:.2f}\n"
        f"💼 Precio revendedor: ${reseller_price:.2f}\n"
    )
    if p.get("custom_price"):
        text += f"⚠️ Precio custom: ${p['custom_price']:.2f}\n"
    text += f"\n👁 Visible: {'No' if p.get('is_hidden') else 'Sí'}\n"
    text += f"⭐ Destacado: {'Sí' if p.get('is_featured') else 'No'}\n"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🙈 Ocultar" if not p.get("is_hidden") else "👁 Mostrar",
            callback_data=f"ptog:hide:{pid}")],
        [InlineKeyboardButton(
            text="⭐ Destacar" if not p.get("is_featured") else "❌ Quitar destaque",
            callback_data=f"ptog:feat:{pid}")],
        [InlineKeyboardButton(text="💰 Precio custom", callback_data=f"pprice:{pid}")],
        [InlineKeyboardButton(text="🔙 Productos", callback_data="adm_products")],
    ])
    await cq.message.edit_text(text, reply_markup=kb)
    await cq.answer()


@router.callback_query(F.data.startswith("ptog:"))
async def cb_prod_toggle(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    _, kind, pid = cq.data.split(":")
    pid = int(pid)
    p = await db.get_cached_product(pid)
    if kind == "hide":
        new = 0 if p.get("is_hidden") else 1
        await db.set_product_override(pid, is_hidden=new)
        await db.audit(cq.from_user.id, "toggle_hide", "product", str(pid), str(new))
    elif kind == "feat":
        new = 0 if p.get("is_featured") else 1
        await db.set_product_override(pid, is_featured=new)
        await db.audit(cq.from_user.id, "toggle_feature", "product", str(pid), str(new))
    await cq.answer("✅")
    await cb_prod_config(cq)


# ───────────── ÓRDENES (admin) ─────────────

@router.callback_query(F.data == "adm_orders")
async def cb_adm_orders(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    orders = await db.get_recent_orders(15)
    if not orders:
        await cq.message.edit_text("📭 Sin órdenes", reply_markup=back_kb("admin_panel"))
    else:
        text = "📦 <b>Últimas 15 órdenes</b>\n\n"
        for o in orders:
            user = await db.get_user(o["user_id"])
            uname = f"@{user['username']}" if user and user.get("username") else f"ID:{o['user_id']}"
            role_em = "💼" if o.get("user_role") == "reseller" else "🛒"
            text += f"{role_em} {uname}\n{format_order_short(o)}\n\n"
        await cq.message.edit_text(text, reply_markup=back_kb("admin_panel"))
    await cq.answer()


# ───────────── DEPÓSITOS (admin) ─────────────

@router.callback_query(F.data == "adm_deposits")
async def cb_adm_deposits(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    deps = await db.get_recent_deposits(15)
    if not deps:
        await cq.message.edit_text("📭 Sin depósitos", reply_markup=back_kb("admin_panel"))
        await cq.answer()
        return

    text = "💰 <b>Últimos 15 depósitos</b>\n\n"
    emojis = {"pending": "⏳", "Paying": "🔄", "paid": "✅", "expired": "⌛", "failed": "❌"}
    for d in deps:
        user = await db.get_user(d["user_id"])
        uname = f"@{user['username']}" if user and user.get("username") else f"ID:{d['user_id']}"
        em = emojis.get(d["status"], "❓")
        ts = time.strftime("%d/%m %H:%M", time.localtime(d["created_at"]))
        text += f"{em} {uname} — ${d['amount_usd']:.2f} — {d['status']} — {ts}\n"

    await cq.message.edit_text(text, reply_markup=back_kb("admin_panel"))
    await cq.answer()


# ───────────── BROADCAST ─────────────

@router.callback_query(F.data == "adm_broadcast")
async def cb_adm_broadcast(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    counts = await db.count_users_by_role()
    text = (
        "📢 <b>Broadcast</b>\n\n"
        f"Selecciona audiencia:\n\n"
        f"• 🛒 Clientes: {counts.get('user', 0)}\n"
        f"• 💼 Revendedores: {counts.get('reseller', 0)}\n"
        f"• 📊 Todos: {counts.get('total', 0)}\n"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📢 A todos", callback_data="bc:all")],
        [InlineKeyboardButton(text="🛒 Solo clientes", callback_data="bc:user")],
        [InlineKeyboardButton(text="💼 Solo revendedores", callback_data="bc:reseller")],
        [InlineKeyboardButton(text="🔙 Admin", callback_data="admin_panel")],
    ])
    await cq.message.edit_text(text, reply_markup=kb)
    await cq.answer()


@router.callback_query(F.data.startswith("bc:"))
async def cb_broadcast_target(cq: CallbackQuery, state: FSMContext):
    if not await is_admin(cq.from_user.id):
        return
    target = cq.data.split(":")[1]
    await state.update_data(broadcast_target=target)
    await state.set_state(AdminFlow.broadcast_text)
    await cq.message.edit_text(
        f"📢 <b>Broadcast → {target}</b>\n\n"
        f"Escribe el mensaje (HTML permitido):",
        reply_markup=back_kb("adm_broadcast"),
    )
    await cq.answer()


@router.message(AdminFlow.broadcast_text)
async def msg_broadcast_send(msg: Message, state: FSMContext):
    if not await is_admin(msg.from_user.id):
        return
    data = await state.get_data()
    target = data.get("broadcast_target", "all")
    text_to_send = msg.html_text if msg.entities else msg.text
    await state.clear()

    role = None if target == "all" else target
    user_ids = await db.get_all_user_ids(role=role)

    await msg.answer(f"📤 Enviando a {len(user_ids)} usuarios...")

    sent, failed = 0, 0
    for uid in user_ids:
        try:
            await bot.send_message(uid, text_to_send)
            sent += 1
            await asyncio.sleep(0.05)  # Rate limit
        except Exception:
            failed += 1

    await db.audit(msg.from_user.id, "broadcast", "broadcast", target, f"sent={sent} failed={failed}")
    await msg.answer(
        f"✅ Broadcast completado\n\n"
        f"📤 Enviados: {sent}\n"
        f"❌ Fallidos: {failed}",
        reply_markup=back_kb("admin_panel"),
    )


# ───────────── AUDIT LOG ─────────────

@router.callback_query(F.data == "adm_audit")
async def cb_adm_audit(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    logs = await db.get_recent_audit(15)
    if not logs:
        await cq.message.edit_text("📭 Sin registros", reply_markup=back_kb("admin_panel"))
        await cq.answer()
        return
    text = "📋 <b>Audit log (últimas 15)</b>\n\n"
    for l in logs:
        ts = time.strftime("%d/%m %H:%M", time.localtime(l["created_at"]))
        text += f"🕐 {ts} — <code>{l['admin_id']}</code>\n"
        text += f"   {l['action']} {l.get('target_type', '')}/{l.get('target_id', '')}\n"
        if l.get("details"):
            text += f"   <i>{l['details'][:60]}</i>\n"
        text += "\n"
    await cq.message.edit_text(text, reply_markup=back_kb("admin_panel"))
    await cq.answer()


# ───────────── CUPONES (admin) ─────────────

@router.callback_query(F.data == "adm_coupons")
async def cb_adm_coupons(cq: CallbackQuery):
    if not await is_admin(cq.from_user.id):
        return
    await cq.message.edit_text(
        "🎟 <b>Gestión de cupones</b>\n\n"
        "<i>Función completa en próximo entregable (Fase 2).\n"
        "La tabla ya está preparada.</i>",
        reply_markup=back_kb("admin_panel"),
    )
    await cq.answer()


# ══════════════════════════════════════════════════════════════════
#  MENSAJES DE TEXTO GENÉRICOS (búsqueda)
# ══════════════════════════════════════════════════════════════════

@router.message(F.text)
async def msg_text_fallback(msg: Message, state: FSMContext):
    current = await state.get_state()
    if current == "searching":
        await handle_search(msg, state)


@router.callback_query(F.data == "noop")
async def cb_noop(cq: CallbackQuery):
    await cq.answer()


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 11: WEBHOOKS
# ══════════════════════════════════════════════════════════════════

async def oxapay_webhook(request: web.Request) -> web.Response:
    try:
        raw = await request.read()
        hmac_header = request.headers.get("HMAC", request.headers.get("hmac", ""))
        if hmac_header and not oxapay.verify_webhook(raw, hmac_header):
            return web.Response(status=400, text="Invalid HMAC")

        data = json.loads(raw)
        log.info("OxaPay webhook: %s", data)

        status = data.get("status", "")
        track_id = data.get("track_id", "")
        order_id = data.get("order_id", "")

        if data.get("type") == "invoice" and status == "paid":
            dep = await db.get_deposit_by_track(track_id)
            if not dep:
                dep = await db.get_deposit_by_dep_id(order_id)
            if dep and dep["status"] != "paid":
                await process_paid_deposit(track_id, dep["amount_usd"], dep["user_id"])
        elif status in ("Paying", "paying"):
            await db.update_deposit(track_id, "Paying", json.dumps(data))
        elif status == "expired":
            await db.update_deposit(track_id, "expired")

        return web.Response(status=200, text="OK")
    except Exception as e:
        log.error("OxaPay webhook error: %s", e)
        return web.Response(status=500)


async def buffpin_webhook(request: web.Request) -> web.Response:
    try:
        data = await request.json()
        auth_sign = request.headers.get("AuthSign", "")
        if not buffpin.verify_callback(data, auth_sign):
            return web.json_response({"code": 6006, "message": "Bad signature"})

        merchant_oid = data.get("merchantOrderId", "")
        new_status = int(data.get("orderStatus", 0))

        try:
            detail = await buffpin.get_order(merchant_order_id=merchant_oid)
            cd, em = None, None
            items = detail.get("orderItemsList", [])
            if items:
                cards = items[0].get("orderCardsList", [])
                if cards:
                    cd = json.dumps(cards, ensure_ascii=False)
                em = items[0].get("returnMessage")
            await db.update_order_status(
                merchant_order_id=merchant_oid,
                status=new_status, refund_status=detail.get("refundStatus"),
                card_data=cd, error_message=em,
            )
        except Exception:
            await db.update_order_status(merchant_order_id=merchant_oid, status=new_status)

        order = await db.get_order(merchant_oid)
        if order:
            if new_status == 2:
                await notify_order_complete(order["user_id"], merchant_oid)
            elif new_status in (3, 4):
                await db.add_balance(
                    order["user_id"], order["sell_price"], "refund",
                    merchant_oid, "Reembolso: fallo en recarga",
                )
                with suppress(Exception):
                    bal = await db.get_balance(order["user_id"])
                    await bot.send_message(
                        order["user_id"],
                        f"⚠️ <b>Recarga fallida</b>\n\n{format_order_short(order)}\n\n"
                        f"💸 ${order['sell_price']:.2f} devueltos.\n📊 Saldo: ${bal:.2f}",
                        reply_markup=back_kb(),
                    )

        return web.json_response({"code": 1000, "message": "Success"})
    except Exception as e:
        log.error("BuffPin webhook error: %s", e)
        return web.json_response({"code": 501, "message": "Error"})


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 12: TAREAS PERIÓDICAS
# ══════════════════════════════════════════════════════════════════

async def check_pending_orders():
    """Verifica órdenes pendientes cada 60s."""
    while True:
        await asyncio.sleep(60)
        try:
            import aiosqlite
            async with aiosqlite.connect(config.DB_PATH) as conn:
                conn.row_factory = aiosqlite.Row
                async with conn.execute(
                    "SELECT * FROM orders WHERE order_status IN(0,1) AND created_at>?",
                    (time.time() - 86400,),
                ) as c:
                    pending = [dict(r) for r in await c.fetchall()]

            for o in pending:
                try:
                    detail = await buffpin.get_order(merchant_order_id=o["merchant_order_id"])
                    ns = detail.get("orderStatus", o["order_status"])
                    if ns != o["order_status"]:
                        cd, em = None, None
                        items = detail.get("orderItemsList", [])
                        if items:
                            cards = items[0].get("orderCardsList", [])
                            if cards:
                                cd = json.dumps(cards, ensure_ascii=False)
                            em = items[0].get("returnMessage")
                        await db.update_order_status(
                            merchant_order_id=o["merchant_order_id"],
                            status=ns, refund_status=detail.get("refundStatus"),
                            card_data=cd, error_message=em,
                        )
                        if ns == 2:
                            await notify_order_complete(o["user_id"], o["merchant_order_id"])
                        elif ns in (3, 4):
                            await db.add_balance(
                                o["user_id"], o["sell_price"], "refund",
                                o["merchant_order_id"], "Reembolso automático",
                            )
                except Exception:
                    pass
                await asyncio.sleep(1)
        except Exception as e:
            log.error("check_pending: %s", e)


async def check_low_balance_alert():
    """Cada 5 min verifica si el saldo BuffPin está bajo."""
    while True:
        await asyncio.sleep(300)
        try:
            threshold = await settings.get_float("low_balance_threshold", 100)
            last_alert = await settings.get_float("last_low_balance_alert", 0)
            if time.time() - last_alert < 3600:  # No spammear (1h entre alertas)
                continue
            bp = await buffpin.get_balance()
            bal = bp.get("balance", 0)
            if bal < threshold:
                await notify_admins(
                    f"⚠️ <b>ALERTA: Saldo BuffPin bajo</b>\n\n"
                    f"💵 Actual: ${bal:.2f}\n"
                    f"🎯 Umbral: ${threshold:.2f}\n\n"
                    f"Recarga pronto para evitar interrupciones."
                )
                await settings.set_value("last_low_balance_alert", str(time.time()))
        except Exception as e:
            log.debug("low_balance check: %s", e)


# ══════════════════════════════════════════════════════════════════
#  SECCIÓN 13: MAIN
# ══════════════════════════════════════════════════════════════════

async def on_startup():
    await db.init_db()
    await settings.init_settings()
    await refresh_products()

    # Configurar el botón de menú al lado del campo de texto
    # Este es el método CORRECTO de Telegram para abrir mini apps con initData
    webapp_url = getattr(config, "WEBAPP_URL", None)
    if webapp_url:
        try:
            await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(
                text="🛍 Shop",
                web_app=WebAppInfo(url=webapp_url),
            ))
            log.info("✅ MenuButton configurado: %s", webapp_url)
        except Exception as e:
            log.warning("No se pudo configurar MenuButton: %s", e)

    log.info("🚀 Bot iniciado")


async def on_shutdown():
    await buffpin.close()
    await oxapay.close()
    log.info("🛑 Bot detenido")


async def main():
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)
    asyncio.create_task(check_pending_orders())
    asyncio.create_task(check_low_balance_alert())

    if config.WEBHOOK_HOST:
        app = web.Application()
        app.router.add_post(config.OXAPAY_CALLBACK_PATH, oxapay_webhook)
        app.router.add_post(config.BUFFPIN_CALLBACK_PATH, buffpin_webhook)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", config.WEBHOOK_PORT)
        await site.start()
        log.info("Callbacks escuchando en :%d", config.WEBHOOK_PORT)

    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
