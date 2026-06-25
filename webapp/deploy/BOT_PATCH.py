"""
═══════════════════════════════════════════════════════════════════
  PATCH para bot.py — añadir botón WebApp Francho Shop
═══════════════════════════════════════════════════════════════════

Este patch añade un botón "🛍 Francho Shop" al menú principal del bot
que abre la mini app dentro de Telegram.
"""

# ════════════════════════════════════════
#  PASO 1: Añadir el import en bot.py
#  (junto a los demás imports de aiogram.types)
# ════════════════════════════════════════

ADD_IMPORT = """
from aiogram.types import WebAppInfo
"""


# ════════════════════════════════════════
#  PASO 2: Añadir variable en config.py
# ════════════════════════════════════════

ADD_TO_CONFIG = """
# Mini app Francho Shop
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://shop.tudominio.com")
"""


# ════════════════════════════════════════
#  PASO 3: Añadir variable en .env
# ════════════════════════════════════════

ADD_TO_ENV = """
WEBAPP_URL=https://shop.tudominio.com
"""


# ════════════════════════════════════════
#  PASO 4: Modificar keyboards.py
#  Reemplazar la función kb_main() con esta:
# ════════════════════════════════════════

REPLACE_KB_MAIN = '''
def kb_main(role: str, balance: float = 0, webapp_url: str = None) -> ReplyKeyboardMarkup:
    """Menú principal con botón WebApp para Francho Shop."""
    rows = []

    # 🌟 BOTÓN ESTRELLA: WebApp Francho Shop
    if webapp_url:
        rows.append([KeyboardButton(
            text="🛍 Francho Shop",
            web_app=WebAppInfo(url=webapp_url),
        )])

    rows += [
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
'''


# Importante: añadir al inicio de keyboards.py:
ADD_TO_KEYBOARDS_IMPORTS = """
from aiogram.types import (
    KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, WebAppInfo,
)
"""


# ════════════════════════════════════════
#  PASO 5: Modificar bot.py main_reply_kb
# ════════════════════════════════════════

REPLACE_MAIN_REPLY_KB = '''
async def main_reply_kb(user_id: int) -> ReplyKeyboardMarkup:
    bal = await db.get_balance(user_id)
    role = await get_effective_role(user_id)
    webapp_url = getattr(config, "WEBAPP_URL", None)
    return kb.kb_main(role, bal, webapp_url=webapp_url)
'''
