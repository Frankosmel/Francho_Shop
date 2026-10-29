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

async def send_email_ex(
    to: str,
    subject: str,
    html_body: str,
    smtp_user: str = None,
    smtp_pass: str = None,
    smtp_host: str = None,
    smtp_port: int = None,
    sender_name: str = None,
) -> tuple[bool, str]:
    """Envía un email usando SMTP (Gmail) y retorna (éxito, mensaje_error)."""
    user = smtp_user or await settings_mod.get("smtp_user")
    raw_pass = smtp_pass if smtp_pass is not None else await settings_mod.get("smtp_password")
    pw = (raw_pass or "").replace(" ", "").strip()
    host = smtp_host or await settings_mod.get("smtp_host") or "smtp.gmail.com"
    port = smtp_port or int(await settings_mod.get("smtp_port") or "587")
    s_name = sender_name or await settings_mod.get("smtp_sender_name") or await settings_mod.get("brand_name") or "Francho Shop"

    if not user or not pw:
        return False, "SMTP no configurado (falta correo Gmail o contraseña de aplicación)"

    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart()
        msg["From"] = f"{s_name} <{user}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            msg, hostname=host, port=port,
            username=user, password=pw,
            start_tls=True, timeout=15,
        )
        return True, ""
    except Exception as e:
        err = str(e)
        if "Username and Password not accepted" in err or "535" in err or "BadCredentials" in err:
            err = "Google rechazó las credenciales. Comprueba que sea una Contraseña de Aplicación de 16 caracteres de Google y no tu clave común."
        print(f"[email] Error enviando a {to}: {err}")
        return False, err


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """Envía un email usando la config SMTP guardada en settings."""
    enabled = await settings_mod.get_bool("smtp_enabled")
    if not enabled:
        print(f"[email] SMTP deshabilitado, saltando envío a {to}")
        return False

    ok, _ = await send_email_ex(to, subject, html_body)
    return ok


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


async def resend_email_verification(email: str) -> tuple[bool, str]:
    """Genera y envía un código nuevo para verificar una cuenta pendiente."""
    email = email.strip().lower()
    if not is_valid_email(email):
        return False, "Email inválido"

    user = await db.get_user_by_email(email)
    # La respuesta no revela si existe una cuenta concreta.
    if user and not user.get("email_verified"):
        code = await db.create_email_code(email, "verify", ttl_minutes=60, user_id=user["user_id"])
        await send_email(
            to=email,
            subject="🛍 Nuevo código de verificación — Francho Shop",
            html_body=email_template(
                "Verifica tu email",
                "<p>Solicitaste un código nuevo para verificar tu cuenta de Francho Shop.</p>"
                "<p>Este código caduca en 60 minutos.</p>",
                code=code,
            ),
        )
    return True, "Si la cuenta está pendiente de verificación, recibirás un código nuevo."


async def login_with_email(email: str, password: str) -> tuple[bool, str, Optional[dict]]:
    """Login con email o username + password. Devuelve (ok, message, user_dict_or_None)."""
    identifier = email.strip()
    if is_valid_email(identifier):
        user = await db.get_user_by_email(identifier.lower())
    else:
        user = await db.get_user_by_username(identifier)
    if not user or not user.get("password_hash"):
        return False, "Email/Usuario o contraseña incorrectos", None
    if user.get("is_banned"):
        return False, "Cuenta suspendida", None
    if not verify_password(password, user["password_hash"]):
        return False, "Email/Usuario o contraseña incorrectos", None
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
    if user and user.get("is_banned"):
        return None
    return user


async def login_or_register_with_google(credential: str) -> tuple[bool, str, Optional[dict]]:
    """
    Verifica el token de Google y busca o crea el usuario en la BD.
    Devuelve (ok, message, user_dict_or_None).
    """
    if not credential:
        return False, "Credencial de Google no proporcionada", None

    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        import config

        client_id = getattr(config, "GOOGLE_CLIENT_ID", None) or os.getenv("GOOGLE_CLIENT_ID")
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id
        )
    except ValueError as e:
        print(f"[google-auth] Token inválido: {e}")
        return False, f"Token de Google inválido: {e}", None
    except Exception as e:
        print(f"[google-auth] Error verificando con Google: {e}")
        return False, f"Error al verificar credencial con Google: {e}", None

    google_id = str(idinfo.get("sub") or "").strip()
    email = str(idinfo.get("email") or "").strip().lower()
    name = str(idinfo.get("name") or idinfo.get("given_name") or (email.split("@")[0] if email else "Usuario")).strip()
    photo_url = str(idinfo.get("picture") or "").strip()

    if not google_id or not email:
        return False, "No se recibieron los datos mínimos de Google (ID o Email)", None

    user = await db.get_user_by_google_id(google_id)
    is_new_user = False
    if not user:
        user = await db.get_user_by_email(email)
        if user:
            await db.update_google_user_profile(user["user_id"], google_id, photo_url, name)
            user = await db.get_user(user["user_id"])
        else:
            user_res = await db.create_google_user(email=email, name=name, google_id=google_id, photo_url=photo_url)
            uid = user_res.get("user_id") if isinstance(user_res, dict) else user_res
            user = await db.get_user(uid)
            is_new_user = True

    if not user:
        return False, "No se pudo obtener o crear el usuario en la base de datos", None

    if user.get("is_banned"):
        return False, "Esta cuenta ha sido suspendida", None

    user["is_new_user"] = is_new_user

    # Si es una cuenta nueva o no tiene contraseña definida, enviar enlace para crear contraseña
    if is_new_user or not user.get("password_hash"):
        try:
            import urllib.parse
            code = await db.create_email_code(email, "reset_password", ttl_minutes=1440, user_id=user["user_id"])
            setup_link = f"https://franchoshop.com/?action=reset-password&email={urllib.parse.quote(email)}&code={code}"

            html_content = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b; background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #00C26F; margin: 0 0 8px 0; font-size: 22px;">🎉 ¡Bienvenido a Francho Shop!</h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0;">Tu cuenta ha sido creada exitosamente con Google</p>
                </div>
                
                <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                    Hola <strong>{name}</strong>,<br><br>
                    Te has conectado usando tu cuenta de Google (<strong>{email}</strong>). Para que también puedas iniciar sesión directamente con tu correo y contraseña en cualquier dispositivo (sin depender de Google), crea tu contraseña personal haciendo clic abajo:
                </p>

                <div style="text-align: center; margin: 28px 0;">
                    <a href="{setup_link}" style="background-color: #00C26F; color: #000000; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(0, 194, 111, 0.35);">
                        🔑 Crear mi Contraseña
                    </a>
                </div>

                <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px;">
                    <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0;">Código de verificación alternativo:</p>
                    <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #0f172a;">{code}</span>
                </div>

                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                    Si el botón no abre directamente, copia este enlace en tu navegador:<br>
                    <a href="{setup_link}" style="color: #0284c7; word-break: break-all;">{setup_link}</a>
                </p>
            </div>
            """

            await send_email(
                to=email,
                subject="🎉 Bienvenido a Francho Shop — Crea tu contraseña",
                html_body=email_template("Crea tu Contraseña", html_content)
            )
            print(f"[google-auth] Enlace de creación de contraseña enviado exitosamente a {email}")
        except Exception as e:
            print(f"[google-auth] Error al enviar email de contraseña para {email}: {e}")

    return True, "Login con Google exitoso", user

