"""BuffPin API Client — wrapper async."""
import hashlib
import json
import logging
from typing import Any

import aiohttp
import config

log = logging.getLogger(__name__)


class BuffPinError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")


class BuffPinClient:
    def __init__(self):
        self.host = config.BUFFPIN_HOST.rstrip("/")
        self.client_id = config.BUFFPIN_CLIENT_ID
        self.client_secret = config.BUFFPIN_CLIENT_SECRET
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def _body_and_sign(self, params: dict) -> tuple[str, str]:
        body = json.dumps(params, separators=(",", ":"), ensure_ascii=False)
        sign = hashlib.md5((body + self.client_secret).encode()).hexdigest().lower()
        return body, sign

    def _sign(self, params: dict) -> str:
        return self._body_and_sign(params)[1]

    async def _request(self, endpoint: str, params: dict = None) -> dict:
        params = params or {}
        body, sign = self._body_and_sign(params)
        headers = {
            "Content-Type": "application/json",
            "ClientId": self.client_id,
            "AuthSign": sign,
        }
        url = f"{self.host}{endpoint}"
        session = await self._get_session()
        async with session.post(url, data=body.encode("utf-8"), headers=headers) as resp:
            data = await resp.json()
            if not data.get("result"):
                err = data.get("error", {})
                raise BuffPinError(
                    err.get("code", resp.status),
                    err.get("message", "Error desconocido"),
                )
            return data

    async def get_products(self, page: int = 1, size: int = 100) -> dict:
        data = await self._request(f"/api/v1/getGoodsList/{page}/{size}")
        return {"items": data.get("data", []), "page": data.get("page", {})}

    async def get_all_products(self) -> list[dict]:
        all_items, page = [], 1
        while True:
            result = await self.get_products(page=page)
            all_items.extend(result["items"])
            if page >= result["page"].get("totalPages", 1):
                break
            page += 1
        return all_items

    async def submit_order(
        self, merchant_order_id: str, product_id: int, qty: int,
        recharge_config: str, ip: str = "127.0.0.1", notify_url: str = None,
    ) -> dict:
        params: dict[str, Any] = {
            "ip": ip,
            "merchantOrderId": merchant_order_id,
            "orderItemsBOList": [{
                "priceGroupGoodsId": product_id,
                "buyNumber": qty,
                "rechargePlatformConfig": recharge_config,
            }],
        }
        if notify_url:
            params["notifyUrl"] = notify_url
        data = await self._request("/api/v1/submitOrder", params)
        return data.get("data", {}).get("order", data.get("data", {}))

    async def get_order(self, merchant_order_id: str = None, order_id: str = None) -> dict:
        params = {}
        if order_id:
            params["orderId"] = order_id
        if merchant_order_id:
            params["merchantOrderId"] = merchant_order_id
        data = await self._request("/api/v1/getOrderDetail", params)
        return data.get("data", {})

    async def get_balance(self) -> dict:
        data = await self._request("/api/v1/getBalance")
        return data.get("data", {})

    async def validate_user(self, account_id: str, game_type: int = 1, server_id: str = None) -> dict:
        params: dict[str, Any] = {"type": game_type, "accountId": account_id}
        if server_id:
            params["serverId"] = server_id
        data = await self._request("/api/v1/getAccountInfo", params)
        return data.get("data", {})

    def verify_callback(self, params: dict, auth_sign: str) -> bool:
        return self._sign(params) == auth_sign.lower()
