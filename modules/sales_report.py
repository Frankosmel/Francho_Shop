"""
Módulo de Reportes Semanales de Ventas y Notificaciones de Telegram para Francho Shop.

Calcula y compila:
1. Números Virtuales (SMS 5sim / Actives)
2. Recargas en Juegos (FZR / Free Fire / etc.)
3. Recargas BuffPin (Orders)
4. Pedidos Manuales & Saldo Móvil (Cubacel / Cuentas)
5. Comisiones de Plataforma (Marketplace)
6. Depósitos OxaPay y nuevos usuarios registrados
7. Conversión a CUP y margen neto global
"""

import asyncio
import datetime
import html
import logging
import time
import zoneinfo
import aiohttp
import aiosqlite

import config
from modules import settings

log = logging.getLogger("gamestore.sales_report")

CUBA_TZ = zoneinfo.ZoneInfo("America/Havana")


async def get_weekly_report_data(days: int = 7, end_ts: float | None = None) -> dict:
    """Genera las métricas consolidadas de ventas para el período especificado."""
    if end_ts is None:
        end_ts = time.time()
    start_ts = end_ts - (days * 86400)

    db_path = config.DB_PATH
    async with aiosqlite.connect(db_path) as conn:
        conn.row_factory = aiosqlite.Row

        # 1. SMS Orders
        async with conn.execute(
            """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'completed' THEN sell_price ELSE 0 END) as sell,
                SUM(CASE WHEN status = 'completed' THEN cost_price ELSE 0 END) as cost,
                SUM(CASE WHEN status = 'completed' THEN (sell_price - cost_price) ELSE 0 END) as profit
            FROM sms_orders
            WHERE created_at >= ? AND created_at <= ?
            """,
            (start_ts, end_ts),
        ) as cursor:
            sms_summary = await cursor.fetchone()

        async with conn.execute(
            """
            SELECT service, country, COUNT(*) as cnt, SUM(sell_price - cost_price) as profit
            FROM sms_orders
            WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
            GROUP BY service, country
            ORDER BY cnt DESC, profit DESC
            LIMIT 3
            """,
            (start_ts, end_ts),
        ) as cursor:
            top_sms = [dict(r) for r in await cursor.fetchall()]

        # 2. FZR Orders
        async with conn.execute(
            """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'completed' THEN sell_price ELSE 0 END) as sell,
                SUM(CASE WHEN status = 'completed' THEN cost_price ELSE 0 END) as cost,
                SUM(CASE WHEN status = 'completed' THEN (sell_price - cost_price) ELSE 0 END) as profit
            FROM fzr_orders
            WHERE created_at >= ? AND created_at <= ?
            """,
            (start_ts, end_ts),
        ) as cursor:
            fzr_summary = await cursor.fetchone()

        async with conn.execute(
            """
            SELECT product_name, COUNT(*) as cnt, SUM(sell_price - cost_price) as profit
            FROM fzr_orders
            WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
            GROUP BY product_name
            ORDER BY cnt DESC, profit DESC
            LIMIT 3
            """,
            (start_ts, end_ts),
        ) as cursor:
            top_fzr = [dict(r) for r in await cursor.fetchall()]

        # 3. Orders (BuffPin / otros)
        async with conn.execute(
            """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN order_status = 2 THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN order_status = 2 THEN sell_price ELSE 0 END) as sell,
                SUM(CASE WHEN order_status = 2 THEN cost_price ELSE 0 END) as cost,
                SUM(CASE WHEN order_status = 2 THEN (sell_price - cost_price) ELSE 0 END) as profit
            FROM orders
            WHERE created_at >= ? AND created_at <= ?
            """,
            (start_ts, end_ts),
        ) as cursor:
            orders_summary = await cursor.fetchone()

        async with conn.execute(
            """
            SELECT product_name, COUNT(*) as cnt, SUM(sell_price - cost_price) as profit
            FROM orders
            WHERE created_at >= ? AND created_at <= ? AND order_status = 2
            GROUP BY product_name
            ORDER BY cnt DESC, profit DESC
            LIMIT 3
            """,
            (start_ts, end_ts),
        ) as cursor:
            top_orders = [dict(r) for r in await cursor.fetchall()]

        # 4. Manual Orders
        async with conn.execute(
            """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END) as sell
            FROM manual_orders
            WHERE created_at >= ? AND created_at <= ?
            """,
            (start_ts, end_ts),
        ) as cursor:
            manual_summary = await cursor.fetchone()

        async with conn.execute(
            """
            SELECT mp.name as prod_name, mo.option_name, COUNT(*) as cnt, SUM(mo.price) as total_sell
            FROM manual_orders mo
            JOIN manual_products mp ON mo.product_id = mp.id
            WHERE mo.created_at >= ? AND mo.created_at <= ? AND mo.status = 'completed'
            GROUP BY mp.name, mo.option_name
            ORDER BY cnt DESC
            LIMIT 3
            """,
            (start_ts, end_ts),
        ) as cursor:
            top_manual = [dict(r) for r in await cursor.fetchall()]

        # 5. Platform Fees
        async with conn.execute(
            """
            SELECT SUM(platform_fee) as fee
            FROM seller_wallet_movements
            WHERE created_at >= ? AND created_at <= ?
            """,
            (start_ts, end_ts),
        ) as cursor:
            fee_row = await cursor.fetchone()

        # 6. Deposits
        async with conn.execute(
            """
            SELECT COUNT(*) as cnt, SUM(amount_usd) as total
            FROM deposits
            WHERE created_at >= ? AND created_at <= ? AND status = 'paid'
              AND deposit_id NOT LIKE 'DEP-MIGRATE%'
            """,
            (start_ts, end_ts),
        ) as cursor:
            dep_summary = await cursor.fetchone()

        # 7. Nuevos Usuarios
        async with conn.execute(
            "SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at <= ?",
            (start_ts, end_ts),
        ) as cursor:
            new_users_row = await cursor.fetchone()
            new_users = new_users_row[0] if new_users_row else 0

    # Tasa CUP configurada (prioridad: weekly_report_cup_rate > cup_usdt_purchase_price > 940)
    cup_rate_val = await settings.get("weekly_report_cup_rate")
    if not cup_rate_val:
        cup_rate_val = await settings.get("cup_usdt_purchase_price", "940")
    try:
        cup_rate = float(cup_rate_val or 940.0)
    except (ValueError, TypeError):
        cup_rate = 940.0

    # Extracción de valores
    sms_c = sms_summary["completed"] or 0 if sms_summary else 0
    sms_tot = sms_summary["total"] or 0 if sms_summary else 0
    sms_s = sms_summary["sell"] or 0.0 if sms_summary else 0.0
    sms_cost = sms_summary["cost"] or 0.0 if sms_summary else 0.0
    sms_p = sms_summary["profit"] or 0.0 if sms_summary else 0.0

    fzr_c = fzr_summary["completed"] or 0 if fzr_summary else 0
    fzr_tot = fzr_summary["total"] or 0 if fzr_summary else 0
    fzr_s = fzr_summary["sell"] or 0.0 if fzr_summary else 0.0
    fzr_cost = fzr_summary["cost"] or 0.0 if fzr_summary else 0.0
    fzr_p = fzr_summary["profit"] or 0.0 if fzr_summary else 0.0

    ord_c = orders_summary["completed"] or 0 if orders_summary else 0
    ord_tot = orders_summary["total"] or 0 if orders_summary else 0
    ord_s = orders_summary["sell"] or 0.0 if orders_summary else 0.0
    ord_cost = orders_summary["cost"] or 0.0 if orders_summary else 0.0
    ord_p = orders_summary["profit"] or 0.0 if orders_summary else 0.0

    man_c = manual_summary["completed"] or 0 if manual_summary else 0
    man_tot = manual_summary["total"] or 0 if manual_summary else 0
    man_s = manual_summary["sell"] or 0.0 if manual_summary else 0.0

    plat_fees = fee_row["fee"] or 0.0 if fee_row else 0.0
    dep_c = dep_summary["cnt"] or 0 if dep_summary else 0
    dep_amount = dep_summary["total"] or 0.0 if dep_summary else 0.0

    total_gross_sales = sms_s + fzr_s + ord_s + man_s
    total_provider_costs = sms_cost + fzr_cost + ord_cost
    total_net_profit = sms_p + fzr_p + ord_p + plat_fees
    total_completed = sms_c + fzr_c + ord_c + man_c
    margin_pct = (total_net_profit / total_gross_sales * 100) if total_gross_sales > 0 else 0.0

    # Fechas formateadas en hora local
    dt_start = datetime.datetime.fromtimestamp(start_ts, CUBA_TZ)
    dt_end = datetime.datetime.fromtimestamp(end_ts, CUBA_TZ)

    return {
        "start_ts": start_ts,
        "end_ts": end_ts,
        "days": days,
        "start_str": dt_start.strftime("%d/%m/%Y"),
        "end_str": dt_end.strftime("%d/%m/%Y"),
        "total_gross_sales": total_gross_sales,
        "total_provider_costs": total_provider_costs,
        "total_net_profit": total_net_profit,
        "total_completed": total_completed,
        "margin_pct": margin_pct,
        "cup_rate": cup_rate,
        "total_gross_sales_cup": total_gross_sales * cup_rate,
        "total_net_profit_cup": total_net_profit * cup_rate,
        "sms": {
            "completed": sms_c,
            "total": sms_tot,
            "sales": sms_s,
            "cost": sms_cost,
            "profit": sms_p,
            "top": top_sms,
        },
        "fzr": {
            "completed": fzr_c,
            "total": fzr_tot,
            "sales": fzr_s,
            "cost": fzr_cost,
            "profit": fzr_p,
            "top": top_fzr,
        },
        "orders": {
            "completed": ord_c,
            "total": ord_tot,
            "sales": ord_s,
            "cost": ord_cost,
            "profit": ord_p,
            "top": top_orders,
        },
        "manual": {
            "completed": man_c,
            "total": man_tot,
            "sales": man_s,
            "top": top_manual,
        },
        "platform_fees": plat_fees,
        "deposits": {
            "count": dep_c,
            "amount": dep_amount,
        },
        "new_users": new_users,
    }


