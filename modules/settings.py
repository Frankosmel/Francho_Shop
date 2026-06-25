"""
Settings dinámicos — Configuración en caliente desde DB.

Permite cambiar markups, mensajes, modo mantenimiento, etc. desde /admin
sin reiniciar el bot. Usa caché en memoria para lecturas rápidas.

Uso:
    from modules.settings import get, set_value, get_float, get_bool

    markup = await get_float("retail_markup")
    await set_value("retail_markup", "25.0")
"""
import json
import logging
import time

import aiosqlite

import config

log = logging.getLogger(__name__)
DB = config.DB_PATH

# Caché en memoria (TTL 60s)
_cache: dict[str, str] = {}
_cache_time: float = 0
CACHE_TTL = 60


# ══════════════════════════════════════
#  Inicialización (valores por defecto)
# ══════════════════════════════════════

DEFAULTS = {
    # Pricing
    "retail_markup": str(config.DEFAULT_RETAIL_MARKUP),
    "reseller_markup": str(config.DEFAULT_RESELLER_MARKUP),
    "reseller_min_deposit": "50",

    # Depósitos / retiros
    "min_deposit": str(config.DEFAULT_MIN_DEPOSIT),
    "min_withdrawal": str(config.DEFAULT_MIN_WITHDRAWAL),

    # Vendedores internos / wallet USDT BEP20
    "seller_default_commission_pct": "10",
    "seller_min_platform_fee": "0.10",
    "seller_hold_days_manual": "7",
    "seller_hold_days_auto": "2",
    "seller_new_days": "30",
    "seller_new_hold_days": "14",
    "seller_withdraw_fee_usdt": "0.25",

    # Referidos
    "referral_commission": str(config.DEFAULT_REFERRAL_PCT),

    # Modos
    "maintenance_mode": "0",
    "registrations_open": "1",
    "reseller_applications_open": "1",

    # Alertas
    "low_balance_threshold": "100",
    "last_low_balance_alert": "0",

    # Mensajes
    "support_handle": "@frankosmel",
    "welcome_message": (
        "🎮 <b>¡Bienvenido a GameStore!</b>\n\n"
        "Tu tienda de recargas de juegos y tarjetas de regalo.\n\n"
        "💎 <b>PUBG</b> · <b>Free Fire</b> · <b>Mobile Legends</b>\n"
        "🎁 <b>Steam</b> · <b>PlayStation</b> · <b>Xbox</b> y más\n\n"
        "⚡ Entrega automática e instantánea\n"
        "💰 Paga con USDT (vía OxaPay)\n"
        "📞 Soporte 24/7"
    ),
    "maintenance_message": (
        "🛠 <b>Mantenimiento en curso</b>\n\n"
        "Estamos realizando mejoras. Volveremos pronto."
    ),

    # Anti-abuso
    "max_orders_per_hour": "20",

    # Branding
    "brand_name": "GameStore",
}


async def init_settings():
    """Crea la tabla y poblarla con defaults si es la primera vez."""
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at REAL DEFAULT (unixepoch()),
                updated_by INTEGER
            )
        """)

        # Insertar defaults solo si no existen
        for k, v in DEFAULTS.items():
            await db.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (k, v),
            )
        await db.commit()

    await _load_cache()
    log.info("✅ Settings inicializados")


# ══════════════════════════════════════
#  Caché
# ══════════════════════════════════════

async def _load_cache():
    global _cache, _cache_time
    async with aiosqlite.connect(DB) as db:
        async with db.execute("SELECT key, value FROM settings") as c:
            rows = await c.fetchall()
            _cache = {k: v for k, v in rows}
            _cache_time = time.time()


async def _ensure_cache():
    if time.time() - _cache_time > CACHE_TTL or not _cache:
        await _load_cache()


# ══════════════════════════════════════
#  API pública
# ══════════════════════════════════════

async def get(key: str, default: str = "") -> str:
    await _ensure_cache()
    return _cache.get(key, DEFAULTS.get(key, default))


async def get_float(key: str, default: float = 0.0) -> float:
    val = await get(key)
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


async def get_int(key: str, default: int = 0) -> int:
    val = await get(key)
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


async def get_bool(key: str, default: bool = False) -> bool:
    val = await get(key)
    return val in ("1", "true", "True", "yes", "on")


async def set_value(key: str, value: str, updated_by: int = 0):
    """Actualiza un setting. Invalida el caché."""
    global _cache_time
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO settings (key, value, updated_at, updated_by)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at,
                updated_by = excluded.updated_by
        """, (key, value, time.time(), updated_by))
        await db.commit()

    # Invalidar caché
    _cache[key] = value
    _cache_time = time.time()
    log.info("⚙️ Setting actualizado: %s = %s (por %s)", key, value, updated_by)


async def get_all() -> dict:
    """Devuelve todos los settings actuales."""
    await _ensure_cache()
    return dict(_cache)


async def get_updated_info(key: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM settings WHERE key = ?", (key,)
        ) as c:
            r = await c.fetchone()
            return dict(r) if r else None
