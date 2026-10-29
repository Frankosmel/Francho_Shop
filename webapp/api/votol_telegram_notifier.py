import os
import json
import logging
from pathlib import Path
from typing import Optional, List
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("votol.telegram")

router = APIRouter(prefix="/api/votol/telegram", tags=["votol_telegram"])

BOT_TOKEN = "8226778403:AAHBvMyFEaUIi8T1ne1XWCxECZ28ioHyYlw"
API_BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"

CHANNEL_ID = -1003666178109  # @votol_tuning_pro
GROUP_ID = -1002655854713    # @VOTOL_TUNING_PR0

APK_DEFAULT_PATH = Path("/home/ubuntu/gamestore/webapp/frontend/dist/VotolTuningPro.apk")
BANNER_DEFAULT_PATH = Path("/home/ubuntu/VotolConfigurator/app/src/main/res/drawable/ic_votol_logo.png")

class PublishReleaseRequest(BaseModel):
    version: str = "1.4.0"
    build_number: Optional[int] = 5
    title: Optional[str] = None
    changelog: List[str] = []
    notes: Optional[str] = None
    target: str = "channel" # 'channel', 'group', 'both'
    upload_apk: bool = True

def build_release_message(
    version: str,
    build_number: Optional[int] = None,
    title: Optional[str] = None,
    changelog: Optional[List[str]] = None,
    notes: Optional[str] = None
) -> str:
    h_title = title or f"🚀 <b>¡NUEVA VERSIÓN: VOTOL TUNING PRO v{version}!</b>"
    build_str = f" <i>(Build {build_number})</i>" if build_number else ""

    lines = [
        h_title + build_str,
        "",
        "⚡ <b>La mejor herramienta para calibrar tu controladora Votol desde Android.</b>",
        ""
    ]

    if changelog and len(changelog) > 0:
        lines.append("📋 <b>Novedades y Mejoras:</b>")
        for item in changelog:
            clean_item = item.strip()
            if not clean_item.startswith(("•", "-", "✅", "🚀", "🛡️", "🔘", "🤖", "🔌", "🚫", "⚡", "🔄", "🔍", "⚠️")):
                clean_item = f"• {clean_item}"
            lines.append(f"{clean_item}")
        lines.append("")

    if notes and notes.strip():
        lines.append(f"💡 <i>{notes.strip()}</i>")
        lines.append("")

    apk_link = f"https://franchoshop.reenvioplusbot.xyz/VotolTuningPro.apk?v={version}"
    lines.append(f"📲 <b>Descarga Directa:</b> <a href=\"{apk_link}\">VotolTuningPro-v{version}.apk</a>")
    lines.append("")
    lines.append("📢 <b>Canal Oficial:</b> @votol_tuning_pro")
    lines.append("👥 <b>Grupo de Soporte:</b> @VOTOL_TUNING_PR0")

    return "\n".join(lines)

def build_inline_keyboard(version: str) -> dict:
    apk_link = f"https://franchoshop.reenvioplusbot.xyz/VotolTuningPro.apk?v={version}"
    return {
        "inline_keyboard": [
            [
                {"text": f"📲 Descargar APK v{version}", "url": apk_link}
            ],
            [
                {"text": "👥 Grupo de Soporte & Comunidad", "url": "https://t.me/VOTOL_TUNING_PR0"},
                {"text": "📢 Canal Oficial", "url": "https://t.me/votol_tuning_pro"}
            ]
        ]
    }

