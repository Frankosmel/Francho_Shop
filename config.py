"""
🎮 GameStore Bot — Configuración base (bootstrap).

Solo contiene valores que DEBEN existir antes de arrancar el bot.
Todo lo demás (markup, precios, mensajes) se maneja desde DB settings
y se puede cambiar en caliente desde /admin.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

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
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST", "https://franchoshop.com")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8443"))
OXAPAY_CALLBACK_PATH = "/api/oxapay/callback"
OXAPAY_PAYOUT_CALLBACK_PATH = "/api/oxapay/payout-callback"
BUFFPIN_CALLBACK_PATH = "/buffpin/callback"

# ══════════════════════════════════════
#  DB & Bootstrap defaults
# ══════════════════════════════════════
_raw_db = os.getenv("DB_PATH", "gamestore.db")
DB_PATH = str(Path(_raw_db).resolve()) if os.path.isabs(_raw_db) else str((Path(__file__).resolve().parent / _raw_db).resolve())
FIVESIM_API_KEY = os.getenv("FIVESIM_API_KEY", "")
STREAMZONE_API_KEY = os.getenv("STREAMZONE_API_KEY", "")

# ══════════════════════════════════════
#  Mini app Francho Shop (Telegram WebApp)
# ══════════════════════════════════════
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://franchoshop.com")

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

# ══════════════════════════════════════
#  Google OAuth / Sign-In
# ══════════════════════════════════════
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# ══════════════════════════════════════
#  Cross-Chain Swap & Uniswap DEX
# ══════════════════════════════════════
CHANGENOW_API_KEY = os.getenv("CHANGENOW_API_KEY", "")
BRIDGE_PARTNER_ID = os.getenv("BRIDGE_PARTNER_ID", "")
BRIDGE_PARTNER_SECRET = os.getenv("BRIDGE_PARTNER_SECRET", "")
BRIDGE_PAYOUT_WALLET = os.getenv("BRIDGE_PAYOUT_WALLET", "")
UNISWAP_API_KEY = os.getenv("UNISWAP_API_KEY", "")
UNISWAP_GATEWAY_URL = os.getenv("UNISWAP_GATEWAY_URL", "https://trade-api.gateway.uniswap.org/v1")

