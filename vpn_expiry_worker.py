#!/usr/bin/env python3
"""
Francho Shop — VPN Expiration Worker
Monitorea las órdenes de VPN (Normal y Gaming), calcula su fecha de vencimiento según el plan,
y al expirar remueve el peer en el servidor WireGuard para cortar la conexión inmediatamente.
"""

import sys
import os
import time
import re
import base64
import sqlite3
import subprocess
import logging
import signal

from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives import serialization

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger("vpn_expiry_worker")

DB_PATH = "/home/ubuntu/gamestore/gamestore.db"
SSH_KEY_PATH = "/home/ubuntu/.ssh/oracle_vpn.key"
ORACLE_HOST = "ubuntu@129.80.139.84"

RUNNING = True

def signal_handler(signum, frame):
    global RUNNING
    log.info("Señal de parada recibida. Terminando worker...")
    RUNNING = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def derive_pubkey_from_privkey(priv_b64: str) -> str:
    """Calcula la clave pública WireGuard a partir de la clave privada base64."""
    try:
        priv_bytes = base64.b64decode(priv_b64.strip())
        priv_key = x25519.X25519PrivateKey.from_private_bytes(priv_bytes)
        pub_bytes = priv_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        return base64.b64encode(pub_bytes).decode('ascii')
    except Exception as e:
        log.error("Error derivando clave publica: %s", e)
        return ""


def get_plan_duration_seconds(option_name: str, price: float) -> int:
    """Calcula la duración en segundos a partir del nombre de la opción o el precio."""
    opt_lower = (option_name or "").lower()
    
    if price == 0 or "gratis" in opt_lower or "1 dia" in opt_lower or "1 día" in opt_lower:
        return 86400  # 1 día = 24 horas
    if "año" in opt_lower or "anual" in opt_lower or "365" in opt_lower:
        return 365 * 86400
    if "3 mes" in opt_lower or "90 dia" in opt_lower or "90 día" in opt_lower or "trimestral" in opt_lower:
        return 90 * 86400
    if "1 mes" in opt_lower or "30 dia" in opt_lower or "30 día" in opt_lower or "mensual" in opt_lower or "popular" in opt_lower:
        return 30 * 86400
    if "15 dia" in opt_lower or "15 día" in opt_lower or "quincenal" in opt_lower:
        return 15 * 86400
    if "7 dia" in opt_lower or "7 día" in opt_lower or "semanal" in opt_lower:
        return 7 * 86400
    
    return 30 * 86400  # Fallback a 30 días


def remove_wireguard_peer(pubkey: str) -> bool:
    """Ejecuta comando SSH en el VPS de Oracle para remover el peer de WireGuard."""
    if not pubkey:
        return False
    try:
        cmd = [
            "ssh",
            "-i", SSH_KEY_PATH,
            "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=8",
            ORACLE_HOST,
            f"sudo wg set wg0 peer '{pubkey}' remove"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
        if res.returncode == 0:
            log.info("Peer WireGuard removido exitosamente: %s", pubkey)
            return True
        else:
            log.warning("Fallo al remover peer %s: %s", pubkey, res.stderr.strip())
            return False
    except Exception as e:
        log.error("Excepcion al conectar al VPS para remover peer %s: %s", pubkey, e)
        return False


def check_and_expire_vpns():
    """Busca pedidos VPN completados activos y expira aquellos que alcanzaron su fecha límite."""
    if not os.path.exists(DB_PATH):
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    now = time.time()

    # Buscar ordenes de VPN completadas que no esten ya marcadas como expiradas
    query = """
        SELECT mo.id, mo.user_id, mo.product_id, mo.price, mo.created_at,
               mo.option_name, mo.delivery_data, mo.admin_note,
               dsi.id as stock_item_id, dsi.status as stock_status, dsi.payload
        FROM manual_orders mo
        LEFT JOIN digital_stock_items dsi ON dsi.order_id = mo.id
        WHERE mo.product_id IN (33, 34)
          AND mo.status = 'completed'
          AND (mo.admin_note IS NULL OR mo.admin_note NOT LIKE '%Expirado%')
          AND mo.delivery_data IS NOT NULL
          AND mo.delivery_data != ''
    """

    cur.execute(query)
    orders = cur.fetchall()

    for row in orders:
        order_id = row["id"]
        user_id = row["user_id"]
        prod_id = row["product_id"]
        created_at = float(row["created_at"] or 0)
        option_name = row["option_name"] or ""
        price = float(row["price"] or 0)
        raw_conf = row["delivery_data"] or row["payload"] or ""

        duration_sec = get_plan_duration_seconds(option_name, price)
        deadline = created_at + duration_sec

        if now >= deadline:
            elapsed_hours = (now - created_at) / 3600
            log.info("Pedido #%d (%s, $%.2f) expiro (duracion: %ds, transcurrido: %.1fh)",
                     order_id, option_name, price, duration_sec, elapsed_hours)

            # Extraer la clave privada del config entregado
            priv_match = re.search(r'PrivateKey\s*=\s*([A-Za-z0-9+/=]+)', raw_conf)
            if priv_match:
                priv_key = priv_match.group(1).strip()
                pub_key = derive_pubkey_from_privkey(priv_key)
                if pub_key:
                    remove_wireguard_peer(pub_key)

            # Marcar el pedido y el stock en base de datos
            admin_note = f"Expirado automáticamente tras {int(duration_sec / 3600)}h de servicio"
            cur.execute("""
                UPDATE manual_orders
                SET admin_note = ?
                WHERE id = ?
            """, (admin_note, order_id))

            if row["stock_item_id"]:
                cur.execute("""
                    UPDATE digital_stock_items
                    SET status = 'expired'
                    WHERE id = ?
                """, (row["stock_item_id"],))

            # Notificar al usuario en su app
            prod_name = "VPN Gaming" if prod_id == 33 else "VPN Normal"
            notif_msg = f"Tu suscripción {prod_name} ({option_name}) ha finalizado. Puedes adquirir un nuevo plan en cualquier momento desde la tienda."
            cur.execute("""
                INSERT INTO notifications (user_id, type, title, message, related_order_id, url, is_read, created_at)
                VALUES (?, 'order_update', 'Suscripción VPN Vencida', ?, ?, '/vpn', 0, ?)
            """, (user_id, notif_msg, order_id, now))

            conn.commit()
            log.info("Pedido #%d marcado como expirado en la base de datos.", order_id)

    conn.close()


def main():
    log.info("Iniciando Francho Shop VPN Expiration Worker...")
    while RUNNING:
        try:
            check_and_expire_vpns()
        except Exception as e:
            log.error("Error en ciclo de verificacion: %s", e)
        time.sleep(60)
    log.info("Worker finalizado correctamente.")


if __name__ == "__main__":
    main()
