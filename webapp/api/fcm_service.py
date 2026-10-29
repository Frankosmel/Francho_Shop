"""
FranchoShop — FCM Push Notification Service
Envía notificaciones push reales a dispositivos Android vía Firebase Cloud Messaging (FCM v1 API).

Configuración necesaria:
    1. Crear proyecto en https://console.firebase.google.com
    2. Agregar app Android con package: com.franchoshop.app
    3. Descargar google-services.json → ponerlo en android/app/
    4. En Firebase Console → Configuración del proyecto → Cuentas de servicio
       → Generar nueva clave privada → guardar como firebase-service-account.json
    5. Poner firebase-service-account.json en /home/ubuntu/gamestore/ (fuera del repo Git)
"""

import os
import json
import logging
import asyncio
import aiohttp
import aiosqlite
from pathlib import Path
from datetime import datetime, timezone

log = logging.getLogger("franchoshop.fcm")

# ── Configuración ──────────────────────────────────────────────────────────────
BOT_ROOT = Path(__file__).resolve().parent
GAMESTORE_DIR = BOT_ROOT.parent.parent
_raw_db = os.environ.get("DB_PATH")
if _raw_db and os.path.isabs(_raw_db):
    DB_PATH = _raw_db
else:
    DB_PATH = str(GAMESTORE_DIR / (_raw_db or "gamestore.db"))
SERVICE_ACCOUNT_PATH = os.environ.get("FIREBASE_SERVICE_ACCOUNT", str(GAMESTORE_DIR / "firebase-service-account.json"))
FCM_SEND_URL = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"

_access_token_cache: dict = {"token": None, "expires_at": 0}


# ── Token de acceso OAuth2 para FCM v1 API ────────────────────────────────────
async def _get_access_token() -> str:
    """Obtiene (y cachea) el token OAuth2 usando la cuenta de servicio Firebase."""
    import time
    now = time.time()
    if _access_token_cache["token"] and now < _access_token_cache["expires_at"] - 60:
        return _access_token_cache["token"]

    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        raise FileNotFoundError(
            f"Archivo de cuenta de servicio Firebase no encontrado: {SERVICE_ACCOUNT_PATH}\n"
            "Descárgalo desde Firebase Console → Configuración → Cuentas de servicio."
        )

    try:
        import google.oauth2.service_account
        import google.auth.transport.requests

        credentials = google.oauth2.service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_PATH,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"]
        )
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        _access_token_cache["token"] = credentials.token
        _access_token_cache["expires_at"] = credentials.expiry.timestamp() if credentials.expiry else now + 3600
        return credentials.token
    except ImportError:
        raise ImportError(
            "Instala: pip install google-auth\n"
            "Ejecuta: pip install google-auth --break-system-packages"
        )


def _get_project_id() -> str:
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        return ""
    with open(SERVICE_ACCOUNT_PATH) as f:
        sa = json.load(f)
    return sa.get("project_id", "")


# ── Enviar notificación a un token ────────────────────────────────────────────
async def send_push(token: str, title: str, body: str, data: dict = None, image_url: str = None) -> bool:
    """
    Envía una notificación push a un dispositivo Android específico.
    
    Args:
        token: FCM registration token del dispositivo
        title: Título de la notificación
        body: Texto del cuerpo
        data: Datos extra (ej: {"screen": "orders", "order_id": "123"})
        image_url: URL de imagen opcional para la notificación
    
    Returns:
        True si se envió correctamente, False en caso de error
    """
    try:
        project_id = _get_project_id()
        if not project_id:
            log.warning("[FCM] No hay project_id. ¿Configuraste firebase-service-account.json?")
            return False

        access_token = await _get_access_token()
        url = FCM_SEND_URL.format(project_id=project_id)

        message: dict = {
            "token": token,
            "notification": {
                "title": title,
                "body": body,
            },
            "android": {
                "priority": "high",
                "notification": {
                    "sound": "default",
                    "click_action": "FLUTTER_NOTIFICATION_CLICK",
                    "channel_id": "franchoshop_orders",
                    "color": "#22c55e",
                }
            }
        }

        if image_url:
            message["notification"]["image"] = image_url

        if data:
            # FCM data values must be strings
            message["data"] = {k: str(v) for k, v in (data or {}).items()}

        payload = {"message": message}

        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status == 200:
                    log.info(f"[FCM] ✅ Push enviado a token ...{token[-8:]}: {title}")
                    return True
                else:
                    error_body = await resp.text()
                    if "NOT_FOUND" in error_body or "UNREGISTERED" in error_body:
                        # Token inválido → eliminar de la base de datos
                        await _remove_invalid_token(token)
                        log.warning(f"[FCM] Token inválido eliminado: ...{token[-8:]}")
                    else:
                        log.error(f"[FCM] Error {resp.status}: {error_body[:200]}")
                    return False

    except FileNotFoundError as e:
        log.warning(f"[FCM] {e}")
        return False
    except Exception as e:
        log.error(f"[FCM] Error enviando push: {e}")
        return False


