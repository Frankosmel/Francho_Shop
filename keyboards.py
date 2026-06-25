"""
🎹 Sistema de teclados — todos los menús bajo el teclado.

Filosofía:
- Reply keyboards para NAVEGACIÓN (menús, categorías, regiones, pantallas).
- Inline keyboards solo para ACCIONES con callback único:
    * Comprar producto específico (necesita el id en callback_data)
    * Pagar con OxaPay (link URL)
    * Aprobar/rechazar solicitudes admin
    * Verificar pago, refrescar estado

El bot guarda en FSM el "contexto de navegación" (current_screen y current_data)
para saber a qué reaccionar cuando el usuario toque un texto del teclado.
"""
from aiogram.types import (
    KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, WebAppInfo,
)


# ══════════════════════════════════════
#  Constantes de botones
# ══════════════════════════════════════

# 🛍 Botón estrella: Mini App Francho Shop
BTN_SHOP = "🛍 Francho Shop"

# Navegación común
BTN_BACK = "🔙 Atrás"
BTN_HOME = "🏠 Inicio"
BTN_HIDE = "⬇️ Ocultar menú"
BTN_PREV = "◀️ Anterior"
BTN_NEXT = "Siguiente ▶️"
BTN_CANCEL = "❌ Cancelar"

# Menú principal
BTN_CATALOG = "🛒 Catálogo"
BTN_SEARCH = "🔍 Buscar"
BTN_WALLET = "💰 Billetera"
BTN_ORDERS = "📋 Mis pedidos"
BTN_HELP = "ℹ️ Ayuda"
BTN_BECOME_RESELLER = "💼 Ser revendedor"
BTN_RESELLER_PANEL = "💼 Panel Revendedor"
BTN_ADMIN = "👑 Admin"

# Wallet
BTN_DEP_5 = "💵 $5"
BTN_DEP_10 = "💵 $10"
BTN_DEP_25 = "💵 $25"
BTN_DEP_50 = "💵 $50"
BTN_DEP_100 = "💵 $100"
BTN_DEP_250 = "💵 $250"
BTN_DEP_CUSTOM = "✏️ Otro monto"
BTN_DEP_HISTORY = "📜 Historial depósitos"
BTN_BAL_HISTORY = "📊 Historial saldo"

# Admin
BTN_ADM_DASHBOARD = "📊 Dashboard"
BTN_ADM_CONFIG = "⚙️ Configuración"
BTN_ADM_USERS = "👥 Usuarios"
BTN_ADM_PRODUCTS = "🛒 Productos"
BTN_ADM_ORDERS_ALL = "📦 Órdenes"
BTN_ADM_DEPOSITS = "💰 Depósitos"
BTN_ADM_APPS = "💼 Solicitudes"
BTN_ADM_BROADCAST = "📢 Broadcast"
BTN_ADM_AUDIT = "📋 Audit log"

# Admin config
BTN_CFG_RETAIL = "💰 Retail markup"
BTN_CFG_RESELLER = "💎 Reseller markup"
BTN_CFG_MIN_DEP = "📥 Mín depósito"
BTN_CFG_MIN_WD = "📤 Mín retiro"
BTN_CFG_WELCOME = "💬 Bienvenida"
BTN_CFG_SUPPORT = "📞 Soporte"
BTN_CFG_MAINT = "🛠 Toggle Mantenimiento"
BTN_CFG_APPS = "💼 Toggle Solicitudes"

# Productos admin
BTN_PROD_REFRESH = "🔄 Refrescar BuffPin"
BTN_PROD_SEARCH = "🔍 Buscar producto"

# Broadcast
BTN_BC_ALL = "📢 A todos"
BTN_BC_USERS = "🛒 Solo clientes"
BTN_BC_RESELLERS = "💼 Solo revendedores"


# ══════════════════════════════════════
#  Constructores de teclados
# ══════════════════════════════════════

def _kb(rows: list, placeholder: str = None) -> ReplyKeyboardMarkup:
    """
    Construye un ReplyKeyboardMarkup.
    Cada item en rows puede ser str o KeyboardButton ya construido (para WebApp).
    """
    keyboard = []
    for row in rows:
        kb_row = []
        for item in row:
            if isinstance(item, KeyboardButton):
                kb_row.append(item)  # ya es un botón construido
            else:
                kb_row.append(KeyboardButton(text=str(item)))
        keyboard.append(kb_row)
    return ReplyKeyboardMarkup(
        keyboard=keyboard,
        resize_keyboard=True,
        is_persistent=False,
        one_time_keyboard=False,
        input_field_placeholder=placeholder,
    )


def _shop_button(webapp_url: str, label: str = None) -> KeyboardButton:
    """Crea KeyboardButton con WebAppInfo apuntando a la mini app."""
    return KeyboardButton(
        text=label or BTN_CATALOG,
        web_app=WebAppInfo(url=webapp_url),
    )


