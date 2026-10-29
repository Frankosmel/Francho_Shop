import os
import sqlite3
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger("votol.audit")

router = APIRouter(prefix="/api/votol/audit", tags=["votol_audit"])
VOTOL_DB = "/home/ubuntu/votol_licenses.db"

def _get_db():
    conn = sqlite3.connect(VOTOL_DB)
    conn.row_factory = sqlite3.Row
    return conn

class AuditEventItem(BaseModel):
    id: Optional[str] = None
    type: str = "INFO" # PARAM_CHANGE, WRITE_CONFIG, CONNECT, DISCONNECT, COMM_ERROR, CRASH, AI_QUERY
    severity: str = "INFO" # INFO, WARN, ERROR, CRITICAL
    title: str = ""
    details: str = ""
    params_snapshot: Optional[str] = None
    controller_model: Optional[str] = None
    timestamp: Optional[int] = None

class AuditBatchRequest(BaseModel):
    email: Optional[str] = None
    hwid: Optional[str] = None
    client_name: Optional[str] = None
    app_version: Optional[str] = "1.2.0"
    device_model: Optional[str] = None
    android_version: Optional[str] = None
    events: List[AuditEventItem] = []

@router.post("/log-batch")
async def receive_audit_batch(payload: AuditBatchRequest):
    if not payload.events:
        return {"success": True, "count": 0}

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    conn = _get_db()
    cursor = conn.cursor()

    inserted = 0
    try:
        for ev in payload.events:
            ev_time = now_iso
            if ev.timestamp and ev.timestamp > 0:
                try:
                    ev_time = datetime.fromtimestamp(ev.timestamp / 1000.0, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    ev_time = now_iso

            cursor.execute(
                """
                INSERT INTO votol_audit_logs (
                    user_email, client_name, hwid, app_version, device_model,
                    android_version, log_type, severity, title, details,
                    params_snapshot, controller_model, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.email or "",
                    payload.client_name or "",
                    payload.hwid or "",
                    payload.app_version or "1.2.0",
                    payload.device_model or "",
                    payload.android_version or "",
                    ev.type,
                    ev.severity.upper(),
                    ev.title,
                    ev.details,
                    ev.params_snapshot or "",
                    ev.controller_model or "",
                    ev_time
                )
            )
            inserted += 1

        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"[VOTOL AUDIT] Error inserting logs: {e}")
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    return {"success": True, "count": inserted}

@router.get("/logs")
async def get_audit_logs(
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    hwid: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    conn = _get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM votol_audit_logs WHERE 1=1"
    params = []

    if search:
        s = f"%{search}%"
        query += " AND (user_email LIKE ? OR client_name LIKE ? OR hwid LIKE ? OR title LIKE ? OR details LIKE ?)"
        params.extend([s, s, s, s, s])

    if type and type != "ALL":
        query += " AND log_type = ?"
        params.append(type)

    if severity and severity != "ALL":
        query += " AND severity = ?"
        params.append(severity.upper())

    if hwid:
        query += " AND hwid = ?"
        params.append(hwid)

    # Count total matching
    count_query = query.replace("SELECT *", "SELECT COUNT(*)")
    cursor.execute(count_query, params)
    total = cursor.fetchone()[0]

    # Order and paginate
    query += " ORDER BY id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()

    logs = []
    for r in rows:
        logs.append({
            "id": r["id"],
            "user_email": r["user_email"],
            "client_name": r["client_name"],
            "hwid": r["hwid"],
            "app_version": r["app_version"],
            "device_model": r["device_model"],
            "android_version": r["android_version"],
            "type": r["log_type"],
            "severity": r["severity"],
            "title": r["title"],
            "details": r["details"],
            "params_snapshot": r["params_snapshot"],
            "controller_model": r["controller_model"],
            "created_at": r["created_at"]
        })

    conn.close()
    return {"success": True, "total": total, "logs": logs}

@router.get("/stats")
async def get_audit_stats():
    conn = _get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM votol_audit_logs")
    total_logs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM votol_audit_logs WHERE severity IN ('ERROR', 'CRITICAL')")
    total_errors = cursor.fetchone()[0]

    today_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d") + "%"
    cursor.execute("SELECT COUNT(*) FROM votol_audit_logs WHERE created_at LIKE ?", (today_prefix,))
    today_logs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT hwid) FROM votol_audit_logs WHERE created_at LIKE ?", (today_prefix,))
    active_devices_today = cursor.fetchone()[0]

    # Count by type
    cursor.execute("SELECT log_type, COUNT(*) as c FROM votol_audit_logs GROUP BY log_type ORDER BY c DESC LIMIT 10")
    type_counts = {r["log_type"]: r["c"] for r in cursor.fetchall()}

    # Recent errors
    cursor.execute("SELECT * FROM votol_audit_logs WHERE severity IN ('ERROR', 'CRITICAL') ORDER BY id DESC LIMIT 5")
    recent_errors = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "success": True,
        "total_logs": total_logs,
        "total_errors": total_errors,
        "today_logs": today_logs,
        "active_devices_today": active_devices_today,
        "type_counts": type_counts,
        "recent_errors": recent_errors
    }

@router.delete("/logs")
async def delete_audit_logs(days_older: int = Query(30, ge=1)):
    conn = _get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM votol_audit_logs WHERE datetime(created_at) < datetime('now', ?)", (f"-{days_older} days",))
        deleted = cursor.rowcount
        conn.commit()
    finally:
        conn.close()
    return {"success": True, "deleted": deleted}
