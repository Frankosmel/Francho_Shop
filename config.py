"""
🎮 GameStore Bot — Configuración base (bootstrap).

Solo contiene valores que DEBEN existir antes de arrancar el bot.
Todo lo demás (markup, precios, mensajes) se maneja desde DB settings
y se puede cambiar en caliente desde /admin.
"""
import os

# ══════════════════════════════════════
#  Telegram
# ══════════════════════════════════════
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]

# ══════════════════════════════════════
#  BuffPin API
# ══════════════════════════════════════
BUFFPIN_HOST = os.getenv("BUFFPIN_HOST", "https://api.buffpin.com")
BUFFPIN_CLIENT_ID = os.getenv("BUFFPIN_CLIENT_ID", "")
BUFFPIN_CLIENT_SECRET = os.getenv("BUFFPIN_CLIENT_SECRET", "")

# ══════════════════════════════════════
#  OxaPay API
# ══════════════════════════════════════
OXAPAY_MERCHANT_KEY = os.getenv("OXAPAY_MERCHANT_KEY", "")
OXAPAY_PAYOUT_API_KEY = os.getenv("OXAPAY_PAYOUT_API_KEY", "")
OXAPAY_GENERAL_API_KEY = os.getenv("OXAPAY_GENERAL_API_KEY", "")
OXAPAY_API_URL = "https://api.oxapay.com/v1"
OXAPAY_SANDBOX = os.getenv("OXAPAY_SANDBOX", "false").lower() == "true"

# ══════════════════════════════════════
#  Servidor webhooks
# ══════════════════════════════════════
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST", "")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8443"))
OXAPAY_CALLBACK_PATH = "/oxapay/callback"
OXAPAY_PAYOUT_CALLBACK_PATH = "/oxapay/payout-callback"
BUFFPIN_CALLBACK_PATH = "/buffpin/callback"

# ══════════════════════════════════════
#  DB & Bootstrap defaults
# ══════════════════════════════════════
DB_PATH = os.getenv("DB_PATH", "gamestore.db")
FIVESIM_API_KEY = os.getenv("FIVESIM_API_KEY", "")

# ══════════════════════════════════════
#  Mini app Francho Shop (Telegram WebApp)
# ══════════════════════════════════════
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://franchoshop.reenvioplusbot.xyz")

# Valores iniciales (solo se usan la primera vez, después viven en settings DB)
DEFAULT_RETAIL_MARKUP = float(os.getenv("RETAIL_MARKUP_PERCENT", "20"))
DEFAULT_RESELLER_MARKUP = float(os.getenv("RESELLER_MARKUP_PERCENT", "8"))
DEFAULT_MIN_DEPOSIT = float(os.getenv("MIN_DEPOSIT_USD", "5"))
DEFAULT_MIN_WITHDRAWAL = float(os.getenv("MIN_WITHDRAWAL", "10"))
DEFAULT_REFERRAL_PCT = float(os.getenv("REFERRAL_COMMISSION_PCT", "5"))

# UI
ITEMS_PER_PAGE = 8
DEPOSIT_PRESETS = [5, 10, 25, 50, 100, 250]

# Categorías BuffPin
PRODUCT_TYPES = {
    1: ("🎮", "Recarga directa"),
    2: ("🔑", "Tarjeta / PIN"),
    3: ("👤", "Recarga por agente"),
    4: ("📱", "Saldo telefónico"),
    5: ("📶", "Datos móviles"),
    6: ("📦", "Otros"),
}
