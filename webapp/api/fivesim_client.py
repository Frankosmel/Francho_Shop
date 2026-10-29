import os
import time
import asyncio
import aiohttp
import logging

log = logging.getLogger(__name__)

FIVESIM_BASE_URL = os.getenv("FIVESIM_BASE_URL", "https://5sim.net/v1").rstrip("/")
FIVESIM_API_KEY = os.getenv("FIVESIM_API_KEY", "").strip()
FIVESIM_TIMEOUT = float(os.getenv("FIVESIM_TIMEOUT", "25"))

# Cargar del archivo config si no está en entorno
if not FIVESIM_API_KEY:
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        import config
        FIVESIM_API_KEY = getattr(config, "FIVESIM_API_KEY", "").strip()
    except Exception:
        pass

class FiveSimError(Exception):
    pass

# Caché compartido en memoria a nivel de módulo (persiste entre peticiones HTTP)
_MODULE_COUNTRIES_CACHE = None
_MODULE_COUNTRIES_EXPIRE = 0
_MODULE_PRODUCTS_CACHE = {}  # key: (country, operator) -> (expire, data)

class FiveSimClient:
    def __init__(self, api_key: str = None, base_url: str = None, timeout: float = None):
        self.api_key = api_key or FIVESIM_API_KEY
        self.base_url = base_url or FIVESIM_BASE_URL
        self.timeout = timeout or FIVESIM_TIMEOUT
        self.public_headers = {"Accept": "application/json"}

    def _get_auth_headers(self):
        key = self.api_key or FIVESIM_API_KEY
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {key}",
        }

    async def _request(self, method, path, auth=False, params=None):
        headers = self._get_auth_headers() if auth else self.public_headers
        async with aiohttp.ClientSession() as session:
            try:
                async with session.request(
                    method,
                    f"{self.base_url}{path}",
                    headers=headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                ) as resp:
                    text = await resp.text()
                    try:
                        data = await resp.json(content_type=None)
                    except Exception:
                        data = {"raw": text}
                    if resp.status >= 400:
                        raise FiveSimError(f"Error {resp.status} de 5sim: {str(data)[:300]}")
                    return data
            except aiohttp.ClientError as e:
                raise FiveSimError(f"Error de conexión a 5sim: {str(e)}")
            except asyncio.TimeoutError:
                raise FiveSimError("Tiempo de espera agotado al conectar con 5sim")
            except Exception as e:
                raise FiveSimError(f"Error en petición a 5sim: {str(e)}")

    async def countries(self):
        global _MODULE_COUNTRIES_CACHE, _MODULE_COUNTRIES_EXPIRE
        from pathlib import Path
        import json
        now = time.time()
        if _MODULE_COUNTRIES_CACHE and now < _MODULE_COUNTRIES_EXPIRE:
            return _MODULE_COUNTRIES_CACHE
        
        # Intentar cargar caché local desde archivo (válido por 24 horas)
        cache_dir = Path(__file__).resolve().parent.parent.parent / "data"
        cache_file = cache_dir / "fivesim_countries_cache.json"
        
        if cache_file.exists() and (now - cache_file.stat().st_mtime) < 86400:
            try:
                data = json.loads(cache_file.read_text(encoding="utf-8"))
                if data:
                    _MODULE_COUNTRIES_CACHE = data
                    _MODULE_COUNTRIES_EXPIRE = cache_file.stat().st_mtime + 86400
                    return data
            except Exception:
                pass
        
        try:
            data = await self._request("GET", "/guest/countries")
            paises = sorted(list(data.keys())) if isinstance(data, dict) else []
            if paises:
                _MODULE_COUNTRIES_CACHE = paises
                _MODULE_COUNTRIES_EXPIRE = now + 86400
                try:
                    cache_dir.mkdir(parents=True, exist_ok=True)
                    cache_file.write_text(json.dumps(paises, ensure_ascii=False), encoding="utf-8")
                except Exception:
                    pass
                return paises
        except Exception as e:
            log.error("Error obteniendo países de 5sim: %s", e)
            if _MODULE_COUNTRIES_CACHE:
                return _MODULE_COUNTRIES_CACHE
            raise
        return []

    async def products(self, country, operator="any"):
        global _MODULE_PRODUCTS_CACHE
        from pathlib import Path
        import json
        now = time.time()
        cache_key = (country, operator)
        if cache_key in _MODULE_PRODUCTS_CACHE:
            expire, cached_data = _MODULE_PRODUCTS_CACHE[cache_key]
            if now < expire:
                return cached_data
        
        # Intentar cargar caché local desde archivo (válido por 5 minutos para stock/precios)
        cache_dir = Path(__file__).resolve().parent.parent.parent / "data"
        safe_country = "".join(x for x in country if x.isalnum())
        safe_op = "".join(x for x in operator if x.isalnum())
        cache_file = cache_dir / f"fivesim_products_{safe_country}_{safe_op}.json"
        
        if cache_file.exists() and (now - cache_file.stat().st_mtime) < 300:
            try:
                data = json.loads(cache_file.read_text(encoding="utf-8"))
                if data:
                    _MODULE_PRODUCTS_CACHE[cache_key] = (cache_file.stat().st_mtime + 300, data)
                    return data
            except Exception:
                pass
        
        try:
            data = await self._request("GET", f"/guest/products/{country}/{operator}")
            # Enriquecer con precios reales de operadores que SÍ tienen stock disponible
            try:
                prices_res = await self.prices(country)
                country_prices = prices_res.get(country, {}) if isinstance(prices_res, dict) else {}
                if country_prices and isinstance(data, dict):
                    for s_name, info in data.items():
                        if not isinstance(info, dict):
                            continue
                        ops = country_prices.get(s_name, {})
                        if isinstance(ops, dict) and ops:
                            if operator == "any":
                                ops_with_stock = [v for k, v in ops.items() if isinstance(v, dict) and int(v.get('count', 0) or 0) > 0]
                                if ops_with_stock:
                                    min_cost = min(float(v.get('cost', 0) or 0) for v in ops_with_stock)
                                    max_cost = max(float(v.get('cost', 0) or 0) for v in ops_with_stock)
                                    total_stock = sum(int(v.get('count', 0) or 0) for v in ops_with_stock)
                                    info['Price'] = min_cost
                                    info['PriceMax'] = max_cost
                                    info['Qty'] = total_stock
                                else:
                                    info['Qty'] = 0
                            else:
                                op_info = ops.get(operator)
                                if isinstance(op_info, dict) and int(op_info.get('count', 0) or 0) > 0:
                                    info['Price'] = float(op_info.get('cost', 0) or 0)
                                    info['PriceMax'] = float(op_info.get('cost', 0) or 0)
                                    info['Qty'] = int(op_info.get('count', 0) or 0)
                                else:
                                    info['Qty'] = 0
            except Exception as e:
                log.warning("No se pudo enriquecer catálogo 5sim con precios en vivo: %s", e)

            _MODULE_PRODUCTS_CACHE[cache_key] = (now + 300, data)
            try:
                cache_dir.mkdir(parents=True, exist_ok=True)
                cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            except Exception:
                pass
            return data
        except Exception as e:
            log.error("Error obteniendo productos de 5sim: %s", e)
            if cache_key in _MODULE_PRODUCTS_CACHE:
                return _MODULE_PRODUCTS_CACHE[cache_key][1]
            raise

    async def prices(self, country, product=None):
        params = {"country": country}
        if product:
            params["product"] = product
        return await self._request("GET", "/guest/prices", params=params)

    async def buy_activation(self, country, operator, product):
        key = self.api_key or FIVESIM_API_KEY
        if not key:
            raise FiveSimError("FIVESIM_API_KEY no configurada")
        return await self._request("GET", f"/user/buy/activation/{country}/{operator}/{product}", auth=True)

    async def check(self, order_id):
        return await self._request("GET", f"/user/check/{order_id}", auth=True)

    async def finish(self, order_id):
        return await self._request("GET", f"/user/finish/{order_id}", auth=True)

    async def cancel(self, order_id):
        return await self._request("GET", f"/user/ban/{order_id}", auth=True)
