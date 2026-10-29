#!/usr/bin/env python3
"""
Script de Notificación / Broadcast para el lanzamiento de Tiendas Web y Mini Apps a $3 USDT/mes.
Permite previsualizar (--dry-run) o despachar masivamente vía Telegram Bot API.
"""

import sys
import os
import asyncio
import aiosqlite
import aiohttp

sys.path.insert(0, "/home/ubuntu/gamestore")
import config

BROADCAST_MESSAGE = """🚀 <b>¡ABRE TU PROPIA TIENDA WEB & BOT DE TELEGRAM!</b> 🚀

Ahora puedes tener tu propio negocio digital de recargas, juegos y suscripciones con Francho Shop por solo <b>$3.00 USDT al mes</b>.

✨ <b>¿Qué incluye tu Tienda PRO?</b>
• 🌐 <b>Tienda Web Personalizada:</b> Tu propio enlace exclusivo (ej: <code>franchoshop.com/s/tunombre</code>) o dominio propio.
• 🤖 <b>Telegram Mini App:</b> Conectada a tu propio bot de Telegram en 1 solo clic.
• 💎 <b>Precios Mayoristas Mínimos:</b> Acceso a nuestros costos VIP más bajos para que tú fijes tu propio margen de ganancia libremente.
• 💳 <b>Cobros 100% en USDT Automáticos:</b> Tus clientes pagan directo por OxaPay (cripto) y <b>tu ganancia neta se acumula al instante en tu saldo</b> de Francho Shop para retirarla cuando quieras.
• 📦 <b>Entregas 100% Automáticas:</b> Free Fire, Mobile Legends, Roblox, Steam, Netflix, Disney+, IPVanish, Números Virtuales SMS y más de 600 juegos.
• 🎨 <b>Personalización en Vivo:</b> Edita banners, colores y márgenes directamente sobre tu tienda con el Modo Dueño.

👉 <b>¿Cómo activarla?</b>
Inicia sesión en Francho Shop, ve a la pestaña <b>"Mi Tienda Web"</b> y actívala hoy mismo por solo <b>$3.00 USDT/mes</b>.

<i>¡Empieza a generar ingresos pasivos con tu propia marca hoy mismo!</i>"""

async def run_broadcast(dry_run=True):
    print(f"=== INICIANDO BROADCAST (dry_run={dry_run}) ===")
    bot_token = config.BOT_TOKEN
    if not bot_token:
        print("ERROR: BOT_TOKEN no configurado en config.py")
        return

    async with aiosqlite.connect("/home/ubuntu/gamestore/gamestore.db") as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT user_id, first_name, username FROM users WHERE auth_method='telegram' AND is_banned=0"
        ) as cur:
            users = [dict(r) for r in await cur.fetchall()]

    print(f"Usuarios elegibles para Telegram Broadcast: {len(users)}")
    if dry_run:
        print("\n--- VISTA PREVIA DEL MENSAJE ---")
        print(BROADCAST_MESSAGE)
        print("--------------------------------")
        print("Modo prueba finalizado. Para enviar a todos los usuarios reales ejecuta: python3 broadcast_webstore_launch.py --send")
        return

    sent = 0
    failed = 0
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    async with aiohttp.ClientSession() as session:
        for idx, u in enumerate(users):
            chat_id = u["user_id"]
            payload = {
                "chat_id": chat_id,
                "text": BROADCAST_MESSAGE,
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            }
            try:
                async with session.post(url, json=payload, timeout=10) as resp:
                    if resp.status == 200:
                        sent += 1
                    else:
                        failed += 1
                        err = await resp.text()
                        print(f"[{idx+1}/{len(users)}] Falló chat_id={chat_id}: {err[:80]}")
            except Exception as e:
                failed += 1
                print(f"[{idx+1}/{len(users)}] Excepción chat_id={chat_id}: {e}")

            # Rate limit preventivo (30 msgs/seg en Telegram)
            await asyncio.sleep(0.05)

    print(f"\n=== RESULTADOS: Enviados: {sent} | Fallidos o bloqueados: {failed} ===")

if __name__ == "__main__":
    is_send = "--send" in sys.argv
    asyncio.run(run_broadcast(dry_run=not is_send))
