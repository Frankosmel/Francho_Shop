"""OxaPay API Client — USDT invoices."""
import hashlib
import hmac
import logging

import aiohttp
import config

log = logging.getLogger(__name__)


class OxaPayError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(f"[{status}] {message}")


class OxaPayClient:
    def __init__(self):
        self.api_url = config.OXAPAY_API_URL
        self.merchant_key = config.OXAPAY_MERCHANT_KEY
        self.payout_key = getattr(config, "OXAPAY_PAYOUT_API_KEY", "")
        self.general_key = getattr(config, "OXAPAY_GENERAL_API_KEY", "")
        self.sandbox = config.OXAPAY_SANDBOX
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

    async def create_invoice(
        self, amount: float, order_id: str,
        description: str = "", callback_url: str = None,
    ) -> dict:
        data = {
            "amount": amount,
            "currency": "USD",
            "lifetime": 60,
            "fee_paid_by_payer": 1,
            "under_paid_coverage": 5,
            "to_currency": "USDT",
            "order_id": order_id,
            "description": description or f"GameStore #{order_id}",
            "thanks_message": "✅ ¡Pago recibido! Tus créditos serán acreditados.",
            "sandbox": self.sandbox,
        }
        if callback_url:
            data["callback_url"] = callback_url

        session = await self._get_session()
        headers = {
            "merchant_api_key": self.merchant_key,
            "Content-Type": "application/json",
        }

        async with session.post(
            f"{self.api_url}/payment/invoice",
            json=data,
            headers=headers,
        ) as resp:
            result = await resp.json()
            log.info("OxaPay create_invoice: %s", result)
            if result.get("status") != 200:
                raise OxaPayError(
                    result.get("status", 0),
                    result.get("message", "Error desconocido"),
                )
            data = result.get("data", result)
            if data.get("payment_url") and not data.get("pay_link"):
                data["pay_link"] = data["payment_url"]
            if data.get("url") and not data.get("pay_link"):
                data["pay_link"] = data["url"]
            if data.get("trackId") and not data.get("track_id"):
                data["track_id"] = data["trackId"]
            return data

    async def get_payment(self, track_id: str) -> dict:
        session = await self._get_session()
        headers = {
            "merchant_api_key": self.merchant_key,
            "Content-Type": "application/json",
        }
        async with session.get(
            f"{self.api_url}/payment/{track_id}",
            headers=headers,
        ) as resp:
            result = await resp.json()
            if result.get("status") != 200:
                raise OxaPayError(
                    result.get("status", 0),
                    result.get("message", "Error"),
                )
            return result.get("data", {})



    async def get_account_balance(self, currency: str = "USDT") -> dict:
        if not self.general_key:
            raise OxaPayError(401, "OXAPAY_GENERAL_API_KEY no configurado")
        session = await self._get_session()
        headers = {
            "general_api_key": self.general_key,
            "Content-Type": "application/json",
        }
        params = {"currency": currency} if currency else None
        async with session.get(f"{self.api_url}/general/account/balance", headers=headers, params=params) as resp:
            result = await resp.json()
            if result.get("status") != 200:
                err = result.get("error") or {}
                raise OxaPayError(result.get("status", resp.status), err.get("message") or result.get("message", "Error balance"))
            return result.get("data", result)

    async def create_payout(
        self, amount: float, address: str, currency: str = "USDT",
        network: str = "BEP20", description: str = "", callback_url: str = None,
    ) -> dict:
        if not self.payout_key:
            raise OxaPayError(401, "OXAPAY_PAYOUT_API_KEY no configurado")
        data = {
            "address": address,
            "currency": currency,
            "amount": amount,
            "network": network,
            "description": description,
        }
        if callback_url:
            data["callback_url"] = callback_url
        session = await self._get_session()
        headers = {
            "payout_api_key": self.payout_key,
            "Content-Type": "application/json",
        }
        async with session.post(f"{self.api_url}/payout", json=data, headers=headers) as resp:
            result = await resp.json()
            log.info("OxaPay create_payout: %s", result)
            if result.get("status") != 200:
                err = result.get("error") or {}
                raise OxaPayError(result.get("status", resp.status), err.get("message") or result.get("message", "Error payout"))
            return result.get("data", result)

    async def get_payout(self, track_id: str) -> dict:
        if not self.payout_key:
            raise OxaPayError(401, "OXAPAY_PAYOUT_API_KEY no configurado")
        session = await self._get_session()
        headers = {
            "payout_api_key": self.payout_key,
            "Content-Type": "application/json",
        }
        async with session.get(f"{self.api_url}/payout/{track_id}", headers=headers) as resp:
            result = await resp.json()
            if result.get("status") != 200:
                err = result.get("error") or {}
                raise OxaPayError(result.get("status", resp.status), err.get("message") or result.get("message", "Error payout"))
            return result.get("data", result)

    def verify_webhook(self, raw_body: bytes, hmac_header: str) -> bool:
        calculated = hmac.new(
            self.merchant_key.encode(),
            raw_body,
            hashlib.sha512,
        ).hexdigest()
        return hmac.compare_digest(calculated, hmac_header)
