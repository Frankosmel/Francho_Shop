"""Verificación de initData de Telegram WebApp."""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from fastapi import HTTPException, Header

import config


def get_all_bot_tokens() -> list[str]:
    """Retorna el BOT_TOKEN central y todos los tokens de bots de revendedores activos."""
    tokens = []
    if getattr(config, "BOT_TOKEN", None):
        tokens.append(config.BOT_TOKEN.strip())
    try:
        import sqlite3
        conn = sqlite3.connect("/home/ubuntu/gamestore/gamestore.db")
        c = conn.cursor()
        c.execute("SELECT telegram_bot_token FROM reseller_web_stores WHERE telegram_bot_active = 1 AND telegram_bot_token IS NOT NULL")
        for row in c.fetchall():
            tok = (row[0] or "").strip()
            if tok and tok not in tokens:
                tokens.append(tok)
        conn.close()
    except Exception:
        pass
    return tokens


def verify_init_data(init_data: str, max_age_seconds: int = 86400) -> dict:
    """Valida el initData de Telegram contra el bot central o cualquier bot de revendedor activo."""
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

    valid = False
    tokens = get_all_bot_tokens()
    for token in tokens:
        secret_key = hmac.new(
            b"WebAppData", token.encode(), hashlib.sha256,
        ).digest()
        expected_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256,
        ).hexdigest()
        if hmac.compare_digest(expected_hash, received_hash):
            valid = True
            break

    if not valid:
        raise HTTPException(401, "Invalid hash")

    user_str = parsed.get("user")
    if not user_str:
        raise HTTPException(401, "Missing user")

    try:
        return json.loads(user_str)
    except json.JSONDecodeError:
        raise HTTPException(401, "Invalid user JSON")


def verify_telegram_widget_data(data: dict, max_age_seconds: int = 86400) -> dict:
    """
    Valida la firma criptográfica oficial del Telegram Login Widget
    según el protocolo oficial de Telegram (HMAC-SHA256 con SHA256(bot_token)).
    """
    if not data or not isinstance(data, dict):
        raise HTTPException(401, "Datos de autenticación de Telegram inválidos")

    data = dict(data)
    received_hash = data.pop("hash", None)
    if not received_hash:
        raise HTTPException(401, "Firma criptográfica de Telegram ausente")

    auth_date = int(data.get("auth_date", 0))
    if not auth_date or (time.time() - auth_date > max_age_seconds):
        raise HTTPException(401, "La autorización de Telegram ha expirado. Vuelve a intentarlo.")

    # El data_check_string de Telegram ordena alfabéticamente todas las claves recibidas
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data.items()) if v is not None and v != ""
    )

    tokens = get_all_bot_tokens()
    valid = False
    for token in tokens:
        secret_key = hashlib.sha256(token.encode()).digest()
        expected_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()
        if hmac.compare_digest(expected_hash, received_hash):
            valid = True
            break

    if not valid:
        raise HTTPException(401, "Firma de Telegram no válida o bot no autorizado")

    return data


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
        tg_user = verify_init_data(x_telegram_init_data)
        try:
            import database as db
            u_id = tg_user.get("id")
            if u_id and await db.is_banned(u_id):
                raise HTTPException(403, "Tu cuenta ha sido suspendida permanentemente.")
            u_db = await db.get_user(u_id) if u_id else None
            role = (u_db.get("role") if u_db else "customer")
            if u_id in getattr(config, "ADMIN_IDS", []):
                role = "admin"
            tg_user["role"] = role
            tg_user["user_id"] = u_id
            tg_user["email"] = u_db.get("email") if u_db else None
            tg_user["balance"] = float(u_db.get("balance") or 0.0) if u_db else 0.0
        except HTTPException:
            raise
        except Exception:
            pass
        return tg_user

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
                if user.get("is_banned"):
                    raise HTTPException(403, "Tu cuenta ha sido suspendida permanentemente.")
                u_id = user["user_id"]
                u_role = user.get("role") or "customer"
                if u_id in getattr(config, "ADMIN_IDS", []):
                    u_role = "admin"
                return {
                    "id": u_id,
                    "user_id": u_id,
                    "username": user.get("username"),
                    "first_name": user.get("first_name") or user.get("email", "Usuario"),
                    "role": u_role,
                    "email": user.get("email"),
                    "balance": float(user.get("balance") or 0.0),
                }
        except HTTPException:
            raise
        except ImportError:
            pass
        raise HTTPException(401, "Tu sesión ha expirado. Por favor inicia sesión nuevamente.")

    raise HTTPException(401, "Sesión requerida o expirada. Por favor inicia sesión.")


async def get_current_user_optional(
    x_telegram_init_data: str = Header(None),
    authorization: str = Header(None),
) -> dict | None:
    if not x_telegram_init_data and not authorization:
        return None
    try:
        return await get_current_user(x_telegram_init_data=x_telegram_init_data, authorization=authorization)
    except Exception:
        return None
