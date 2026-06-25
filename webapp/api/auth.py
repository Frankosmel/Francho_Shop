"""Verificación de initData de Telegram WebApp."""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from fastapi import HTTPException, Header

import config


def verify_init_data(init_data: str, max_age_seconds: int = 86400) -> dict:
    """Valida el initData de Telegram. Retorna dict con datos del usuario."""
    if not init_data:
        raise HTTPException(401, "Missing initData")

    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        raise HTTPException(401, "Invalid initData format")

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(401, "Missing hash")

    auth_date = int(parsed.get("auth_date", 0))
    if time.time() - auth_date > max_age_seconds:
        raise HTTPException(401, "initData expired")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items())
    )
    secret_key = hmac.new(
        b"WebAppData", config.BOT_TOKEN.encode(), hashlib.sha256,
    ).digest()
    expected_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(401, "Invalid hash")

    user_str = parsed.get("user")
    if not user_str:
        raise HTTPException(401, "Missing user")

    try:
        return json.loads(user_str)
    except json.JSONDecodeError:
        raise HTTPException(401, "Invalid user JSON")


async def get_current_user(
    x_telegram_init_data: str = Header(None),
    authorization: str = Header(None),
) -> dict:
    """
    Acepta AMBOS métodos de autenticación:
    - X-Telegram-Init-Data: cuando se abre desde Telegram (mini app)
    - Authorization: Bearer <token>: cuando se abre desde web normal
    """
    # Prioridad 1: Telegram initData (si está presente y no vacío)
    if x_telegram_init_data:
        return verify_init_data(x_telegram_init_data)

    # Prioridad 2: Bearer token (auth web)
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        try:
            import sys
            from pathlib import Path
            api_dir = str(Path(__file__).parent)
            if api_dir not in sys.path:
                sys.path.insert(0, api_dir)
            from web_auth import get_user_from_token
            user = await get_user_from_token(token)
            if user:
                return {
                    "id": user["user_id"],
                    "username": user.get("username"),
                    "first_name": user.get("first_name") or user.get("email", "Usuario"),
                }
        except ImportError:
            pass
        raise HTTPException(401, "Token inválido o expirado")

    raise HTTPException(401, "Missing initData o token")