async def send_telegram_release(
    version: str,
    build_number: Optional[int] = None,
    title: Optional[str] = None,
    changelog: Optional[List[str]] = None,
    notes: Optional[str] = None,
    target: str = "channel",
    upload_apk: bool = True
) -> dict:
    targets = []
    if target in ("channel", "both"):
        targets.append(CHANNEL_ID)
    if target in ("group", "both"):
        targets.append(GROUP_ID)

    if not targets:
        targets = [CHANNEL_ID]

    text = build_release_message(version, build_number, title, changelog, notes)
    keyboard = build_inline_keyboard(version)

    results = []
    async with httpx.AsyncClient(timeout=90.0) as client:
        for chat_id in targets:
            msg_sent = False
            # 1. Enviar Banner visual
            if BANNER_DEFAULT_PATH.exists():
                try:
                    if len(text) <= 1024:
                        # Si cabe en el caption de la foto (<=1024 caracteres)
                        with open(BANNER_DEFAULT_PATH, "rb") as pf:
                            files = {"photo": ("banner.png", pf, "image/png")}
                            data = {
                                "chat_id": chat_id,
                                "caption": text,
                                "parse_mode": "HTML",
                                "reply_markup": json.dumps(keyboard)
                            }
                            resp = await client.post(f"{API_BASE}/sendPhoto", data=data, files=files)
                            res_json = resp.json()
                            if res_json.get("ok"):
                                msg_sent = True
                                results.append({"chat_id": chat_id, "mode": "photo", "ok": True, "result": res_json})
                            else:
                                logger.warning(f"sendPhoto failed: {res_json}")
                    else:
                        # Si excede 1024 caracteres, enviar foto primero y luego el mensaje de texto completo
                        with open(BANNER_DEFAULT_PATH, "rb") as pf:
                            files = {"photo": ("banner.png", pf, "image/png")}
                            data = {
                                "chat_id": chat_id,
                                "caption": f"🚀 <b>Votol Tuning Pro v{version}</b> <i>(Build {build_number or 5})</i>",
                                "parse_mode": "HTML"
                            }
                            await client.post(f"{API_BASE}/sendPhoto", data=data, files=files)
                except Exception as e:
                    logger.error(f"[TELEGRAM PHOTO UPLOAD ERROR] {e}")

            # 2. Si no se envió el texto con la foto (porque era largo o falló la foto), enviar mensaje completo
            if not msg_sent:
                try:
                    data = {
                        "chat_id": chat_id,
                        "text": text,
                        "parse_mode": "HTML",
                        "disable_web_page_preview": False,
                        "reply_markup": keyboard
                    }
                    resp = await client.post(f"{API_BASE}/sendMessage", json=data)
                    res_json = resp.json()
                    results.append({"chat_id": chat_id, "mode": "message", "ok": res_json.get("ok", False), "result": res_json})
                except Exception as e:
                    logger.error(f"[TELEGRAM MESSAGE ERROR] {e}")

            # 3. Enviar APK físico directamente si existe y se solicitó
            if upload_apk and APK_DEFAULT_PATH.exists():
                try:
                    with open(APK_DEFAULT_PATH, "rb") as f:
                        files = {
                            "document": (f"VotolTuningPro-v{version}.apk", f, "application/vnd.android.package-archive")
                        }
                        apk_caption = f"📦 <b>VotolTuningPro-v{version}.apk</b> <i>(Build {build_number or 5})</i>\n\nInstalador directo para Android."
                        data = {
                            "chat_id": chat_id,
                            "caption": apk_caption,
                            "parse_mode": "HTML"
                        }
                        resp = await client.post(f"{API_BASE}/sendDocument", data=data, files=files)
                        res_json = resp.json()
                        results.append({"chat_id": chat_id, "mode": "document", "ok": res_json.get("ok", False), "result": res_json})
                except Exception as e:
                    logger.error(f"[TELEGRAM APK UPLOAD ERROR] {e}")

    all_ok = all(r.get("ok") for r in results)
    return {"success": all_ok, "results": results}

@router.get("/bot-info")
async def get_bot_info():
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r_me = await client.get(f"{API_BASE}/getMe")
            r_channel = await client.get(f"{API_BASE}/getChat?chat_id={CHANNEL_ID}")
            r_group = await client.get(f"{API_BASE}/getChat?chat_id={GROUP_ID}")
            r_chan_count = await client.get(f"{API_BASE}/getChatMemberCount?chat_id={CHANNEL_ID}")
            r_grp_count = await client.get(f"{API_BASE}/getChatMemberCount?chat_id={GROUP_ID}")

            return {
                "success": True,
                "bot": r_me.json().get("result"),
                "channel": {
                    "info": r_channel.json().get("result"),
                    "members": r_chan_count.json().get("result")
                },
                "group": {
                    "info": r_group.json().get("result"),
                    "members": r_grp_count.json().get("result")
                }
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/publish-release")
async def api_publish_release(req: PublishReleaseRequest):
    try:
        res = await send_telegram_release(
            version=req.version,
            build_number=req.build_number,
            title=req.title,
            changelog=req.changelog,
            notes=req.notes,
            target=req.target,
            upload_apk=req.upload_apk
        )
        return res
    except Exception as e:
        logger.error(f"[VOTOL TELEGRAM PUBLISH ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