def format_weekly_report_html(data: dict) -> str:
    """Convierte los datos del reporte en un mensaje HTML para Telegram."""
    start = data["start_str"]
    end = data["end_str"]
    sales = data["total_gross_sales"]
    sales_cup = data["total_gross_sales_cup"]
    costs = data["total_provider_costs"]
    profit = data["total_net_profit"]
    profit_cup = data["total_net_profit_cup"]
    margin = data["margin_pct"]
    orders_cnt = data["total_completed"]
    rate = data["cup_rate"]

    lines = [
        "📊 <b>REPORTE SEMANAL DE VENTAS — FRANCHO SHOP</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"📅 <b>Período:</b> {start} ➔ {end} ({data['days']} días)",
        "",
        "💰 <b>RESUMEN FINANCIERO:</b>",
        f"• 💵 <b>Ventas Totales:</b> <code>${sales:.2f} USDT</code> (~<code>{sales_cup:,.0f} CUP</code>)",
        f"• 📉 <b>Costos Proveedor:</b> <code>${costs:.2f} USDT</code>",
        f"• ✨ <b>GANANCIA NETA:</b> <b>+${profit:.2f} USDT</b> (~<code>{profit_cup:,.0f} CUP</code>)",
        f"• 📈 <b>Margen Neto:</b> <b>{margin:.1f}%</b>",
        f"• 📦 <b>Pedidos Completados:</b> <b>{orders_cnt} órdenes</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "📱 <b>NÚMEROS VIRTUALES (SMS):</b>",
        f"• Completados: <b>{data['sms']['completed']}</b> / {data['sms']['total']}",
        f"• Ventas: <b>${data['sms']['sales']:.2f}</b> | Costo: <b>${data['sms']['cost']:.2f}</b>",
        f"• Ganancia Neta: <b>+${data['sms']['profit']:.2f} USDT</b>",
    ]

    if data["sms"]["top"]:
        top_items = []
        for item in data["sms"]["top"]:
            svc = html.escape(str(item.get("service") or "?").capitalize())
            cntry = html.escape(str(item.get("country") or "?").upper())
            cnt = item.get("cnt", 0)
            top_items.append(f"{svc} ({cntry} x{cnt})")
        lines.append(f"• <i>Top servicios:</i> {', '.join(top_items)}")

    lines.extend([
        "",
        "🎮 <b>RECARGAS EN JUEGOS (AUTOMÁTICAS):</b>",
        f"• Completados: <b>{data['fzr']['completed']}</b> órdenes",
        f"• Ventas: <b>${data['fzr']['sales']:.2f}</b> | Costo: <b>${data['fzr']['cost']:.2f}</b>",
        f"• Ganancia Neta: <b>+${data['fzr']['profit']:.2f} USDT</b>",
    ])

    if data["fzr"]["top"]:
        top_items = []
        for item in data["fzr"]["top"]:
            pname = html.escape(str(item.get("product_name") or "?"))
            cnt = item.get("cnt", 0)
            top_items.append(f"{pname} (x{cnt})")
        lines.append(f"• <i>Top recargas:</i> {', '.join(top_items)}")

    if data["orders"]["completed"] > 0:
        lines.extend([
            "",
            "🕹️ <b>OTRAS RECARGAS (BUFFPIN):</b>",
            f"• Completados: <b>{data['orders']['completed']}</b>",
            f"• Ventas: <b>${data['orders']['sales']:.2f}</b> | Ganancia: <b>+${data['orders']['profit']:.2f} USDT</b>",
        ])

    lines.extend([
        "",
        "📦 <b>PEDIDOS MANUALES & SERVICIOS:</b>",
        f"• Completados: <b>{data['manual']['completed']}</b> órdenes",
        f"• Volumen Bruto: <b>${data['manual']['sales']:.2f} USDT</b>",
    ])

    if data["platform_fees"] > 0:
        lines.append(f"• Comisiones Marketplace: <b>+${data['platform_fees']:.2f} USDT</b>")

    if data["manual"]["top"]:
        top_items = []
        for item in data["manual"]["top"]:
            pname = html.escape(str(item.get("prod_name") or "?"))
            opt = html.escape(str(item.get("option_name") or ""))
            cnt = item.get("cnt", 0)
            label = f"{pname} - {opt}" if opt and opt != pname else pname
            top_items.append(f"{label} (x{cnt})")
        lines.append(f"• <i>Top entregas:</i> {', '.join(top_items)}")

    lines.extend([
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "💳 <b>MOVIMIENTOS & CRECIMIENTO:</b>",
        f"• 📥 <b>Depósitos OxaPay:</b> {data['deposits']['count']} recargas (<b>${data['deposits']['amount']:.2f} USDT</b>)",
        f"• 👤 <b>Nuevos Registros:</b> <b>{data['new_users']} clientes</b>",
        f"• 💱 <b>Tasa CUP estimada:</b> 1 USDT ≈ {rate:,.0f} CUP",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "⚡ <i>Francho Shop Analytics Engine</i>",
    ])

    return "\n".join(lines)


