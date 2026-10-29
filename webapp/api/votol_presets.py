import os
import sqlite3
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Any
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger("votol.presets")

router = APIRouter(prefix="/api/votol/presets", tags=["votol_presets"])
VOTOL_DB = "/home/ubuntu/votol_licenses.db"

def _get_db():
    conn = sqlite3.connect(VOTOL_DB)
    conn.row_factory = sqlite3.Row
    return conn

class PresetItem(BaseModel):
    id: Optional[str] = None
    name: str = "Preset"
    description: Optional[str] = ""
    iconName: Optional[str] = "Speed"
    colorHex: Optional[str] = "#00E5FF"
    parameters: Optional[dict] = None
    isFactoryDefault: Optional[bool] = False
    createdAt: Optional[int] = None

class PresetsUploadRequest(BaseModel):
    hwid: str
    email: Optional[str] = ""
    client_name: Optional[str] = ""
    presets: List[Any] = []

@router.post("/sync")
async def sync_presets_upload(payload: PresetsUploadRequest):
    if not payload.hwid:
        raise HTTPException(status_code=400, detail="HWID es requerido")

    hwid_clean = payload.hwid.strip().upper()
    email_clean = (payload.email or "").strip().lower()
    client_name_clean = (payload.client_name or "").strip()

    presets_json_str = json.dumps(payload.presets, ensure_ascii=False)
    presets_count = len(payload.presets)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    conn = _get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO votol_user_presets (
                hwid, user_email, client_name, presets_json, presets_count, updated_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(hwid) DO UPDATE SET
                user_email = CASE WHEN excluded.user_email != '' THEN excluded.user_email ELSE votol_user_presets.user_email END,
                client_name = CASE WHEN excluded.client_name != '' THEN excluded.client_name ELSE votol_user_presets.client_name END,
                presets_json = excluded.presets_json,
                presets_count = excluded.presets_count,
                updated_at = excluded.updated_at
            """,
            (
                hwid_clean,
                email_clean,
                client_name_clean,
                presets_json_str,
                presets_count,
                now_iso,
                now_iso
            )
        )
        conn.commit()
        logger.info(f"Presets sincronizados en la nube para HWID: {hwid_clean} ({presets_count} presets)")
        return {
            "success": True,
            "hwid": hwid_clean,
            "presets_count": presets_count,
            "updated_at": now_iso
        }
    except Exception as e:
        logger.error(f"Error guardando presets para HWID {hwid_clean}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/sync")
async def sync_presets_download(hwid: str = Query(..., description="HWID del dispositivo"), email: Optional[str] = Query(None, description="Email del usuario opcional")):
    hwid_clean = hwid.strip().upper()
    email_clean = (email or "").strip().lower()

    conn = _get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM votol_user_presets WHERE hwid = ?", (hwid_clean,))
        row = cursor.fetchone()

        if not row and email_clean:
            cursor.execute("SELECT * FROM votol_user_presets WHERE user_email = ? AND user_email != '' ORDER BY id DESC LIMIT 1", (email_clean,))
            row = cursor.fetchone()

        if not row:
            return {
                "success": True,
                "found": False,
                "hwid": hwid_clean,
                "presets": [],
                "presets_count": 0,
                "updated_at": None
            }

        try:
            presets_list = json.loads(row["presets_json"])
        except Exception:
            presets_list = []

        return {
            "success": True,
            "found": True,
            "hwid": row["hwid"],
            "user_email": row["user_email"],
            "client_name": row["client_name"],
            "presets": presets_list,
            "presets_count": len(presets_list),
            "updated_at": row["updated_at"]
        }
    except Exception as e:
        logger.error(f"Error consultando presets para HWID {hwid_clean}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
