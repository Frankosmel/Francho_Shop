import os
import time
import asyncio
import aiohttp
import logging
from typing import Any, Optional, Dict, List

log = logging.getLogger(__name__)

STREAMZONE_BASE_URL = os.getenv("STREAMZONE_BASE_URL", "https://streamzone.app").rstrip("/")
STREAMZONE_API_KEY = os.getenv("STREAMZONE_API_KEY", "").strip()
STREAMZONE_TIMEOUT = float(os.getenv("STREAMZONE_TIMEOUT", "25"))

# Fallback config import
if not STREAMZONE_API_KEY:
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        import config
        STREAMZONE_API_KEY = getattr(config, "STREAMZONE_API_KEY", "").strip()
    except Exception:
        pass


class StreamZoneError(Exception):
    def __init__(self, message: str, status_code: int = 400, raw_error: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.raw_error = raw_error


class StreamZoneClient:
    def __init__(self, api_key: str = None, base_url: str = None, timeout: float = None):
        self.api_key = api_key or STREAMZONE_API_KEY
        self.base_url = (base_url or STREAMZONE_BASE_URL).rstrip("/")
        self.timeout = timeout or STREAMZONE_TIMEOUT
        self._catalog_cache: Optional[List[Dict[str, Any]]] = None
        self._catalog_expire: float = 0
        self._exchange_rate: float = 3182.78

    def _headers(self) -> Dict[str, str]:
        key = (self.api_key or STREAMZONE_API_KEY).strip()
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    async def get_profile(self) -> Dict[str, Any]:
        """Consulta el perfil, estado y saldo de la wallet en StreamZone."""
        url = f"{self.base_url}/api/v1/profile"
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=self._headers(), timeout=self.timeout) as resp:
                    data = await resp.json()
                    if resp.status != 200:
                        raise StreamZoneError(
                            data.get("error", f"Error {resp.status} al consultar perfil"),
                            status_code=resp.status,
                            raw_error=data
                        )
                    return data.get("data", data)
            except asyncio.TimeoutError:
                raise StreamZoneError("Timeout al conectar con StreamZone", 504)
            except aiohttp.ClientError as e:
                raise StreamZoneError(f"Error de conexión con StreamZone: {str(e)}", 502)

    async def get_catalog(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Retorna el catálogo unificado y enriquecido de servicios de streaming,
        combinando los datos operativos de /api/v1/catalog con las imágenes y términos de /api/reseller/catalog.
        """
        now = time.time()
        if not force_refresh and self._catalog_cache and now < self._catalog_expire:
            return self._catalog_cache

        async with aiohttp.ClientSession() as session:
            v1_url = f"{self.base_url}/api/v1/catalog"
            reseller_url = f"{self.base_url}/api/reseller/catalog"
            headers = self._headers()

            async def _fetch(url):
                try:
                    async with session.get(url, headers=headers, timeout=self.timeout) as resp:
                        if resp.status == 200:
                            return await resp.json()
                except Exception as e:
                    log.warning(f"Error fetching {url}: {e}")
                return None

            v1_data, reseller_data = await asyncio.gather(_fetch(v1_url), _fetch(reseller_url))

            if not v1_data or not v1_data.get("ok"):
                if self._catalog_cache:
                    return self._catalog_cache
                err_msg = (v1_data or {}).get("error", "No se pudo obtener el catálogo de StreamZone")
                raise StreamZoneError(err_msg, 502)

            exchange_rate = float(v1_data.get("exchangeRateUSDToCOP") or 3182.78)
            self._exchange_rate = exchange_rate

            # Mapear productos enriquecidos de /api/reseller/catalog
            reseller_products_map = {}
            if reseller_data and isinstance(reseller_data.get("products"), list):
                for rp in reseller_data["products"]:
                    reseller_products_map[rp.get("id")] = rp

            merged_products = []
            for p in v1_data.get("products", []):
                pid = p.get("id")
                rp = reseller_products_map.get(pid, {})

                # Resolver imagen: Cloudinary de alta resolución o default
                image_url = rp.get("image_url") or ""
                if not image_url and rp.get("icon_name"):
                    image_url = f"https://res.cloudinary.com/dt28zpwi7/image/upload/v1788902033/productos/{rp['icon_name']}.png"

                # Resolver términos y condiciones
                terms = rp.get("terms_and_conditions") or ""
                description = rp.get("description") or ""

                # Reglas de garantía
                warranty_rules = []
                if isinstance(rp.get("service_warranty"), dict):
                    warranty_rules = rp["service_warranty"].get("rules", [])
                elif isinstance(rp.get("warranty_terms"), dict):
                    warranty_rules = rp["warranty_terms"].get("rules", [])

                price_cop = float(p.get("priceCOP") or rp.get("distributor_price") or 0)
                price_usd = float(p.get("priceUSD") or round(price_cop / exchange_rate, 2))

                unified = {
                    "id": pid,
                    "code": p.get("code") or rp.get("product_code") or "",
                    "name": p.get("name") or rp.get("name") or "",
                    "slug": rp.get("slug") or "",
                    "category": p.get("category") or rp.get("category_name") or "Streaming",
                    "duration_days": int(p.get("durationDays") or rp.get("duration_days") or 30),
                    "guarantee_days": int(p.get("guaranteeDays") or rp.get("guarantee_days") or 30),
                    "price_cop": price_cop,
                    "price_usd": price_usd,
                    "suggested_retail_price_cop": float(rp.get("suggested_retail_price") or 0),
                    "in_stock": bool(p.get("inStock")),
                    "stock_available": int(p.get("stockAvailable") or 0),
                    "product_type": p.get("productType") or rp.get("product_type") or "PROFILE",
                    "origin": p.get("origin") or "STREAMZONE_BODEGA",
                    "badge": p.get("badge") or rp.get("sale_badge_text") or None,
                    "image_url": image_url,
                    "description": description,
                    "terms_and_conditions": terms,
                    "warranty_rules": warranty_rules,
                    "region": rp.get("region") or "Global",
                    "exchange_rate": exchange_rate
                }
                merged_products.append(unified)

            self._catalog_cache = merged_products
            self._catalog_expire = now + 60.0  # 60 segundos de caché
            return merged_products

    async def create_order(self, product_id: str, quantity: int = 1, idempotency_key: str = None) -> Dict[str, Any]:
        """
        Realiza la compra instantánea de un perfil o licencia en StreamZone.
        Debita saldo de la Wallet mayorista y devuelve las credenciales de acceso.
        """
        url = f"{self.base_url}/api/v1/orders"
        payload = {
            "productId": product_id,
            "quantity": max(1, int(quantity))
        }
        if idempotency_key:
            payload["idempotencyKey"] = str(idempotency_key)

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(url, json=payload, headers=self._headers(), timeout=self.timeout) as resp:
                    data = await resp.json()
                    if resp.status == 200 and data.get("ok"):
                        return data
                    
                    err_msg = data.get("error", f"Error {resp.status} al procesar la orden")
                    err_code = data.get("code")
                    if err_code == "INSUFFICIENT_FUNDS":
                        err_msg = f"Saldo insuficiente en StreamZone. Requiere {data.get('requiredCOP', 0)} COP."
                    
                    raise StreamZoneError(err_msg, status_code=resp.status, raw_error=data)
            except asyncio.TimeoutError:
                raise StreamZoneError("Tiempo de espera agotado al conectar con StreamZone (Timeout)", 504)
            except aiohttp.ClientError as e:
                raise StreamZoneError(f"Error de comunicación con el proveedor: {str(e)}", 502)

    async def get_orders(self, order_id: str = None) -> List[Dict[str, Any]]:
        """Consulta el historial de órdenes o una orden específica."""
        url = f"{self.base_url}/api/v1/orders"
        if order_id:
            url += f"?orderId={order_id}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self._headers(), timeout=self.timeout) as resp:
                data = await resp.json()
                if resp.status == 200 and data.get("ok"):
                    return data.get("orders", [])
                return []


# Instancia singleton para usar en toda la aplicación
streamzone_client = StreamZoneClient()
