"""
Sistema de autenticación web para Francho Shop.
Soporta: email/password y sesiones token-based.
"""
import hashlib
import hmac
import os
import re
import secrets
import sys
import time
from pathlib import Path
from typing import Optional

# Asegurar que el directorio raíz del bot esté en el path
BOT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BOT_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_ROOT))

import database as db
from modules import settings as settings_mod

# Importación opcional de bcrypt (más seguro que sha256)
try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

# Patrón básico para email
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def is_valid_email(email: str) -> bool:
    return bool(email and EMAIL_RE.match(email.strip()))


def hash_password(password: str) -> str:
    """Hash de password. Usa bcrypt si está disponible, sino salt+sha256."""
    if HAS_BCRYPT:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"sha256${salt}${h}"


def verify_password(password: str, password_hash: str) -> bool:
    if not password or not password_hash:
        return False
    if password_hash.startswith("$2"):  # bcrypt
        if not HAS_BCRYPT:
            return False
        try:
            return bcrypt.checkpw(password.encode(), password_hash.encode())
        except Exception:
            return False
    if password_hash.startswith("sha256$"):
        try:
            _, salt, expected = password_hash.split("$", 2)
            actual = hashlib.sha256((salt + password).encode()).hexdigest()
            return hmac.compare_digest(actual, expected)
        except Exception:
            return False
    return False


def generate_session_token() -> str:
    """Token de sesión aleatorio (no necesita JWT, hacemos lookup en DB)."""
    return secrets.token_urlsafe(48)


# ════════════════════════════════════════════════════════
#   ENVÍO DE EMAILS (usando SMTP configurado en settings)
# ════════════════════════════════════════════════════════

async def send_email(to: str, subject: str, html_body: str) -> bool:
    """Envía un email usando la config SMTP guardada en settings."""
    smtp_user = await settings_mod.get("smtp_user")
    smtp_pass = await settings_mod.get("smtp_password")
    smtp_host = await settings_mod.get("smtp_host") or "smtp.gmail.com"
    smtp_port = int(await settings_mod.get("smtp_port") or "587")
    enabled = await settings_mod.get_bool("smtp_enabled")

    if not enabled or not smtp_user or not smtp_pass:
        print(f"[email] SMTP no configurado, saltando envío a {to}")
        return False

    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart()
        msg["From"] = f"Francho Shop <{smtp_user}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            msg, hostname=smtp_host, port=smtp_port,
            username=smtp_user, password=smtp_pass,
            start_tls=True, timeout=15,
        )
        return True
    except Exception as e:
        print(f"[email] Error enviando a {to}: {e}")
        return False


def email_template(title: str, body_html: str, code: str = None) -> str:
    """Template HTML para emails."""
    code_block = ""
    if code:
        code_block = f"""
        <div style="background: #f0f0f0; padding: 20px; text-align: center;
                    border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 12px;">Tu código:</p>
            <p style="margin: 10px 0 0; font-size: 32px; font-weight: bold;
                      letter-spacing: 8px; color: #4f46e5; font-family: monospace;">
                {code}
            </p>
        </div>
        """
    return f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h1 style="color: #4f46e5;">🛍 {title}</h1>
        {body_html}
        {code_block}
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #888; font-size: 12px;">
            Este email fue enviado por Francho Shop.<br>
            Si no solicitaste esta acción, ignora este mensaje.
        </p>
    </body></html>
    """


# ════════════════════════════════════════════════════════
#   FLUJOS DE AUTH
# ════════════════════════════════════════════════════════

async def register_with_email(email: str, password: str, name: str = None) -> tuple[bool, str, Optional[int]]:
    """
    Registra un nuevo usuario web con email + password.
    Devuelve (ok, message, user_id_or_None).
    """
    email = email.strip().lower()
    if not is_valid_email(email):
        return False, "Email inválido", None
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres", None

    existing = await db.get_user_by_email(email)
    if existing:
        return False, "Este email ya está registrado", None

    pwd_hash = hash_password(password)
    user_id = await db.create_web_user(email, pwd_hash, name)

    # Enviar código de verificación
    code = await db.create_email_code(email, "verify", ttl_minutes=60, user_id=user_id)
    await send_email(
        to=email,
        subject="🛍 Verifica tu email — Francho Shop",
        html_body=email_template(
            "Verifica tu email",
            "<p>¡Bienvenido a Francho Shop! Para activar tu cuenta, "
            "introduce este código en la página de verificación:</p>",
            code=code,
        ),
    )
    return True, "Cuenta creada. Revisa tu email para verificarla.", user_id


async def login_with_email(email: str, password: str) -> tuple[bool, str, Optional[dict]]:
    """Login con email + password. Devuelve (ok, message, user_dict_or_None)."""
    email = email.strip().lower()
    if not is_valid_email(email):
        return False, "Email inválido", None
    user = await db.get_user_by_email(email)
    if not user or not user.get("password_hash"):
        return False, "Email o contraseña incorrectos", None
    if user.get("is_banned"):
        return False, "Cuenta suspendida", None
    if not verify_password(password, user["password_hash"]):
        return False, "Email o contraseña incorrectos", None
    return True, "Login exitoso", user


async def request_password_reset(email: str) -> tuple[bool, str]:
    """Envía email con código para resetear contraseña."""
    email = email.strip().lower()
    if not is_valid_email(email):
        return False, "Email inválido"
    user = await db.get_user_by_email(email)
    # No revelamos si el email existe o no (seguridad)
    if user:
        code = await db.create_email_code(email, "reset_password", ttl_minutes=30, user_id=user["user_id"])
        await send_email(
            to=email,
            subject="🔒 Recuperar contraseña — Francho Shop",
            html_body=email_template(
                "Recuperar contraseña",
                "<p>Recibimos una solicitud para recuperar tu contraseña.</p>"
                "<p>Usa este código en la página de recuperación. Caduca en 30 minutos.</p>",
                code=code,
            ),
        )
    return True, "Si existe una cuenta con ese email, recibirás un código."


async def reset_password(email: str, code: str, new_password: str) -> tuple[bool, str]:
    """Cambia la contraseña usando el código enviado por email."""
    if len(new_password) < 8:
        return False, "La nueva contraseña debe tener al menos 8 caracteres"
    verification = await db.verify_email_code(code, email, "reset_password")
    if not verification:
        return False, "Código inválido o expirado"
    user = await db.get_user_by_email(email)
    if not user:
        return False, "Usuario no encontrado"
    pwd_hash = hash_password(new_password)
    await db.set_user_password(user["user_id"], pwd_hash)
    return True, "Contraseña actualizada. Ya puedes iniciar sesión."


async def verify_email(email: str, code: str) -> tuple[bool, str]:
    """Marca el email como verificado usando el código."""
    verification = await db.verify_email_code(code, email, "verify")
    if not verification:
        return False, "Código inválido o expirado"
    user = await db.get_user_by_email(email)
    if user:
        await db.set_user_email(user["user_id"], email, verified=True)
        return True, "Email verificado correctamente."
    return False, "Usuario no encontrado"


async def get_user_from_token(token: str) -> Optional[dict]:
    """Devuelve el user dict si el token es válido, sino None."""
    if not token:
        return None
    session = await db.get_session(token)
    if not session:
        return None
    user = await db.get_user(session["user_id"])
    return user
