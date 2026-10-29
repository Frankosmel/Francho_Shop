#!/usr/bin/env python3
import asyncio
import os
import subprocess
import sys
from pathlib import Path

# Raíz del proyecto
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import database as db
from webapp.api import web_auth

async def main():
    print("🔑 Generando sesiones temporales de auditoría...")
    admin_token = web_auth.generate_session_token()
    await db.create_session(admin_token, 1383931339, ttl_days=2)

    user_token = web_auth.generate_session_token()
    await db.create_session(user_token, -72, ttl_days=2)

    print(f"✅ Token Admin: {admin_token[:8]}...")
    print(f"✅ Token Cliente: {user_token[:8]}...")

    target = sys.argv[1] if len(sys.argv) > 1 else "phase2"
    if target == "all":
        scripts = ["audit_android_screens.js", "audit_android_screens_phase2.js"]
    elif target == "phase1":
        scripts = ["audit_android_screens.js"]
    else:
        scripts = ["audit_android_screens_phase2.js"]

    for script_name in scripts:
        js_script = ROOT / "tools" / script_name
        cmd = ["node", str(js_script), admin_token, user_token]
        print(f"\n🚀 Lanzando {script_name} (Android Pixel 7 Emulation)...")
        res = subprocess.run(cmd, cwd=str(ROOT))
        if res.returncode != 0:
            print(f"❌ Error ejecutando auditoría {script_name}: {res.returncode}")
            sys.exit(res.returncode)

    print("\n✅ Auditoría terminada exitosamente.")

if __name__ == "__main__":
    asyncio.run(main())