async def send_telegram_html(chat_id: int, text: str, timeout: int = 15) -> bool:
    """Envía un mensaje formateado en HTML a un chat_id de Telegram."""
    bot_token = config.BOT_TOKEN
    if not bot_token:
        log.warning("No se puede enviar mensaje por Telegram: BOT_TOKEN vacío")
        return False
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": int(chat_id), "text": text, "parse_mode": "HTML"},
                timeout=aiohttp.ClientTimeout(total=timeout),
            ) as resp:
                if resp.status >= 400:
                    err_txt = await resp.text()
                    log.warning("Fallo al enviar reporte a %s (HTTP %s): %s", chat_id, resp.status, err_txt)
                    return False
        return True
    except Exception as e:
        log.warning("Error enviando reporte por Telegram a %s: %s", chat_id, e)
        return False


async def get_report_recipients(custom_ids: list[int] | None = None) -> list[int]:
    """Obtiene los IDs de Telegram de los administradores que deben recibir el reporte."""
    recipients = {int(x) for x in getattr(config, "ADMIN_IDS", []) if x}
    try:
        async with aiosqlite.connect(config.DB_PATH) as conn:
            async with conn.execute("SELECT user_id FROM users WHERE role = 'admin' AND user_id > 0") as c:
                recipients.update(int(r[0]) for r in await c.fetchall() if r[0])
    except Exception as e:
        log.warning("Error leyendo admins desde la DB: %s", e)

    if custom_ids:
        for uid in custom_ids:
            try:
                if int(uid) > 0:
                    recipients.add(int(uid))
            except Exception:
                pass

    return sorted(recipients)


async def send_weekly_sales_report(
    target_ids: list[int] | None = None,
    days: int = 7,
    update_last_sent: bool = True,
) -> dict:
    """
    Compila el reporte semanal, lo envía por Telegram a los administradores y actualiza el timestamp.
    """
    data = await get_weekly_report_data(days=days)
    report_html = format_weekly_report_html(data)

    recipients = await get_report_recipients(target_ids)
    if not recipients:
        return {"ok": False, "error": "No hay administradores configurados para recibir el reporte", "data": data}

    successful = []
    failed = []

    for chat_id in recipients:
        ok = await send_telegram_html(chat_id, report_html)
        if ok:
            successful.append(chat_id)
        else:
            failed.append(chat_id)

    if update_last_sent and successful:
        await settings.set_value("last_weekly_report_sent", str(int(time.time())))

    return {
        "ok": len(successful) > 0,
        "recipients": successful,
        "failed": failed,
        "data": data,
        "html": report_html,
    }
