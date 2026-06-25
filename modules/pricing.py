"""
Sistema de pricing dual — basado en el rol del usuario.

- user (cliente normal)  → costo + retail_markup
- reseller (revendedor)  → costo + reseller_markup
- admin                   → ve el precio retail (pero puede comprar a costo)

Los markups son dinámicos (tabla settings), se pueden cambiar en caliente.
"""
from modules import settings


async def calculate_price(cost: float, user_role: str = "user") -> dict:
    """
    Calcula el precio según el rol del usuario.

    Returns:
        {
            'cost': float,         # Costo BuffPin
            'markup_pct': float,   # % aplicado
            'profit': float,       # Tu ganancia
            'sell_price': float,   # Precio final
            'role': str,
        }
    """
    if user_role == "reseller":
        markup_pct = await settings.get_float("reseller_markup", 8.0)
    else:
        markup_pct = await settings.get_float("retail_markup", 20.0)

    sell_price = round(cost * (1 + markup_pct / 100), 2)
    profit = round(sell_price - cost, 2)

    return {
        "cost": cost,
        "markup_pct": markup_pct,
        "profit": profit,
        "sell_price": sell_price,
        "role": user_role,
    }


async def calculate_price_sync(cost: float, user_role: str, retail_mk: float, reseller_mk: float) -> float:
    """
    Versión sin await para loops grandes. Recibe los markups precargados.
    """
    mk = reseller_mk if user_role == "reseller" else retail_mk
    return round(cost * (1 + mk / 100), 2)


async def preload_markups() -> tuple[float, float]:
    """Precarga ambos markups. Útil cuando calculas precios de muchos productos."""
    retail = await settings.get_float("retail_markup", 20.0)
    reseller = await settings.get_float("reseller_markup", 8.0)
    return retail, reseller


def apply_discount(price: float, discount_pct: float = 0, discount_fix: float = 0) -> dict:
    """Aplica descuentos. Retorna {final_price, discount_amount}."""
    discount = 0.0
    if discount_pct > 0:
        discount += price * (discount_pct / 100)
    if discount_fix > 0:
        discount += discount_fix
    final = max(0, price - discount)
    return {
        "final_price": round(final, 2),
        "discount_amount": round(discount, 2),
    }