# ── Enviar a todos los tokens de un usuario ───────────────────────────────────
async def send_push_to_user(user_id: int, title: str, body: str, data: dict = None) -> int:
    """Envía push a TODOS los dispositivos registrados de un usuario. Retorna nº de envíos."""
    tokens = await get_user_fcm_tokens(user_id)
    if not tokens:
        return 0

    sent = 0
    for token in tokens:
        ok = await send_push(token, title, body, data)
        if ok:
            sent += 1
    return sent


# ── Enviar a todos los admins ─────────────────────────────────────────────────
async def send_push_to_admins(title: str, body: str, data: dict = None) -> int:
    """Envía push a todos los administradores registrados."""
    tokens = await get_admin_fcm_tokens()
    if not tokens:
        return 0
    sent = 0
    for token in tokens:
        ok = await send_push(token, title, body, data)
        if ok:
            sent += 1
    return sent


# ── DB helpers ────────────────────────────────────────────────────────────────
async def save_fcm_token(user_id: int, token: str, platform: str = "android") -> None:
    """Guarda o actualiza el token FCM de un dispositivo."""
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT INTO fcm_tokens (user_id, token, platform, updated_at)
            VALUES (?, ?, ?, unixepoch())
            ON CONFLICT(token) DO UPDATE SET
                user_id = excluded.user_id,
                platform = excluded.platform,
                updated_at = unixepoch(),
                revoked_at = NULL
        """, (user_id, token, platform))
        await conn.commit()
    log.info(f"[FCM] Token guardado para user_id={user_id}")


async def remove_fcm_token(token: str) -> None:
    """Marca un token como revocado (logout)."""
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute(
            "UPDATE fcm_tokens SET revoked_at = unixepoch() WHERE token = ?",
            (token,)
        )
        await conn.commit()


async def get_user_fcm_tokens(user_id: int) -> list[str]:
    """Retorna todos los tokens activos de un usuario."""
    async with aiosqlite.connect(DB_PATH) as conn:
        async with conn.execute(
            "SELECT token FROM fcm_tokens WHERE user_id = ? AND revoked_at IS NULL",
            (user_id,)
        ) as cur:
            rows = await cur.fetchall()
    return [r[0] for r in rows]


async def get_admin_fcm_tokens() -> list[str]:
    """Return active FCM tokens for the configured primary administrators."""
    try:
        import config
        admin_ids = [int(value) for value in (getattr(config, "ADMIN_IDS", []) or []) if value]
    except Exception:
        admin_ids = []
    if not admin_ids:
        return []
    placeholders = ", ".join("?" for _ in admin_ids)
    async with aiosqlite.connect(DB_PATH) as conn:
        async with conn.execute(
            f"SELECT token FROM fcm_tokens WHERE user_id IN ({placeholders}) AND revoked_at IS NULL",
            admin_ids,
        ) as cur:
            rows = await cur.fetchall()
    return [r[0] for r in rows]


async def _remove_invalid_token(token: str) -> None:
    """Elimina un token que Firebase reportó como inválido."""
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute(
            "UPDATE fcm_tokens SET revoked_at = unixepoch() WHERE token = ?",
            (token,)
        )
        await conn.commit()


# ── Notificaciones predefinidas ───────────────────────────────────────────────

async def notify_new_order(order_id: int, product_name: str, buyer_user_id: int,
                           amount: float, buyer_name: str = "") -> None:
    """Admin: nuevo pedido recibido."""
    await send_push_to_admins(
        title="🛒 Nuevo pedido",
        body=f"{buyer_name or 'Un cliente'} compró {product_name} — ${amount:.2f} USDT",
        data={"screen": "admin_orders", "order_id": str(order_id)}
    )


async def notify_order_completed(user_id: int, order_id: int, product_name: str) -> None:
    """Usuario: su pedido fue completado."""
    await send_push_to_user(
        user_id,
        title="✅ Pedido completado",
        body=f"Tu pedido de {product_name} está listo. ¡Revísalo ahora!",
        data={"screen": "my_orders", "order_id": str(order_id)}
    )


async def notify_order_failed(user_id: int, order_id: int, product_name: str) -> None:
    """Usuario: su pedido falló."""
    await send_push_to_user(
        user_id,
        title="❌ Pedido fallido",
        body=f"Tu pedido de {product_name} no pudo completarse. Contacta soporte.",
        data={"screen": "support", "order_id": str(order_id)}
    )


async def notify_deposit_confirmed(user_id: int, amount: float) -> None:
    """Usuario: depósito confirmado."""
    await send_push_to_user(
        user_id,
        title="💰 Depósito confirmado",
        body=f"Se acreditaron ${amount:.2f} USDT a tu saldo.",
        data={"screen": "wallet"}
    )


async def notify_new_support_message(user_id: int, order_id: int, from_admin: bool = False) -> None:
    """Nuevo mensaje en soporte."""
    if from_admin:
        # Notificar al usuario
        await send_push_to_user(
            user_id,
            title="💬 Soporte — nueva respuesta",
            body="El equipo de Francho Shop respondió tu caso.",
            data={"screen": "support", "order_id": str(order_id)}
        )
    else:
        # Notificar a los admins
        await send_push_to_admins(
            title="💬 Nuevo mensaje de soporte",
            body=f"Caso #{order_id} — el cliente envió un mensaje.",
            data={"screen": "admin_cases", "order_id": str(order_id)}
        )


async def notify_reseller_approved(user_id: int) -> None:
    """Usuario: solicitud de revendedor aprobada."""
    await send_push_to_user(
        user_id,
        title="🎉 ¡Revendedor aprobado!",
        body="Tu cuenta ya tiene acceso al panel de revendedores.",
        data={"screen": "reseller_panel"}
    )


async def notify_low_balance(user_id: int, balance: float) -> None:
    """Usuario: saldo bajo."""
    await send_push_to_user(
        user_id,
        title="⚠️ Saldo bajo",
        body=f"Tu saldo es ${balance:.2f} USDT. Recarga para seguir comprando.",
        data={"screen": "wallet"}
    )


async def notify_sms_code_received(user_id: int, service: str, code: str) -> None:
    """Usuario: código SMS recibido."""
    await send_push_to_user(
        user_id,
        title=f"📱 Código {service}",
        body=f"Tu código de verificación: {code}",
        data={"screen": "sms_orders"}
    )


async def notify_new_admin_deposit(admin_ids: list[int] = None, user_name: str = "",
                                   amount: float = 0.0, method: str = "") -> None:
    """Admin: un usuario hizo un depósito."""
    await send_push_to_admins(
        title="💵 Nuevo depósito recibido",
        body=f"{user_name or 'Un usuario'} depositó ${amount:.2f} USDT vía {method or 'Cripto'}",
        data={"screen": "admin_deposits"}
    )


async def notify_seller_new_sale(seller_id: int, order_id: int, product_name: str,
                                 amount: float, buyer_name: str = "") -> None:
    """Vendedor: nueva venta en sus productos."""
    if not seller_id:
        return
    await send_push_to_user(
        int(seller_id),
        title="🛍️ ¡Nueva venta realizada!",
        body=f"{buyer_name or 'Un cliente'} compró {product_name} — ${amount:.2f} USD",
        data={"screen": "seller_orders", "order_id": str(order_id), "url": f"/pedido/{order_id}/seguimiento?admin=true"}
    )


async def notify_cup_payment_verified(user_id: int, order_id: str, product_name: str = "") -> None:
    """Cliente: comprobante de pago CUP verificado y aprobado."""
    if not user_id:
        return
    await send_push_to_user(
        int(user_id),
        title="✅ Pago CUP Aprobado",
        body=f"El pago de tu pedido #{order_id} ({product_name}) ha sido verificado con éxito.",
        data={"screen": "my_orders", "order_id": str(order_id), "url": "/pedidos"}
    )


async def notify_cup_payment_rejected(user_id: int, order_id: str, reason: str = "") -> None:
    """Cliente: comprobante de pago CUP rechazado."""
    if not user_id:
        return
    reason_clean = (reason or "Comprobante no válido").strip()
    await send_push_to_user(
        int(user_id),
        title="❌ Pago CUP Rechazado",
        body=f"Tu pedido #{order_id} no pudo ser validado: {reason_clean}",
        data={"screen": "my_orders", "order_id": str(order_id), "url": "/pedidos"}
    )


async def notify_cup_payment_pending_admin(order_id: str, amount_cup: int, client_name: str = "") -> None:
    """Admin: nuevo comprobante de pago CUP subido para revisar."""
    await send_push_to_admins(
        title="💳 Comprobante CUP pendiente",
        body=f"{client_name or 'Cliente'} subió comprobante de {amount_cup:,} CUP para pedido #{order_id}",
        data={"screen": "admin_cup_payments", "order_id": str(order_id), "url": "/admin?tab=cup-payments"}
    )


async def notify_referral_reward(user_id: int, amount: float) -> None:
    """Usuario: comisión ganada por referido."""
    if not user_id:
        return
    await send_push_to_user(
        int(user_id),
        title="🎁 Recompensa por referido",
        body=f"¡Has ganado +${amount:.2f} USD por una compra recomendada!",
        data={"screen": "wallet"}
    )


async def notify_seller_hold_released(seller_id: int, amount: float = 0.0, order_id: int = None) -> None:
    """Vendedor: saldo retenido liberado al balance disponible."""
    if not seller_id:
        return
    body = (
        f"Se han liberado ${amount:.2f} USD a tu balance disponible."
        if amount > 0
        else (
            f"Se ha liberado el saldo de garantía del pedido #{order_id} a tu balance disponible."
            if order_id
            else "Se ha liberado saldo de garantía a tu balance disponible."
        )
    )
    await send_push_to_user(
        int(seller_id),
        title="🔓 Saldo retenido liberado",
        body=body,
        data={"screen": "wallet"}
    )


async def notify_seller_stock_alert(seller_id: int, product_name: str, available_stock: int) -> None:
    """Vendedor: alerta de inventario bajo."""
    if not seller_id:
        return
    await send_push_to_user(
        int(seller_id),
        title="⚠️ Stock bajo en inventario",
        body=f"{product_name} tiene solo {available_stock} unidades disponibles.",
        data={"screen": "seller_products", "url": "/partner"}
    )


async def notify_case_dispute(admin_or_seller_id: int, order_id: int, product_name: str = "", reason: str = "") -> None:
    """Admin o Vendedor: un caso fue escalado a disputa."""
    if not admin_or_seller_id:
        return
    await send_push_to_user(
        int(admin_or_seller_id),
        title="🚨 Caso escalado a mediación",
        body=f"El pedido #{order_id} ({product_name}) requiere atención en el chat.",
        data={"screen": "case", "order_id": str(order_id), "url": f"/pedido/{order_id}/seguimiento?admin=true"}
    )