def kb_main(role: str, balance: float = 0, webapp_url: str = None) -> ReplyKeyboardMarkup:
    """
    Menú principal. El botón Catálogo abre el flujo dentro del bot.
    Para abrir la mini app, el usuario usa el botón al lado del campo de texto
    (configurado como MenuButton al arrancar el bot).
    """
    rows = [
        [KeyboardButton(text=BTN_CATALOG), KeyboardButton(text=BTN_SEARCH)],
        [KeyboardButton(text=f"💰 Saldo: ${balance:.2f}"), KeyboardButton(text=BTN_ORDERS)],
    ]
    if role == "reseller":
        rows.append([KeyboardButton(text=BTN_RESELLER_PANEL)])
    elif role == "user":
        rows.append([KeyboardButton(text=BTN_BECOME_RESELLER)])
    rows.append([KeyboardButton(text=BTN_HELP), KeyboardButton(text=BTN_HIDE)])
    if role == "admin":
        rows.append([KeyboardButton(text=BTN_ADMIN)])
    return _kb(rows, "Selecciona una opción...")



def kb_catalog_categories(categories: list[str]) -> ReplyKeyboardMarkup:
    """Lista de categorías principales del catálogo en filas de 1 para que no se corten."""
    rows = [[c] for c in categories]
    rows.append([BTN_HOME])
    return _kb(rows, "Elige una categoría...")

def kb_games(games: list[str]) -> ReplyKeyboardMarkup:
    """Lista de juegos en filas de 2."""
    rows = []
    pair = []
    for g in games:
        pair.append(g)
        if len(pair) == 2:
            rows.append(pair); pair = []
    if pair:
        rows.append(pair)
    rows.append([BTN_HOME])
    return _kb(rows, "Elige un juego...")


def kb_regions(regions: list[str]) -> ReplyKeyboardMarkup:
    """Lista de regiones de un juego."""
    rows = [[r] for r in regions]
    rows.append([BTN_BACK, BTN_HOME])
    return _kb(rows, "Elige tu región...")


def kb_products_nav(has_prev: bool, has_next: bool, page: int, total: int) -> ReplyKeyboardMarkup:
    """Navegación de páginas de productos."""
    nav = []
    if has_prev:
        nav.append(BTN_PREV)
    if has_next:
        nav.append(BTN_NEXT)
    rows = []
    if nav:
        rows.append(nav)
    rows.append([f"📄 Página {page}/{total}"])
    rows.append([BTN_BACK, BTN_HOME])
    return _kb(rows, "Toca un producto arriba ⬆️")


def kb_wallet(webapp_url: str = None) -> ReplyKeyboardMarkup:
    """Wallet con botón Catálogo (WebApp) arriba para comprar después de recargar."""
    rows = []
    if webapp_url:
        rows.append([_shop_button(webapp_url, "🛒 Ir al catálogo")])
    rows += [
        [BTN_DEP_5, BTN_DEP_10, BTN_DEP_25],
        [BTN_DEP_50, BTN_DEP_100, BTN_DEP_250],
        [BTN_DEP_CUSTOM],
        [BTN_DEP_HISTORY, BTN_BAL_HISTORY],
        [BTN_HOME],
    ]
    return _kb(rows, "Elige cuánto recargar...")


def kb_cancel() -> ReplyKeyboardMarkup:
    return _kb([[BTN_CANCEL]], "Escribe tu respuesta...")


def kb_admin() -> ReplyKeyboardMarkup:
    rows = [
        [BTN_ADM_DASHBOARD, BTN_ADM_CONFIG],
        [BTN_ADM_USERS, BTN_ADM_PRODUCTS],
        [BTN_ADM_ORDERS_ALL, BTN_ADM_DEPOSITS],
        [BTN_ADM_APPS, BTN_ADM_BROADCAST],
        [BTN_ADM_AUDIT],
        [BTN_HOME],
    ]
    return _kb(rows, "Panel de administración")


def kb_admin_config() -> ReplyKeyboardMarkup:
    rows = [
        [BTN_CFG_RETAIL, BTN_CFG_RESELLER],
        [BTN_CFG_MIN_DEP, BTN_CFG_MIN_WD],
        [BTN_CFG_WELCOME, BTN_CFG_SUPPORT],
        [BTN_CFG_MAINT, BTN_CFG_APPS],
        [BTN_BACK],
    ]
    return _kb(rows, "Configurar...")


def kb_admin_products() -> ReplyKeyboardMarkup:
    rows = [
        [BTN_PROD_REFRESH],
        [BTN_PROD_SEARCH],
        [BTN_BACK],
    ]
    return _kb(rows)


def kb_admin_broadcast() -> ReplyKeyboardMarkup:
    rows = [
        [BTN_BC_ALL],
        [BTN_BC_USERS, BTN_BC_RESELLERS],
        [BTN_BACK],
    ]
    return _kb(rows, "Selecciona audiencia")


def kb_remove() -> ReplyKeyboardRemove:
    return ReplyKeyboardRemove()
