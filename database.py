"""
Base de datos SQLite — Esquema completo V2.

Incluye:
- users (con role, ban, language)
- tenants (multi-tenant ready, aunque solo usamos master por ahora)
- orders (con platform_fee, reseller_profit)
- deposits (OxaPay)
- products_cache
- reseller_applications (solicitudes pendientes)
- balance_log (historial de movimientos)
- audit_log (acciones admin)
- coupons, favorites, cart, referrals (tablas V2 preservadas)
- settings (config dinámica)
- product_overrides (para ocultar/destacar/precio custom)
"""
import json
import logging
import time
import uuid

import aiosqlite

import config

log = logging.getLogger(__name__)
DB = config.DB_PATH


async def init_db():
    async with aiosqlite.connect(DB) as db:
        await db.executescript("""
            -- ═══════════════════════════════════════
            --   USUARIOS
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS users (
                user_id       INTEGER PRIMARY KEY,
                username      TEXT,
                first_name    TEXT,
                display_name  TEXT,
                photo_url     TEXT,
                language      TEXT DEFAULT 'es',
                role          TEXT DEFAULT 'user',       -- user/reseller/admin
                balance       REAL DEFAULT 0.0,
                total_spent   REAL DEFAULT 0.0,
                total_deposit REAL DEFAULT 0.0,
                is_banned     INTEGER DEFAULT 0,
                ban_reason    TEXT,
                referred_by   INTEGER DEFAULT 0,
                tenant_id     INTEGER DEFAULT 1,
                created_at    REAL DEFAULT (unixepoch()),
                last_seen     REAL DEFAULT (unixepoch())
            );

            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
            CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned);

            -- ═══════════════════════════════════════
            --   TENANTS (multi-tenant ready)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS tenants (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_token       TEXT UNIQUE NOT NULL,
                bot_username    TEXT,
                bot_id          INTEGER,
                owner_id        INTEGER NOT NULL,
                brand_name      TEXT DEFAULT 'GameStore',
                brand_logo_url  TEXT,
                welcome_msg     TEXT,
                support_handle  TEXT,
                markup_percent  REAL DEFAULT 25.0,
                default_lang    TEXT DEFAULT 'es',
                is_master       INTEGER DEFAULT 0,
                is_active       INTEGER DEFAULT 1,
                webhook_secret  TEXT,
                total_revenue   REAL DEFAULT 0,
                total_profit    REAL DEFAULT 0,
                created_at      REAL DEFAULT (unixepoch()),
                updated_at      REAL DEFAULT (unixepoch())
            );

            -- ═══════════════════════════════════════
            --   SOLICITUDES DE REVENDEDOR
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS reseller_applications (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       INTEGER NOT NULL,
                business_desc TEXT,
                status        TEXT DEFAULT 'pending',   -- pending/approved/rejected
                reviewed_by   INTEGER,
                review_note   TEXT,
                created_at    REAL DEFAULT (unixepoch()),
                reviewed_at   REAL,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_resapp_status ON reseller_applications(status);
            CREATE INDEX IF NOT EXISTS idx_resapp_user ON reseller_applications(user_id);

            -- ═══════════════════════════════════════
            --   DEPÓSITOS (OxaPay)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS deposits (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                deposit_id    TEXT UNIQUE NOT NULL,
                user_id       INTEGER NOT NULL,
                amount_usd    REAL NOT NULL,
                track_id      TEXT,
                pay_link      TEXT,
                status        TEXT DEFAULT 'pending',
                raw_callback  TEXT,
                tenant_id     INTEGER DEFAULT 1,
                created_at    REAL DEFAULT (unixepoch()),
                updated_at    REAL DEFAULT (unixepoch())
            );
            CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
            CREATE INDEX IF NOT EXISTS idx_deposits_track ON deposits(track_id);
            CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

            -- ═══════════════════════════════════════
            --   ÓRDENES
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS orders (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                merchant_order_id  TEXT UNIQUE NOT NULL,
                buffpin_order_id   TEXT,
                user_id            INTEGER NOT NULL,
                user_role          TEXT DEFAULT 'user',
                product_id         INTEGER NOT NULL,
                product_name       TEXT,
                quantity           INTEGER DEFAULT 1,
                cost_price         REAL,
                sell_price         REAL,
                platform_fee       REAL DEFAULT 0,
                markup_pct         REAL DEFAULT 0,
                currency           TEXT DEFAULT 'USDT',
                order_status       INTEGER DEFAULT 0,
                refund_status      INTEGER DEFAULT 0,
                recharge_config    TEXT,
                card_data          TEXT,
                error_message      TEXT,
                discount_amount    REAL DEFAULT 0,
                coupon_code        TEXT,
                seller_id          INTEGER,
                sales_channel      TEXT DEFAULT 'direct',
                tenant_id          INTEGER DEFAULT 1,
                created_at         REAL DEFAULT (unixepoch()),
                updated_at         REAL DEFAULT (unixepoch())
            );
            CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
            CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

            -- ═══════════════════════════════════════
            --   CACHÉ DE PRODUCTOS
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS products_cache (
                id              INTEGER PRIMARY KEY,
                goods_name      TEXT,
                type            INTEGER,
                pay_price       REAL,
                cost_currency   TEXT,
                platform_config TEXT,
                raw_json        TEXT,
                cached_at       REAL DEFAULT (unixepoch())
            );
            CREATE INDEX IF NOT EXISTS idx_products_type ON products_cache(type);
            CREATE INDEX IF NOT EXISTS idx_products_name ON products_cache(goods_name);

            -- ═══════════════════════════════════════
            --   PRODUCT OVERRIDES (ocultar/destacar/precio custom)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS product_overrides (
                product_id    INTEGER PRIMARY KEY,
                is_hidden     INTEGER DEFAULT 0,
                is_featured   INTEGER DEFAULT 0,
                custom_price  REAL,
                display_name  TEXT,
                admin_note    TEXT,
                updated_at    REAL DEFAULT (unixepoch())
            );

            -- ═══════════════════════════════════════
            --   HISTORIAL DE BALANCE
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS balance_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                amount     REAL NOT NULL,
                type       TEXT NOT NULL,
                ref_id     TEXT,
                note       TEXT,
                created_at REAL DEFAULT (unixepoch())
            );
            CREATE INDEX IF NOT EXISTS idx_balance_log_user ON balance_log(user_id);

            -- ═══════════════════════════════════════
            --   WALLET DE VENDEDORES (USDT BEP20)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS seller_wallets (
                user_id               INTEGER PRIMARY KEY,
                currency              TEXT DEFAULT 'USDT',
                network               TEXT DEFAULT 'BEP20',
                held_balance          REAL DEFAULT 0,
                available_balance     REAL DEFAULT 0,
                pending_withdrawal_balance REAL DEFAULT 0,
                withdrawn_balance     REAL DEFAULT 0,
                lifetime_sales        REAL DEFAULT 0,
                lifetime_platform_fee REAL DEFAULT 0,
                lifetime_net          REAL DEFAULT 0,
                updated_at            REAL DEFAULT (unixepoch()),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );

            CREATE TABLE IF NOT EXISTS seller_wallet_movements (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id      INTEGER NOT NULL,
                order_id       INTEGER,
                movement_type  TEXT NOT NULL,
                status         TEXT DEFAULT 'held',
                amount         REAL NOT NULL,
                gross_amount   REAL DEFAULT 0,
                platform_fee   REAL DEFAULT 0,
                currency       TEXT DEFAULT 'USDT',
                network        TEXT DEFAULT 'BEP20',
                note           TEXT,
                release_at     REAL,
                created_at     REAL DEFAULT (unixepoch()),
                updated_at     REAL DEFAULT (unixepoch()),
                UNIQUE(order_id, movement_type),
                FOREIGN KEY (seller_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_seller_wallet_movements_seller ON seller_wallet_movements(seller_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_seller_wallet_movements_order ON seller_wallet_movements(order_id);

            CREATE TABLE IF NOT EXISTS seller_withdrawals (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id      INTEGER NOT NULL,
                amount         REAL NOT NULL,
                fee_amount     REAL DEFAULT 0,
                net_amount     REAL NOT NULL,
                currency       TEXT DEFAULT 'USDT',
                network        TEXT DEFAULT 'BEP20',
                wallet_address TEXT NOT NULL,
                status         TEXT DEFAULT 'pending',
                txid           TEXT,
                provider_track_id TEXT,
                provider_status TEXT,
                raw_response   TEXT,
                note           TEXT,
                requested_at   REAL DEFAULT (unixepoch()),
                reviewed_by    INTEGER,
                reviewed_at    REAL,
                updated_at     REAL DEFAULT (unixepoch()),
                FOREIGN KEY (seller_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_seller ON seller_withdrawals(seller_id, requested_at);
            CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_status ON seller_withdrawals(status);

            -- ═══════════════════════════════════════
            --   AUDIT LOG (acciones admin)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS audit_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id    INTEGER NOT NULL,
                action      TEXT NOT NULL,
                target_type TEXT,
                target_id   TEXT,
                details     TEXT,
                created_at  REAL DEFAULT (unixepoch())
            );
            CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_log(admin_id);
            CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

            -- ═══════════════════════════════════════
            --   BROADCAST LOG
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS broadcasts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id    INTEGER NOT NULL,
                text        TEXT NOT NULL,
                target      TEXT DEFAULT 'all',
                sent_count  INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                created_at  REAL DEFAULT (unixepoch())
            );

            -- ═══════════════════════════════════════
            --   TABLAS V2 (preservadas)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS coupons (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id       INTEGER DEFAULT 1,
                code            TEXT NOT NULL,
                discount_pct    REAL DEFAULT 0,
                discount_fix    REAL DEFAULT 0,
                min_amount      REAL DEFAULT 0,
                max_uses        INTEGER DEFAULT 0,
                used_count      INTEGER DEFAULT 0,
                target_role     TEXT DEFAULT 'all',  -- all/user/reseller
                expires_at      REAL,
                is_active       INTEGER DEFAULT 1,
                created_at      REAL DEFAULT (unixepoch()),
                UNIQUE(tenant_id, code)
            );

            CREATE TABLE IF NOT EXISTS coupon_uses (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                coupon_id   INTEGER NOT NULL,
                user_id     INTEGER NOT NULL,
                order_id    TEXT,
                discount    REAL,
                created_at  REAL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS favorites (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      INTEGER NOT NULL,
                tenant_id    INTEGER DEFAULT 1,
                product_id   INTEGER NOT NULL,
                last_config  TEXT,
                created_at   REAL DEFAULT (unixepoch()),
                UNIQUE(user_id, tenant_id, product_id)
            );

            CREATE TABLE IF NOT EXISTS cart (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         INTEGER NOT NULL,
                tenant_id       INTEGER DEFAULT 1,
                product_id      INTEGER NOT NULL,
                product_name    TEXT,
                quantity        INTEGER DEFAULT 1,
                unit_price      REAL,
                recharge_config TEXT,
                created_at      REAL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS referrals (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                referrer_id      INTEGER NOT NULL,
                referred_id      INTEGER NOT NULL,
                tenant_id        INTEGER DEFAULT 1,
                commission_pct   REAL DEFAULT 5.0,
                total_earned     REAL DEFAULT 0,
                created_at       REAL DEFAULT (unixepoch()),
                UNIQUE(referrer_id, referred_id, tenant_id)
            );


            CREATE TABLE IF NOT EXISTS order_reviews (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                order_type  TEXT NOT NULL DEFAULT 'auto',
                order_id    TEXT NOT NULL,
                user_id     INTEGER NOT NULL,
                rating      INTEGER NOT NULL,
                comment     TEXT,
                created_at  REAL DEFAULT (unixepoch()),
                UNIQUE(order_type, order_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_reviews_order ON order_reviews(order_type, order_id);
            CREATE INDEX IF NOT EXISTS idx_reviews_user ON order_reviews(user_id);

            CREATE TABLE IF NOT EXISTS reseller_wallets (
                tenant_id          INTEGER PRIMARY KEY,
                available_balance  REAL DEFAULT 0,
                pending_balance    REAL DEFAULT 0,
                total_earned       REAL DEFAULT 0,
                total_withdrawn    REAL DEFAULT 0,
                updated_at         REAL DEFAULT (unixepoch())
            );

            -- ═══════════════════════════════════════
            --   AUTH WEB (login fuera de Telegram)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS web_sessions (
                token         TEXT PRIMARY KEY,
                user_id       INTEGER NOT NULL,
                created_at    REAL DEFAULT (unixepoch()),
                expires_at    REAL,
                ip_address    TEXT,
                user_agent    TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON web_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON web_sessions(expires_at);

            CREATE TABLE IF NOT EXISTS email_verifications (
                code          TEXT PRIMARY KEY,
                email         TEXT NOT NULL,
                user_id       INTEGER,
                purpose       TEXT NOT NULL,            -- verify, reset_password
                created_at    REAL DEFAULT (unixepoch()),
                expires_at    REAL,
                used          INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_verif_email ON email_verifications(email);

            -- ═══════════════════════════════════════
            --   NOTIFICACIONES INTERNAS
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS notifications (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id             INTEGER,
                type                TEXT,
                title               TEXT,
                message             TEXT,
                related_order_id    INTEGER,
                related_case_id     INTEGER,
                related_product_id  INTEGER,
                url                 TEXT,
                is_read             INTEGER DEFAULT 0,
                created_at          REAL DEFAULT (unixepoch()),
                read_at             REAL
            );
            CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_notif_is_read ON notifications(is_read);

            -- ═══════════════════════════════════════
            --   PUSH SUBSCRIPTIONS (FASE 3 PREP)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER,
                endpoint    TEXT UNIQUE,
                p256dh      TEXT,
                auth        TEXT,
                user_agent  TEXT,
                created_at  REAL DEFAULT (unixepoch()),
                updated_at  REAL DEFAULT (unixepoch()),
                revoked_at  REAL
            );
            CREATE INDEX IF NOT EXISTS idx_pushsub_user ON push_subscriptions(user_id);

            -- ═══════════════════════════════════════
            --   NUMEROS VIRTUALES (SMS)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS sms_orders (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id             INTEGER NOT NULL,
                fivesim_order_id    TEXT UNIQUE,
                phone               TEXT,
                country             TEXT NOT NULL,
                service             TEXT NOT NULL,
                operator            TEXT DEFAULT 'any',
                cost_price          REAL DEFAULT 0,
                sell_price          REAL NOT NULL,
                code                TEXT,
                status              TEXT DEFAULT 'pending', -- pending, completed, canceled, expired, failed
                raw_response        TEXT,
                error_message       TEXT,
                created_at          REAL DEFAULT (unixepoch()),
                updated_at          REAL DEFAULT (unixepoch()),
                completed_at        REAL,
                canceled_at         REAL,
                refunded_at         REAL,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_sms_orders_user ON sms_orders(user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_sms_orders_status ON sms_orders(status);

            CREATE TABLE IF NOT EXISTS sms_catalog_overrides (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type           TEXT NOT NULL, -- country, service, operator, home
                item_key            TEXT NOT NULL,
                display_name        TEXT,
                icon_url            TEXT,
                banner_url          TEXT,
                is_featured         INTEGER DEFAULT 0,
                is_hidden           INTEGER DEFAULT 0,
                sort_order          INTEGER DEFAULT 100,
                custom_markup       REAL,
                min_price           REAL,
                created_at          REAL DEFAULT (unixepoch()),
                updated_at          REAL DEFAULT (unixepoch()),
                UNIQUE(item_type, item_key)
            );

            -- ═══════════════════════════════════════
            --   SOPORTE Y CHATS UNIFICADOS
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                subject TEXT NOT NULL,
                description TEXT,
                associated_order_id TEXT,
                associated_order_type TEXT,
                associated_seller_id INTEGER,
                status TEXT DEFAULT 'open',
                created_at REAL DEFAULT (unixepoch()),
                updated_at REAL DEFAULT (unixepoch()),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
            CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

            CREATE TABLE IF NOT EXISTS chat_rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER,
                customer_id INTEGER NOT NULL,
                seller_id INTEGER,
                room_type TEXT DEFAULT 'support',
                status TEXT DEFAULT 'active',
                last_message_at REAL DEFAULT (unixepoch()),
                created_at REAL DEFAULT (unixepoch()),
                FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE SET NULL,
                FOREIGN KEY (customer_id) REFERENCES users(user_id),
                FOREIGN KEY (seller_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_chat_rooms_customer ON chat_rooms(customer_id);
            CREATE INDEX IF NOT EXISTS idx_chat_rooms_seller ON chat_rooms(seller_id);
            CREATE INDEX IF NOT EXISTS idx_chat_rooms_ticket ON chat_rooms(ticket_id);

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                sender_id INTEGER NOT NULL,
                sender_role TEXT NOT NULL,
                message_text TEXT NOT NULL,
                attachment_url TEXT,
                attachment_type TEXT,
                created_at REAL DEFAULT (unixepoch()),
                FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at);

            CREATE TABLE IF NOT EXISTS chat_room_reads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                read_at REAL DEFAULT 0,
                UNIQUE(room_id, user_id),
                FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_room_reads_room ON chat_room_reads(room_id);
        """)
        await db.commit()

        # Migraciones idempotentes: añadir columnas auth_web a users si no existen
        cols_to_add = [
            ("email", "TEXT"),
            ("email_verified", "INTEGER DEFAULT 0"),
            ("password_hash", "TEXT"),
            ("google_id", "TEXT"),
            ("auth_method", "TEXT DEFAULT 'telegram'"),  # telegram, email, google
            ("photo_url", "TEXT"),
            ("display_name", "TEXT"),
        ]
        async with db.execute("PRAGMA table_info(users)") as c:
            existing = {r[1] for r in await c.fetchall()}
        for col, defn in cols_to_add:
            if col not in existing:
                try:
                    await db.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")
                except Exception:
                    pass
        await db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id)")
        await db.commit()

        async with db.execute("PRAGMA table_info(orders)") as c:
            order_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [("seller_id", "INTEGER"), ("sales_channel", "TEXT DEFAULT 'direct'")]:
            if col not in order_cols:
                await db.execute(f"ALTER TABLE orders ADD COLUMN {col} {defn}")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id, created_at)")
        await db.commit()

        async with db.execute("PRAGMA table_info(seller_wallets)") as c:
            seller_wallet_cols = {r[1] for r in await c.fetchall()}
        if seller_wallet_cols and "pending_withdrawal_balance" not in seller_wallet_cols:
            await db.execute("ALTER TABLE seller_wallets ADD COLUMN pending_withdrawal_balance REAL DEFAULT 0")
            await db.commit()
        async with db.execute("PRAGMA table_info(seller_withdrawals)") as c:
            withdrawal_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [("provider_track_id", "TEXT"), ("provider_status", "TEXT"), ("raw_response", "TEXT")]:
            if withdrawal_cols and col not in withdrawal_cols:
                await db.execute(f"ALTER TABLE seller_withdrawals ADD COLUMN {col} {defn}")
        await db.commit()

        # Asegurar tenant master
        async with db.execute("SELECT COUNT(*) FROM tenants WHERE is_master=1") as c:
            if (await c.fetchone())[0] == 0:
                await db.execute("""
                    INSERT INTO tenants
                    (id, bot_token, owner_id, brand_name, is_master, is_active)
                    VALUES (1, ?, ?, 'GameStore', 1, 1)
                """, (
                    config.BOT_TOKEN,
                    config.ADMIN_IDS[0] if config.ADMIN_IDS else 0,
                ))
                await db.commit()

        # Migraciones para soporte y chats unificados
        async with db.execute("PRAGMA table_info(support_tickets)") as c:
            st_cols = {r[1] for r in await c.fetchall()}
        if st_cols and "associated_order_type" not in st_cols:
            await db.execute("ALTER TABLE support_tickets ADD COLUMN associated_order_type TEXT")
            await db.commit()

        async with db.execute("PRAGMA table_info(chat_rooms)") as c:
            cr_cols = {r[1] for r in await c.fetchall()}
        if cr_cols and "room_type" not in cr_cols:
            await db.execute("ALTER TABLE chat_rooms ADD COLUMN room_type TEXT DEFAULT 'support'")
            await db.commit()

        async with db.execute("PRAGMA table_info(chat_messages)") as c:
            cm_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [("attachment_url", "TEXT"), ("attachment_type", "TEXT")]:
            if cm_cols and col not in cm_cols:
                await db.execute(f"ALTER TABLE chat_messages ADD COLUMN {col} {defn}")
        await db.commit()

    log.info("✅ DB inicializada")


# ══════════════════════════════════════
#  USUARIOS
# ══════════════════════════════════════

async def upsert_user(user_id: int, username: str = None, first_name: str = None):
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO users (user_id, username, first_name, last_seen)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                username = COALESCE(excluded.username, username),
                first_name = COALESCE(excluded.first_name, first_name),
                last_seen = excluded.last_seen
        """, (user_id, username, first_name, time.time()))
        await db.commit()


async def get_user(user_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE user_id=?", (user_id,)) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def update_user_photo(user_id: int, photo_url: str):
    async with aiosqlite.connect(DB) as db:
        await db.execute("UPDATE users SET photo_url=?, last_seen=? WHERE user_id=?", (photo_url or "", time.time(), user_id))
        await db.commit()


async def update_user_profile(user_id: int, display_name: str = None, email: str = None):
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT email FROM users WHERE user_id=?", (user_id,)) as c:
            row = await c.fetchone()
        current_email = (row["email"] if row else "") or ""
        fields = ["last_seen=?"]
        vals = [time.time()]
        if display_name is not None:
            fields.append("display_name=?")
            vals.append(display_name.strip())
        if email is not None:
            clean_email = email.strip().lower()
            if clean_email and clean_email != current_email.lower():
                async with db.execute("SELECT user_id FROM users WHERE lower(email)=lower(?) AND user_id<>?", (clean_email, user_id)) as c:
                    exists = await c.fetchone()
                if exists:
                    raise ValueError("Ese email ya está en uso")
                fields.append("email=?")
                vals.append(clean_email)
                fields.append("email_verified=0")
            elif not clean_email and current_email:
                fields.append("email=NULL")
                fields.append("email_verified=0")
        vals.append(user_id)
        await db.execute(f"UPDATE users SET {', '.join(fields)} WHERE user_id=?", vals)
        await db.commit()


async def get_user_role(user_id: int) -> str:
    """Devuelve el rol considerando ADMIN_IDS de config."""
    if user_id in config.ADMIN_IDS:
        return "admin"
    async with aiosqlite.connect(DB) as db:
        async with db.execute("SELECT role FROM users WHERE user_id=?", (user_id,)) as c:
            r = await c.fetchone()
            return r[0] if r else "user"


async def set_user_role(user_id: int, role: str):
    async with aiosqlite.connect(DB) as db:
        await db.execute("UPDATE users SET role=? WHERE user_id=?", (role, user_id))
        await db.commit()


async def ban_user(user_id: int, reason: str = ""):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET is_banned=1, ban_reason=? WHERE user_id=?",
            (reason, user_id),
        )
        await db.commit()


async def unban_user(user_id: int):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET is_banned=0, ban_reason=NULL WHERE user_id=?",
            (user_id,),
        )
        await db.commit()


async def is_banned(user_id: int) -> bool:
    async with aiosqlite.connect(DB) as db:
        async with db.execute("SELECT is_banned FROM users WHERE user_id=?", (user_id,)) as c:
            r = await c.fetchone()
            return bool(r[0]) if r else False


async def search_users(query: str, limit: int = 20) -> list[dict]:
    """Busca por user_id, username, first_name o email."""
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q_raw = (query or "").strip().lstrip("@")
        q = f"%{q_raw}%"
        async with db.execute("""
            SELECT * FROM users
            WHERE CAST(user_id AS TEXT) LIKE ?
               OR username LIKE ?
               OR first_name LIKE ?
               OR email LIKE ?
            ORDER BY last_seen DESC LIMIT ?
        """, (q, q, q, q, limit)) as c:
            return [dict(r) for r in await c.fetchall()]


async def count_users_by_role() -> dict:
    async with aiosqlite.connect(DB) as db:
        result = {"user": 0, "reseller": 0, "admin": 0, "banned": 0, "total": 0}
        async with db.execute(
            "SELECT role, COUNT(*) FROM users GROUP BY role"
        ) as c:
            for role, count in await c.fetchall():
                result[role] = count
                result["total"] += count
        async with db.execute("SELECT COUNT(*) FROM users WHERE is_banned=1") as c:
            result["banned"] = (await c.fetchone())[0]
        return result


async def get_all_user_ids(role: str = None, limit: int = None) -> list[int]:
    """Para broadcasts."""
    async with aiosqlite.connect(DB) as db:
        q = "SELECT user_id FROM users WHERE is_banned=0"
        params = []
        if role and role != "all":
            q += " AND role=?"
            params.append(role)
        if limit:
            q += f" LIMIT {int(limit)}"
        async with db.execute(q, params) as c:
            return [r[0] for r in await c.fetchall()]


# ══════════════════════════════════════
#  BALANCE
# ══════════════════════════════════════

async def get_balance(user_id: int) -> float:
    async with aiosqlite.connect(DB) as db:
        async with db.execute("SELECT balance FROM users WHERE user_id=?", (user_id,)) as c:
            r = await c.fetchone()
            return r[0] if r else 0.0


async def add_balance(user_id: int, amount: float, tx_type: str, ref_id: str = "", note: str = ""):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET balance = balance + ?, total_deposit = total_deposit + ? WHERE user_id=?",
            (amount, max(0, amount), user_id),
        )
        await db.execute(
            "INSERT INTO balance_log (user_id, amount, type, ref_id, note) VALUES (?,?,?,?,?)",
            (user_id, amount, tx_type, ref_id, note),
        )
        await db.commit()
    if amount > 0:
        try:
            await create_notification(
                user_id=int(user_id),
                type="balance",
                title="Saldo acreditado",
                message=f"Se han acreditado ${amount:.2f} USDT a tu saldo. ({note or tx_type})",
                url="/perfil"
            )
        except Exception as ne:
            log.warning("Error creating balance notification: %s", ne)


async def spend_balance(user_id: int, amount: float, ref_id: str = "", note: str = "") -> bool:
    bal = await get_balance(user_id)
    if bal < amount:
        return False
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET balance = balance - ?, total_spent = total_spent + ? WHERE user_id=?",
            (amount, amount, user_id),
        )
        await db.execute(
            "INSERT INTO balance_log (user_id, amount, type, ref_id, note) VALUES (?,?,?,?,?)",
            (user_id, -amount, "purchase", ref_id, note),
        )
        await db.commit()
    return True


async def adjust_balance_admin(user_id: int, amount: float, admin_id: int, note: str = ""):
    """Ajuste manual por admin (puede ser negativo)."""
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET balance = balance + ? WHERE user_id=?",
            (amount, user_id),
        )
        await db.execute(
            "INSERT INTO balance_log (user_id, amount, type, ref_id, note) VALUES (?,?,?,?,?)",
            (user_id, amount, "admin_adjust", str(admin_id), note),
        )
        await db.commit()


async def get_balance_history(user_id: int, limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM balance_log WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ) as c:
            return [dict(r) for r in await c.fetchall()]


# ══════════════════════════════════════
#  DEPÓSITOS (OxaPay)
# ══════════════════════════════════════

def gen_deposit_id() -> str:
    return f"DEP{int(time.time())}{uuid.uuid4().hex[:6].upper()}"


async def create_deposit(user_id: int, amount_usd: float, track_id: str, pay_link: str) -> str:
    did = gen_deposit_id()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO deposits (deposit_id, user_id, amount_usd, track_id, pay_link)
            VALUES (?, ?, ?, ?, ?)
        """, (did, user_id, amount_usd, track_id, pay_link))
        await db.commit()
    return did


async def get_deposit_by_track(track_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM deposits WHERE track_id=?", (track_id,)) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def get_deposit_by_dep_id(dep_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM deposits WHERE deposit_id=?", (dep_id,)) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def update_deposit(track_id: str, status: str, raw_callback: str = None):
    async with aiosqlite.connect(DB) as db:
        if raw_callback:
            await db.execute(
                "UPDATE deposits SET status=?, raw_callback=?, updated_at=? WHERE track_id=?",
                (status, raw_callback, time.time(), track_id),
            )
        else:
            await db.execute(
                "UPDATE deposits SET status=?, updated_at=? WHERE track_id=?",
                (status, time.time(), track_id),
            )
        await db.commit()


async def get_user_deposits(user_id: int, limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM deposits WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ) as c:
            return [dict(r) for r in await c.fetchall()]


async def get_recent_deposits(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM deposits ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as c:
            return [dict(r) for r in await c.fetchall()]


# ══════════════════════════════════════
#  ÓRDENES
# ══════════════════════════════════════

def gen_order_id() -> str:
    return f"GS{int(time.time())}{uuid.uuid4().hex[:8].upper()}"


async def create_order(
    user_id: int, user_role: str, product_id: int, product_name: str,
    quantity: int, cost_price: float, sell_price: float, markup_pct: float,
    recharge_config: str, currency: str = "USDT", seller_id: int | None = None,
    sales_channel: str = "direct",
) -> str:
    mid = gen_order_id()
    platform_fee = round(sell_price - cost_price, 2)

    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO orders
            (merchant_order_id, user_id, user_role, product_id, product_name,
             quantity, cost_price, sell_price, platform_fee, markup_pct,
             recharge_config, currency, seller_id, sales_channel)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (mid, user_id, user_role, product_id, product_name,
              quantity, cost_price, sell_price, platform_fee, markup_pct,
              recharge_config, currency, seller_id, sales_channel))
        await db.commit()
    return mid


async def update_order_buffpin(merchant_order_id: str, buffpin_order_id: str, status: int):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE orders SET buffpin_order_id=?, order_status=?, updated_at=? WHERE merchant_order_id=?",
            (buffpin_order_id, status, time.time(), merchant_order_id),
        )
        await db.commit()


async def update_order_status(
    merchant_order_id: str = None, buffpin_order_id: str = None,
    status: int = None, refund_status: int = None,
    card_data: str = None, error_message: str = None,
):
    sets, vals = [], []
    if status is not None:
        sets.append("order_status=?"); vals.append(status)
    if refund_status is not None:
        sets.append("refund_status=?"); vals.append(refund_status)
    if card_data is not None:
        sets.append("card_data=?"); vals.append(card_data)
    if error_message is not None:
        sets.append("error_message=?"); vals.append(error_message)
    sets.append("updated_at=?"); vals.append(time.time())

    if merchant_order_id:
        where = "merchant_order_id=?"; vals.append(merchant_order_id)
    elif buffpin_order_id:
        where = "buffpin_order_id=?"; vals.append(buffpin_order_id)
    else:
        return
    async with aiosqlite.connect(DB) as db:
        await db.execute(f"UPDATE orders SET {', '.join(sets)} WHERE {where}", vals)
        await db.commit()


async def get_order(merchant_order_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM orders WHERE merchant_order_id=?", (merchant_order_id,)
        ) as c:
            r = await c.fetchone()
            return dict(r) if r else None



async def get_order_by_buffpin_id(buffpin_order_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM orders WHERE buffpin_order_id=?", (str(buffpin_order_id),)
        ) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def get_review(order_type: str, order_id: str, user_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM order_reviews WHERE order_type=? AND order_id=? AND user_id=?",
            (order_type, str(order_id), user_id),
        ) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def add_order_review(order_type: str, order_id: str, user_id: int, rating: int, comment: str = "") -> int:
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO order_reviews (order_type, order_id, user_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(order_type, order_id, user_id) DO UPDATE SET
                rating=excluded.rating,
                comment=excluded.comment,
                created_at=excluded.created_at
        """, (order_type, str(order_id), user_id, int(rating), comment or ""))
        await db.commit()
        return cur.lastrowid



async def get_recent_reviews(limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT r.*, u.first_name, u.username, u.email
            FROM order_reviews r
            LEFT JOIN users u ON u.user_id = r.user_id
            ORDER BY r.created_at DESC
            LIMIT ?
        """, (limit,)) as c:
            return [dict(row) for row in await c.fetchall()]



async def get_public_reviews(product_id: int = None, manual_product_id: int = None, product_ids: list[int] = None, limit: int = 10) -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        where = []
        params = []
        if product_ids:
            clean_ids = [int(pid) for pid in product_ids if int(pid or 0) > 0]
            if clean_ids:
                placeholders = ",".join("?" for _ in clean_ids)
                where.append(f"r.order_type='auto' AND o.product_id IN ({placeholders})")
                params.extend(clean_ids)
        elif product_id is not None:
            where.append("r.order_type='auto' AND o.product_id=?")
            params.append(product_id)
        if manual_product_id is not None:
            where.append("r.order_type='manual' AND mo.product_id=?")
            params.append(manual_product_id)
        where_sql = "WHERE " + " AND ".join(where) if where else ""
        async with db.execute(f"""
            SELECT COUNT(*) as count, COALESCE(AVG(r.rating),0) as avg_rating
            FROM order_reviews r
            LEFT JOIN orders o ON r.order_type='auto' AND r.order_id=o.merchant_order_id
            LEFT JOIN manual_orders mo ON r.order_type='manual' AND r.order_id=CAST(mo.id AS TEXT)
            {where_sql}
        """, params) as c:
            stats = dict(await c.fetchone())
        async with db.execute(f"""
            SELECT r.id, r.order_type, r.order_id, r.rating, r.comment, r.created_at,
                   u.first_name, u.username,
                   COALESCE(o.product_name, mp.name) as product_name
            FROM order_reviews r
            LEFT JOIN users u ON u.user_id = r.user_id
            LEFT JOIN orders o ON r.order_type='auto' AND r.order_id=o.merchant_order_id
            LEFT JOIN manual_orders mo ON r.order_type='manual' AND r.order_id=CAST(mo.id AS TEXT)
            LEFT JOIN manual_products mp ON mo.product_id=mp.id
            {where_sql}
            ORDER BY r.created_at DESC
            LIMIT ?
        """, params + [max(1, min(int(limit), 50))]) as c:
            rows = [dict(row) for row in await c.fetchall()]
    items = []
    for row in rows:
        name = (row.get("first_name") or row.get("username") or "Cliente").strip()
        if len(name) > 18:
            name = name[:18] + "..."
        items.append({
            "rating": int(row.get("rating") or 0),
            "comment": row.get("comment") or "",
            "created_at": row.get("created_at"),
            "customer_name": name,
            "product_name": row.get("product_name") or "Producto",
            "order_type": row.get("order_type"),
        })
    return {
        "count": int(stats.get("count") or 0),
        "avg_rating": round(float(stats.get("avg_rating") or 0), 2),
        "items": items,
    }


async def get_review_stats() -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT COUNT(*) as count, COALESCE(AVG(rating),0) as avg_rating FROM order_reviews") as c:
            total = dict(await c.fetchone())
        async with db.execute("SELECT rating, COUNT(*) as count FROM order_reviews GROUP BY rating ORDER BY rating DESC") as c:
            by_rating = [dict(row) for row in await c.fetchall()]
    return {
        "count": int(total.get("count") or 0),
        "avg_rating": float(total.get("avg_rating") or 0),
        "by_rating": by_rating,
    }


async def get_reviews_for_user(user_id: int) -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM order_reviews WHERE user_id=? ORDER BY created_at DESC",
            (user_id,),
        ) as c:
            rows = [dict(r) for r in await c.fetchall()]
    return {f"{r['order_type']}:{r['order_id']}": r for r in rows}


async def apply_referral(referrer_id: int, referred_id: int, commission_pct: float = 5.0) -> bool:
    if not referrer_id or not referred_id or int(referrer_id) == int(referred_id):
        return False
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT referred_by FROM users WHERE user_id=?", (referred_id,)) as c:
            row = await c.fetchone()
        if not row:
            return False
        if int(row["referred_by"] or 0) not in (0, int(referrer_id)):
            return False
        await db.execute("UPDATE users SET referred_by=? WHERE user_id=? AND COALESCE(referred_by,0)=0", (referrer_id, referred_id))
        await db.execute("""
            INSERT OR IGNORE INTO referrals (referrer_id, referred_id, commission_pct)
            VALUES (?, ?, ?)
        """, (referrer_id, referred_id, commission_pct))
        await db.commit()
        return True


async def get_referral_stats(user_id: int) -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT r.*, u.first_name, u.username, u.total_spent, u.total_deposit
            FROM referrals r
            LEFT JOIN users u ON u.user_id = r.referred_id
            WHERE r.referrer_id=?
            ORDER BY r.created_at DESC
        """, (user_id,)) as c:
            rows = [dict(r) for r in await c.fetchall()]
    return {
        "count": len(rows),
        "total_referred_spent": float(sum(float(r.get("total_spent") or 0) for r in rows)),
        "total_earned": float(sum(float(r.get("total_earned") or 0) for r in rows)),
        "items": rows[:50],
    }


async def get_user_orders(user_id: int, limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ) as c:
            return [dict(r) for r in await c.fetchall()]


async def get_recent_orders(limit: int = 20, status: int = None, role: str = None) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = "SELECT * FROM orders WHERE 1=1"
        params = []
        if status is not None:
            q += " AND order_status=?"
            params.append(status)
        if role:
            q += " AND user_role=?"
            params.append(role)
        q += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def count_user_orders_last_hour(user_id: int) -> int:
    async with aiosqlite.connect(DB) as db:
        async with db.execute(
            "SELECT COUNT(*) FROM orders WHERE user_id=? AND created_at > ?",
            (user_id, time.time() - 3600),
        ) as c:
            return (await c.fetchone())[0]


async def get_order_stats(days: int = None, role: str = None) -> dict:
    """Estadísticas globales o por periodo."""
    async with aiosqlite.connect(DB) as db:
        stats = {}
        where = "1=1"
        params = []
        if days:
            where += " AND created_at > ?"
            params.append(time.time() - (days * 86400))
        if role:
            where += " AND user_role=?"
            params.append(role)

        async with db.execute(
            f"SELECT COUNT(*), COALESCE(SUM(sell_price),0), COALESCE(SUM(platform_fee),0) "
            f"FROM orders WHERE {where}", params,
        ) as c:
            r = await c.fetchone()
            stats["total"] = r[0]
            stats["revenue"] = r[1]
            stats["profit"] = r[2]

        for key, cond in [("completed", "= 2"), ("pending", "IN (0,1)"), ("failed", "IN (3,4)")]:
            async with db.execute(
                f"SELECT COUNT(*) FROM orders WHERE order_status {cond} AND {where}", params,
            ) as c:
                stats[key] = (await c.fetchone())[0]

        return stats


async def get_top_products(limit: int = 5, days: int = 1) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT product_name, COUNT(*) as sales, SUM(sell_price) as revenue
            FROM orders
            WHERE created_at > ? AND order_status = 2
            GROUP BY product_id
            ORDER BY sales DESC
            LIMIT ?
        """, (time.time() - days * 86400, limit)) as c:
            return [dict(r) for r in await c.fetchall()]


# ══════════════════════════════════════
#  CACHÉ DE PRODUCTOS
# ══════════════════════════════════════

async def cache_products(products: list[dict]):
    async with aiosqlite.connect(DB) as db:
        await db.execute("DELETE FROM products_cache")
        for p in products:
            await db.execute("""
                INSERT OR REPLACE INTO products_cache
                (id, goods_name, type, pay_price, cost_currency, platform_config, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                p["id"], p.get("goodsName", ""), p.get("type", 6),
                p.get("payPrice", 0), p.get("costCurrency", "USD"),
                p.get("platformConfig", "[]"),
                json.dumps(p, ensure_ascii=False),
            ))
        await db.commit()
    log.info("Productos cacheados: %d", len(products))


async def get_cached_products(
    product_type: int = None,
    search: str = None,
    include_hidden: bool = False,
) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """
            SELECT p.*, o.is_hidden, o.is_featured, o.custom_price, o.display_name
            FROM products_cache p
            LEFT JOIN product_overrides o ON p.id = o.product_id
            WHERE 1=1
        """
        params = []
        if not include_hidden:
            q += " AND (o.is_hidden IS NULL OR o.is_hidden = 0)"
        if product_type:
            q += " AND p.type=?"
            params.append(product_type)
        if search:
            q += " AND p.goods_name LIKE ?"
            params.append(f"%{search}%")
        q += " ORDER BY COALESCE(o.is_featured, 0) DESC, p.goods_name"
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def get_cached_product(product_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT p.*, o.is_hidden, o.is_featured, o.custom_price, o.display_name, o.admin_note
            FROM products_cache p
            LEFT JOIN product_overrides o ON p.id = o.product_id
            WHERE p.id=?
        """, (product_id,)) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def get_cached_products_by_ids(product_ids: list[int]) -> dict[int, dict]:
    if not product_ids:
        return {}
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        placeholders = ",".join("?" for _ in product_ids)
        async with db.execute(f"""
            SELECT p.*, o.is_hidden, o.is_featured, o.custom_price, o.display_name, o.admin_note
            FROM products_cache p
            LEFT JOIN product_overrides o ON p.id = o.product_id
            WHERE p.id IN ({placeholders})
        """, tuple(product_ids)) as c:
            rows = await c.fetchall()
            return {r["id"]: dict(r) for r in rows}


async def get_available_types(include_hidden: bool = False) -> list[int]:
    async with aiosqlite.connect(DB) as db:
        q = """
            SELECT DISTINCT p.type FROM products_cache p
            LEFT JOIN product_overrides o ON p.id = o.product_id
        """
        if not include_hidden:
            q += " WHERE (o.is_hidden IS NULL OR o.is_hidden = 0)"
        q += " ORDER BY p.type"
        async with db.execute(q) as c:
            return [r[0] for r in await c.fetchall()]


async def get_cache_age() -> float:
    async with aiosqlite.connect(DB) as db:
        async with db.execute("SELECT MIN(cached_at) FROM products_cache") as c:
            r = await c.fetchone()
            return time.time() - r[0] if r and r[0] else float("inf")


# ══════════════════════════════════════
#  PRODUCT OVERRIDES
# ══════════════════════════════════════

async def set_product_override(product_id: int, **fields):
    if not fields:
        return
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "INSERT OR IGNORE INTO product_overrides (product_id) VALUES (?)",
            (product_id,),
        )
        sets = ", ".join(f"{k}=?" for k in fields.keys())
        vals = list(fields.values()) + [time.time(), product_id]
        await db.execute(
            f"UPDATE product_overrides SET {sets}, updated_at=? WHERE product_id=?",
            vals,
        )
        await db.commit()


async def clear_product_override(product_id: int):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "DELETE FROM product_overrides WHERE product_id=?", (product_id,),
        )
        await db.commit()


# ══════════════════════════════════════
#  SOLICITUDES DE REVENDEDOR
# ══════════════════════════════════════

async def create_reseller_application(user_id: int, business_desc: str) -> int:
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO reseller_applications (user_id, business_desc)
            VALUES (?, ?)
        """, (user_id, business_desc))
        await db.commit()
        return cur.lastrowid


async def get_pending_applications() -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT a.*, u.username, u.first_name, u.total_deposit, u.total_spent
            FROM reseller_applications a
            LEFT JOIN users u ON a.user_id = u.user_id
            WHERE a.status = 'pending'
            ORDER BY a.created_at
        """) as c:
            return [dict(r) for r in await c.fetchall()]


async def get_user_pending_application(user_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM reseller_applications
            WHERE user_id = ? AND status = 'pending'
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,)) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def get_application(app_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM reseller_applications WHERE id=?", (app_id,),
        ) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def review_application(app_id: int, status: str, admin_id: int, note: str = ""):
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE reseller_applications
            SET status=?, reviewed_by=?, review_note=?, reviewed_at=?
            WHERE id=?
        """, (status, admin_id, note, time.time(), app_id))
        await db.commit()


# ══════════════════════════════════════
#  AUDIT LOG
# ══════════════════════════════════════

async def audit(admin_id: int, action: str, target_type: str = "", target_id: str = "", details: str = ""):
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO audit_log (admin_id, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?)
        """, (admin_id, action, target_type, target_id, details))
        await db.commit()


async def get_recent_audit(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?", (limit,),
        ) as c:
            return [dict(r) for r in await c.fetchall()]


# ════════════════════════════════════════════════════════
#   FUNCIONES AUTH WEB
# ════════════════════════════════════════════════════════

async def get_user_by_email(email: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE LOWER(email)=LOWER(?)", (email,),
        ) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def get_user_by_google_id(google_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE google_id=?", (google_id,),
        ) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def create_web_user(email: str, password_hash: str, name: str = None) -> int:
    """Crea un nuevo usuario solo-web (sin Telegram). Devuelve el user_id sintético."""
    async with aiosqlite.connect(DB) as db:
        # IDs sintéticos negativos para users sin Telegram (evita colisión)
        async with db.execute("SELECT MIN(user_id) FROM users") as c:
            min_id = (await c.fetchone())[0] or 0
        new_id = min(-1, min_id - 1)
        await db.execute("""
            INSERT INTO users (user_id, email, password_hash, first_name, auth_method, role)
            VALUES (?, ?, ?, ?, 'email', 'user')
        """, (new_id, email.lower(), password_hash, name or email.split("@")[0]))
        await db.commit()
        return new_id


async def set_user_password(user_id: int, password_hash: str):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET password_hash=? WHERE user_id=?",
            (password_hash, user_id),
        )
        await db.commit()


async def set_user_email(user_id: int, email: str, verified: bool = False):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET email=?, email_verified=? WHERE user_id=?",
            (email.lower(), 1 if verified else 0, user_id),
        )
        await db.commit()


async def link_google(user_id: int, google_id: str):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET google_id=? WHERE user_id=?",
            (google_id, user_id),
        )
        await db.commit()


async def create_session(token: str, user_id: int, ttl_days: int = 30,
                         ip: str = None, user_agent: str = None) -> dict:
    import time
    expires = time.time() + (ttl_days * 86400)
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO web_sessions (token, user_id, expires_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        """, (token, user_id, expires, ip, user_agent))
        await db.commit()
    return {"token": token, "user_id": user_id, "expires_at": expires}


async def get_session(token: str) -> dict | None:
    import time
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM web_sessions WHERE token=? AND expires_at > ?",
            (token, time.time()),
        ) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def delete_session(token: str):
    async with aiosqlite.connect(DB) as db:
        await db.execute("DELETE FROM web_sessions WHERE token=?", (token,))
        await db.commit()


async def cleanup_expired_sessions():
    import time
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "DELETE FROM web_sessions WHERE expires_at < ?", (time.time(),)
        )
        await db.commit()


async def create_email_code(email: str, purpose: str, ttl_minutes: int = 60,
                           user_id: int = None) -> str:
    """Genera un código de 6 dígitos para verificación o reset."""
    import time, secrets
    code = "".join(secrets.choice("0123456789") for _ in range(6))
    expires = time.time() + (ttl_minutes * 60)
    async with aiosqlite.connect(DB) as db:
        # Invalidar códigos previos del mismo email/propósito
        await db.execute(
            "DELETE FROM email_verifications WHERE email=? AND purpose=?",
            (email.lower(), purpose),
        )
        await db.execute("""
            INSERT INTO email_verifications (code, email, user_id, purpose, expires_at)
            VALUES (?, ?, ?, ?, ?)
        """, (code, email.lower(), user_id, purpose, expires))
        await db.commit()
    return code


async def verify_email_code(code: str, email: str, purpose: str) -> dict | None:
    """Verifica el código y lo marca como usado. Devuelve la fila o None."""
    import time
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM email_verifications
            WHERE code=? AND LOWER(email)=LOWER(?) AND purpose=? AND used=0 AND expires_at > ?
        """, (code, email, purpose, time.time())) as c:
            r = await c.fetchone()
        if not r:
            return None
        await db.execute(
            "UPDATE email_verifications SET used=1 WHERE code=?", (code,),
        )
        await db.commit()
        return dict(r)


# ════════════════════════════════════════════════════════
#   PRODUCTOS MANUALES (admin crea, entrega manual)
# ════════════════════════════════════════════════════════

async def init_manual_products():
    """Crear tabla de productos manuales si no existe."""
    async with aiosqlite.connect(DB) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS manual_products (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT NOT NULL,
                description     TEXT,
                category        TEXT DEFAULT 'service',
                price           REAL NOT NULL,
                icon_url        TEXT,
                delivery_type   TEXT DEFAULT 'manual',
                instructions    TEXT,
                account_game    TEXT,
                account_platform TEXT,
                account_region  TEXT,
                account_level   TEXT,
                account_rank    TEXT,
                account_items   TEXT,
                account_currency TEXT,
                account_access_method TEXT,
                account_status  TEXT DEFAULT 'active',
                account_warranty TEXT,
                account_terms   TEXT,
                account_images  TEXT,
                auto_delivery_type TEXT,
                auto_delivery_text TEXT,
                auto_delivery_file_url TEXT,
                auto_delivery_file_name TEXT,
                auto_delivery_file_mime TEXT,
                is_active       INTEGER DEFAULT 1,
                stock           INTEGER DEFAULT -1,
                created_by      INTEGER,
                created_at      REAL DEFAULT (unixepoch()),
                updated_at      REAL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS manual_product_options (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id      INTEGER NOT NULL,
                name            TEXT NOT NULL,
                price           REAL NOT NULL,
                stock           INTEGER DEFAULT -1,
                sort_order      INTEGER DEFAULT 100,
                is_active       INTEGER DEFAULT 1,
                created_at      REAL DEFAULT (unixepoch()),
                updated_at      REAL DEFAULT (unixepoch()),
                FOREIGN KEY (product_id) REFERENCES manual_products(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_manual_options_product ON manual_product_options(product_id);

            CREATE TABLE IF NOT EXISTS manual_product_fields (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id      INTEGER NOT NULL,
                label           TEXT NOT NULL,
                field_type      TEXT DEFAULT 'text',
                placeholder     TEXT,
                is_required     INTEGER DEFAULT 1,
                sort_order      INTEGER DEFAULT 100,
                is_active       INTEGER DEFAULT 1,
                created_at      REAL DEFAULT (unixepoch()),
                updated_at      REAL DEFAULT (unixepoch()),
                FOREIGN KEY (product_id) REFERENCES manual_products(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_manual_fields_product ON manual_product_fields(product_id);

            CREATE TABLE IF NOT EXISTS manual_orders (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id      INTEGER NOT NULL,
                option_id       INTEGER,
                option_name     TEXT,
                user_id         INTEGER NOT NULL,
                seller_id       INTEGER,
                price           REAL NOT NULL,
                customer_data   TEXT,
                status          TEXT DEFAULT 'pending',
                admin_note      TEXT,
                delivery_data   TEXT,
                completed_by    INTEGER,
                created_at      REAL DEFAULT (unixepoch()),
                completed_at    REAL,
                FOREIGN KEY (product_id) REFERENCES manual_products(id),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );

            CREATE TABLE IF NOT EXISTS digital_stock_items (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id      INTEGER NOT NULL,
                option_id       INTEGER,
                stock_type      TEXT DEFAULT 'code',
                label           TEXT,
                payload         TEXT NOT NULL,
                status          TEXT DEFAULT 'available',
                order_id        INTEGER,
                used_by         INTEGER,
                used_at         REAL,
                created_by      INTEGER,
                created_at      REAL DEFAULT (unixepoch()),
                updated_at      REAL DEFAULT (unixepoch()),
                FOREIGN KEY (product_id) REFERENCES manual_products(id),
                FOREIGN KEY (order_id) REFERENCES manual_orders(id)
            );
            CREATE INDEX IF NOT EXISTS idx_digital_stock_product ON digital_stock_items(product_id, status);
            CREATE INDEX IF NOT EXISTS idx_digital_stock_option ON digital_stock_items(option_id, status);


            CREATE TABLE IF NOT EXISTS manual_order_cases (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id        INTEGER NOT NULL UNIQUE,
                product_id      INTEGER NOT NULL,
                customer_id     INTEGER NOT NULL,
                seller_id       INTEGER,
                status          TEXT DEFAULT 'open',
                created_at      REAL DEFAULT (unixepoch()),
                updated_at      REAL DEFAULT (unixepoch()),
                closed_at       REAL,
                FOREIGN KEY (order_id) REFERENCES manual_orders(id)
            );
            CREATE INDEX IF NOT EXISTS idx_manual_order_cases_customer ON manual_order_cases(customer_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_manual_order_cases_seller ON manual_order_cases(seller_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_manual_order_cases_status ON manual_order_cases(status);

            CREATE TABLE IF NOT EXISTS manual_order_case_messages (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id         INTEGER NOT NULL,
                order_id        INTEGER NOT NULL,
                sender_id       INTEGER NOT NULL,
                sender_role     TEXT NOT NULL,
                message         TEXT NOT NULL,
                attachment_url  TEXT,
                is_internal_note INTEGER DEFAULT 0,
                created_at      REAL DEFAULT (unixepoch()),
                hidden_at       REAL,
                FOREIGN KEY (case_id) REFERENCES manual_order_cases(id),
                FOREIGN KEY (order_id) REFERENCES manual_orders(id)
            );
            CREATE INDEX IF NOT EXISTS idx_manual_case_messages_case ON manual_order_case_messages(case_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_manual_case_messages_order ON manual_order_case_messages(order_id, created_at);

            -- Registro de lectura por caso y usuario (para read receipts estilo WhatsApp)
            CREATE TABLE IF NOT EXISTS manual_order_case_reads (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id     INTEGER NOT NULL,
                user_id     INTEGER NOT NULL,
                role        TEXT NOT NULL,      -- 'customer', 'seller', 'admin'
                read_at     REAL DEFAULT 0,     -- timestamp unix de la última lectura
                UNIQUE(case_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_case_reads_case ON manual_order_case_reads(case_id);

            CREATE TABLE IF NOT EXISTS account_seller_profiles (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id             INTEGER NOT NULL UNIQUE,
                store_name          TEXT NOT NULL,
                store_slug          TEXT NOT NULL UNIQUE,
                store_description   TEXT,
                store_image         TEXT,
                banner_image        TEXT,
                whatsapp_url        TEXT,
                social_url_1        TEXT,
                social_url_2        TEXT,
                allow_external_links INTEGER DEFAULT 1,
                status              TEXT DEFAULT 'active',
                max_active_products INTEGER DEFAULT 10,
                commission_percent  REAL DEFAULT 10,
                total_sales         REAL DEFAULT 0,
                total_orders        INTEGER DEFAULT 0,
                rating              REAL,
                seller_type         TEXT DEFAULT 'account',
                created_by          INTEGER,
                created_at          REAL DEFAULT (unixepoch()),
                updated_at          REAL DEFAULT (unixepoch()),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_account_seller_profiles_status ON account_seller_profiles(status);
            CREATE INDEX IF NOT EXISTS idx_account_seller_profiles_slug ON account_seller_profiles(store_slug);

            CREATE TABLE IF NOT EXISTS account_seller_sales (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id            INTEGER NOT NULL UNIQUE,
                product_id          INTEGER NOT NULL,
                seller_id           INTEGER NOT NULL,
                customer_id         INTEGER NOT NULL,
                sale_price          REAL NOT NULL,
                platform_commission REAL DEFAULT 0,
                seller_earning      REAL DEFAULT 0,
                status              TEXT DEFAULT 'pending',
                case_id             INTEGER,
                created_at          REAL DEFAULT (unixepoch()),
                completed_at        REAL,
                updated_at          REAL DEFAULT (unixepoch()),
                FOREIGN KEY (order_id) REFERENCES manual_orders(id),
                FOREIGN KEY (product_id) REFERENCES manual_products(id),
                FOREIGN KEY (seller_id) REFERENCES users(user_id),
                FOREIGN KEY (customer_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_account_seller_sales_seller ON account_seller_sales(seller_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_account_seller_sales_customer ON account_seller_sales(customer_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_account_seller_sales_status ON account_seller_sales(status);

            CREATE TABLE IF NOT EXISTS delivery_events (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id        INTEGER NOT NULL,
                event_type      TEXT NOT NULL,
                actor_id        INTEGER DEFAULT 0,
                delivery_data   TEXT,
                admin_note      TEXT,
                status          TEXT DEFAULT 'ok',
                error_message   TEXT,
                created_at      REAL DEFAULT (unixepoch()),
                FOREIGN KEY (order_id) REFERENCES manual_orders(id)
            );
            CREATE INDEX IF NOT EXISTS idx_delivery_events_order ON delivery_events(order_id, created_at);
        """)
        async with db.execute("PRAGMA table_info(manual_orders)") as c:
            order_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [
            ("option_id", "INTEGER"),
            ("option_name", "TEXT"),
            ("customer_data", "TEXT"),
            ("seller_id", "INTEGER"),
            ("completed_by", "INTEGER"),
        ]:
            if col not in order_cols:
                await db.execute(f"ALTER TABLE manual_orders ADD COLUMN {col} {defn}")
        async with db.execute("PRAGMA table_info(manual_products)") as c:
            product_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [
            ("created_by", "INTEGER"),
            ("auto_delivery_type", "TEXT"),
            ("auto_delivery_text", "TEXT"),
            ("auto_delivery_file_url", "TEXT"),
            ("auto_delivery_file_name", "TEXT"),
            ("auto_delivery_file_mime", "TEXT"),
            ("account_game", "TEXT"),
            ("account_platform", "TEXT"),
            ("account_region", "TEXT"),
            ("account_level", "TEXT"),
            ("account_rank", "TEXT"),
            ("account_items", "TEXT"),
            ("account_currency", "TEXT"),
            ("account_access_method", "TEXT"),
            ("account_status", "TEXT DEFAULT 'active'"),
            ("account_warranty", "TEXT"),
            ("account_terms", "TEXT"),
            ("account_images", "TEXT"),
        ]:
            if col not in product_cols:
                await db.execute(f"ALTER TABLE manual_products ADD COLUMN {col} {defn}")
        async with db.execute("PRAGMA table_info(account_seller_profiles)") as c:
            profile_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [("seller_type", "TEXT DEFAULT 'account'")]:
            if col not in profile_cols:
                await db.execute(f"ALTER TABLE account_seller_profiles ADD COLUMN {col} {defn}")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_account_seller_profiles_type ON account_seller_profiles(seller_type)")
        await db.commit()


async def get_manual_options(product_id: int, active_only: bool = True) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = "SELECT * FROM manual_product_options WHERE product_id=?"
        params = [product_id]
        if active_only:
            q += " AND is_active=1"
        q += " ORDER BY sort_order, price, name"
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def replace_manual_options(product_id: int, options: list[dict]):
    async with aiosqlite.connect(DB) as db:
        await db.execute("DELETE FROM manual_product_options WHERE product_id=?", (product_id,))
        for i, opt in enumerate(options or []):
            name = str(opt.get("name", "")).strip()
            if not name:
                continue
            await db.execute("""
                INSERT INTO manual_product_options
                (product_id, name, price, stock, sort_order, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                product_id, name, float(opt.get("price", 0) or 0),
                int(opt.get("stock", -1) if opt.get("stock", -1) not in (None, "") else -1),
                int(opt.get("sort_order", i + 1) or i + 1),
                1 if opt.get("is_active", True) else 0,
            ))
        await db.commit()


async def get_manual_fields(product_id: int, active_only: bool = True) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = "SELECT * FROM manual_product_fields WHERE product_id=?"
        params = [product_id]
        if active_only:
            q += " AND is_active=1"
        q += " ORDER BY sort_order, id"
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def replace_manual_fields(product_id: int, fields: list[dict]):
    async with aiosqlite.connect(DB) as db:
        await db.execute("DELETE FROM manual_product_fields WHERE product_id=?", (product_id,))
        for i, field in enumerate(fields or []):
            label = str(field.get("label", "")).strip()
            if not label:
                continue
            await db.execute("""
                INSERT INTO manual_product_fields
                (product_id, label, field_type, placeholder, is_required, sort_order, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                product_id, label, field.get("field_type", "text") or "text",
                field.get("placeholder", ""),
                1 if field.get("is_required", True) else 0,
                int(field.get("sort_order", i + 1) or i + 1),
                1 if field.get("is_active", True) else 0,
            ))
        await db.commit()


async def get_manual_products(active_only: bool = True, created_by: int = None) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = "SELECT * FROM manual_products"
        params = []
        filters = []
        if active_only:
            filters.append("is_active=1")
        if created_by is not None:
            filters.append("created_by=?")
            params.append(created_by)
        if filters:
            q += " WHERE " + " AND ".join(filters)
        q += " ORDER BY category, name"
        async with db.execute(q, params) as c:
            products = [dict(r) for r in await c.fetchall()]
        for product in products:
            options = await get_manual_options(product["id"], active_only=active_only)
            product["options"] = options
            product["fields"] = await get_manual_fields(product["id"], active_only=active_only)
            active_options = [o for o in options if o.get("is_active", 1)]
            if active_options:
                product["price"] = min(float(o.get("price", 0) or 0) for o in active_options)
        return products


async def get_manual_product(product_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM manual_products WHERE id=?", (product_id,)
        ) as c:
            r = await c.fetchone()
            if not r:
                return None
            product = dict(r)
            product["options"] = await get_manual_options(product_id, active_only=False)
            product["fields"] = await get_manual_fields(product_id, active_only=False)
            return product


async def create_manual_product(data: dict) -> int:
    async with aiosqlite.connect(DB) as db:
        c = await db.execute("""
            INSERT INTO manual_products (name, description, category, price, icon_url,
                delivery_type, instructions, account_game, account_platform, account_region,
                account_level, account_rank, account_items, account_currency, account_access_method,
                account_status, account_warranty, account_terms, account_images, auto_delivery_type, auto_delivery_text,
                auto_delivery_file_url, auto_delivery_file_name, auto_delivery_file_mime,
                is_active, stock, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["name"], data.get("description", ""),
            data.get("category", "service"), data["price"],
            data.get("icon_url"), data.get("delivery_type", "manual"),
            data.get("instructions", ""), data.get("account_game", ""),
            data.get("account_platform", ""), data.get("account_region", ""),
            data.get("account_level", ""), data.get("account_rank", ""),
            data.get("account_items", ""), data.get("account_currency", ""),
            data.get("account_access_method", ""), data.get("account_status", "active"),
            data.get("account_warranty", ""), data.get("account_terms", ""),
            data.get("account_images", ""), data.get("auto_delivery_type"), data.get("auto_delivery_text"), data.get("auto_delivery_file_url"),
            data.get("auto_delivery_file_name"), data.get("auto_delivery_file_mime"),
            data.get("is_active", 1), data.get("stock", -1), data.get("created_by"),
        ))
        await db.commit()
        product_id = c.lastrowid
    if "options" in data:
        await replace_manual_options(product_id, data.get("options") or [])
    if "fields" in data:
        await replace_manual_fields(product_id, data.get("fields") or [])
    return product_id


async def update_manual_product(product_id: int, data: dict):
    async with aiosqlite.connect(DB) as db:
        fields = []
        values = []
        for k in ["name", "description", "category", "price", "icon_url",
                   "delivery_type", "instructions", "account_game", "account_platform",
                   "account_region", "account_level", "account_rank", "account_items",
                   "account_currency", "account_access_method", "account_status",
                   "account_warranty", "account_terms", "account_images", "auto_delivery_type",
                   "auto_delivery_text", "auto_delivery_file_url",
                   "auto_delivery_file_name", "auto_delivery_file_mime",
                   "is_active", "stock"]:
            if k in data:
                fields.append(f"{k}=?")
                values.append(data[k])
        if not fields:
            return
        fields.append("updated_at=?")
        values.append(__import__("time").time())
        values.append(product_id)
        await db.execute(
            f"UPDATE manual_products SET {', '.join(fields)} WHERE id=?",
            values,
        )
        await db.commit()
    if "options" in data:
        await replace_manual_options(product_id, data.get("options") or [])
    if "fields" in data:
        await replace_manual_fields(product_id, data.get("fields") or [])


async def delete_manual_product(product_id: int):
    async with aiosqlite.connect(DB) as db:
        await db.execute("DELETE FROM manual_products WHERE id=?", (product_id,))
        await db.commit()


async def create_manual_order(product_id: int, user_id: int, price: float, option_id: int = None, option_name: str = None, customer_data: dict = None) -> int:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT created_by FROM manual_products WHERE id=?", (product_id,)) as p:
            product = await p.fetchone()
        seller_id = product["created_by"] if product else None
        c = await db.execute("""
            INSERT INTO manual_orders (product_id, option_id, option_name, user_id, seller_id, price, customer_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (product_id, option_id, option_name, user_id, seller_id, price, json.dumps(customer_data or {}, ensure_ascii=False)))
        # Descontar stock si no es ilimitado
        if option_id:
            await db.execute("""
                UPDATE manual_product_options SET stock = stock - 1
                WHERE id = ? AND stock > 0
            """, (option_id,))
        else:
            await db.execute("""
                UPDATE manual_products SET stock = stock - 1
                WHERE id = ? AND stock > 0
            """, (product_id,))
        await db.commit()
        return c.lastrowid


async def add_digital_stock_items(product_id: int, items: list[dict], created_by: int = None) -> int:
    async with aiosqlite.connect(DB) as db:
        count = 0
        for item in items or []:
            payload = str(item.get("payload", "")).strip()
            if not payload:
                continue
            await db.execute("""
                INSERT INTO digital_stock_items
                (product_id, option_id, stock_type, label, payload, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                product_id,
                item.get("option_id"),
                item.get("stock_type") or "code",
                item.get("label") or "",
                payload,
                created_by,
            ))
            count += 1
        await db.commit()
        return count


async def get_digital_stock_counts(product_id: int) -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT COALESCE(option_id, 0) as option_id, stock_type, status, COUNT(*) as count
            FROM digital_stock_items
            WHERE product_id=?
            GROUP BY COALESCE(option_id, 0), stock_type, status
        """, (product_id,)) as c:
            rows = [dict(r) for r in await c.fetchall()]
        totals = {"available": 0, "used": 0, "reserved": 0, "total": 0, "by_option": {}}
        for row in rows:
            status = row.get("status") or "available"
            count = int(row.get("count") or 0)
            totals[status] = totals.get(status, 0) + count
            totals["total"] += count
            opt_key = str(row.get("option_id") or 0)
            bucket = totals["by_option"].setdefault(opt_key, {"available": 0, "used": 0, "reserved": 0, "total": 0})
            bucket[status] = bucket.get(status, 0) + count
            bucket["total"] += count
        return totals


async def list_digital_stock_items(product_id: int, status: str = None, limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = "SELECT id, product_id, option_id, stock_type, label, status, order_id, used_by, used_at, created_at FROM digital_stock_items WHERE product_id=?"
        params = [product_id]
        if status:
            q += " AND status=?"
            params.append(status)
        q += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def consume_digital_stock_item(product_id: int, order_id: int, user_id: int, option_id: int = None) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        params = [product_id]
        option_filter = ""
        if option_id is not None:
            option_filter = " AND (option_id=? OR option_id IS NULL)"
            params.append(option_id)
        async with db.execute(f"""
            SELECT * FROM digital_stock_items
            WHERE product_id=? AND status='available'{option_filter}
            ORDER BY CASE WHEN option_id IS NULL THEN 1 ELSE 0 END, id
            LIMIT 1
        """, params) as c:
            row = await c.fetchone()
        if not row:
            return None
        item = dict(row)
        await db.execute("""
            UPDATE digital_stock_items
            SET status='used', order_id=?, used_by=?, used_at=?, updated_at=?
            WHERE id=? AND status='available'
        """, (order_id, user_id, time.time(), time.time(), item["id"]))
        await db.commit()
        return item


async def get_manual_orders(user_id: int = None, status: str = None, limit: int = 50, seller_id: int = None) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """SELECT mo.*, mp.name as product_name, mp.category, mp.delivery_type, mp.icon_url, mp.account_images, mp.created_by as product_owner_id,
                      cu.first_name AS customer_name, cu.username AS customer_username, cu.email AS customer_email,
                      su.first_name AS seller_name, su.username AS seller_username, su.email AS seller_email,
                      asp.store_name AS seller_store_name, asp.store_slug AS seller_store_slug, asp.store_image AS seller_store_image
               FROM manual_orders mo
               JOIN manual_products mp ON mo.product_id = mp.id
               LEFT JOIN users cu ON cu.user_id = mo.user_id
               LEFT JOIN users su ON su.user_id = COALESCE(mo.seller_id, mp.created_by)
               LEFT JOIN account_seller_profiles asp ON asp.user_id = COALESCE(mo.seller_id, mp.created_by)
               WHERE 1=1"""
        params = []
        if user_id:
            q += " AND mo.user_id=?"
            params.append(user_id)
        if status:
            q += " AND mo.status=?"
            params.append(status)
        if seller_id is not None:
            q += " AND COALESCE(mo.seller_id, mp.created_by)=?"
            params.append(seller_id)
        q += " ORDER BY mo.created_at DESC LIMIT ?"
        params.append(limit)
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def add_delivery_event(order_id: int, event_type: str, actor_id: int = 0, delivery_data: str = "", admin_note: str = "", status: str = "ok", error_message: str = ""):
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO delivery_events (order_id, event_type, actor_id, delivery_data, admin_note, status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (order_id, event_type, actor_id or 0, delivery_data, admin_note, status, error_message))
        await db.commit()


async def get_delivery_events(order_id: int, limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM delivery_events WHERE order_id=? ORDER BY created_at DESC LIMIT ?",
            (order_id, limit),
        ) as c:
            return [dict(r) for r in await c.fetchall()]


async def get_manual_order_by_id(order_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT mo.*, mp.name as product_name, mp.category, mp.delivery_type, mp.created_by as product_owner_id,
                   cu.first_name AS customer_name, cu.username AS customer_username, cu.email AS customer_email,
                   su.first_name AS seller_name, su.username AS seller_username, su.email AS seller_email,
                   asp.store_name AS seller_store_name, asp.store_slug AS seller_store_slug
            FROM manual_orders mo
            JOIN manual_products mp ON mo.product_id = mp.id
            LEFT JOIN users cu ON cu.user_id = mo.user_id
            LEFT JOIN users su ON su.user_id = COALESCE(mo.seller_id, mp.created_by)
            LEFT JOIN account_seller_profiles asp ON asp.user_id = COALESCE(mo.seller_id, mp.created_by)
            WHERE mo.id=?
        """, (order_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def complete_manual_order(order_id: int, delivery_data: str, admin_note: str = "", completed_by: int = None, event_type: str = "completed"):
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE manual_orders SET status='completed', delivery_data=?,
                admin_note=?, completed_by=?, completed_at=?
            WHERE id=?
        """, (delivery_data, admin_note, completed_by, __import__("time").time(), order_id))
        await db.commit()
    await add_delivery_event(order_id, event_type, completed_by or 0, delivery_data, admin_note)


async def update_manual_order_delivery(order_id: int, delivery_data: str, admin_note: str = "", actor_id: int = 0):
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE manual_orders SET delivery_data=?, admin_note=?
            WHERE id=?
        """, (delivery_data, admin_note, order_id))
        await db.commit()
    await add_delivery_event(order_id, "changed", actor_id, delivery_data, admin_note)


async def revoke_manual_order_delivery(order_id: int, actor_id: int = 0, reason: str = ""):
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE manual_orders SET status='revoked', admin_note=? WHERE id=?
        """, (reason, order_id))
        await db.commit()
    await add_delivery_event(order_id, "revoked", actor_id, "", reason)


async def count_manual_products_by_creator(user_id: int) -> int:
    async with aiosqlite.connect(DB) as db:
        async with db.execute("SELECT COUNT(*) FROM manual_products WHERE created_by=?", (user_id,)) as c:
            row = await c.fetchone()
            return int(row[0] if row else 0)


async def get_manual_sales_summary(seller_id: int = None) -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """SELECT COALESCE(mo.seller_id, mp.created_by) as seller_id,
                      COUNT(*) as total_orders,
                      SUM(CASE WHEN mo.status='completed' THEN 1 ELSE 0 END) as completed_orders,
                      SUM(CASE WHEN mo.status='completed' THEN mo.price ELSE 0 END) as completed_revenue
               FROM manual_orders mo
               JOIN manual_products mp ON mo.product_id = mp.id
               WHERE 1=1"""
        params = []
        if seller_id is not None:
            q += " AND COALESCE(mo.seller_id, mp.created_by)=?"
            params.append(seller_id)
        q += " GROUP BY COALESCE(mo.seller_id, mp.created_by)"
        async with db.execute(q, params) as c:
            rows = [dict(r) for r in await c.fetchall()]
        return {
            "total_orders": sum(int(r.get("total_orders") or 0) for r in rows),
            "completed_orders": sum(int(r.get("completed_orders") or 0) for r in rows),
            "completed_revenue": float(sum(float(r.get("completed_revenue") or 0) for r in rows)),
            "by_seller": rows,
        }


async def ensure_seller_wallet(user_id: int):
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO seller_wallets (user_id, currency, network, updated_at)
            VALUES (?, 'USDT', 'BEP20', ?)
            ON CONFLICT(user_id) DO NOTHING
        """, (user_id, time.time()))
        await db.commit()


async def get_seller_wallet(user_id: int) -> dict:
    await ensure_seller_wallet(user_id)
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM seller_wallets WHERE user_id=?", (user_id,)) as c:
            row = await c.fetchone()
            data = dict(row) if row else {}
        async with db.execute("""
            SELECT * FROM seller_wallet_movements
            WHERE seller_id=?
            ORDER BY created_at DESC
            LIMIT 50
        """, (user_id,)) as c:
            data["movements"] = [dict(r) for r in await c.fetchall()]
        return data


async def get_all_seller_wallets() -> dict[int, dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM seller_wallets") as c:
            return {int(r["user_id"]): dict(r) for r in await c.fetchall()}


async def create_seller_sale_hold(
    order_id: int,
    default_commission_pct: float = 0.0,
    min_platform_fee: float = 0.0,
    hold_days: float = 0.0,
    new_seller_days: float = 0.0,
    new_seller_hold_days: float | None = None,
) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT mo.id, mo.seller_id, mo.price, mp.created_by, mp.delivery_type,
                   COALESCE(s.commission_pct, 0) AS commission_pct,
                   COALESCE(s.created_at, 0) AS seller_created_at
            FROM manual_orders mo
            JOIN manual_products mp ON mp.id = mo.product_id
            LEFT JOIN internal_sellers s ON s.user_id = COALESCE(mo.seller_id, mp.created_by)
            WHERE mo.id=?
        """, (order_id,)) as c:
            row = await c.fetchone()
        if not row:
            return None
        seller_id = int(row["seller_id"] or row["created_by"] or 0)
        if seller_id <= 0:
            return None
        gross = float(row["price"] or 0)
        seller_commission = float(row["commission_pct"] or 0)
        commission_pct = seller_commission if seller_commission > 0 else float(default_commission_pct or 0)
        commission_pct = max(0.0, min(commission_pct, 100.0))
        percent_fee = gross * commission_pct / 100.0
        platform_fee = round(min(gross, max(percent_fee, float(min_platform_fee or 0))), 8)
        net = round(max(0.0, gross - platform_fee), 8)
        now = time.time()
        effective_hold_days = float(hold_days or 0)
        seller_created_at = float(row["seller_created_at"] or 0)
        if new_seller_hold_days is not None and new_seller_days and seller_created_at and now - seller_created_at <= float(new_seller_days) * 86400:
            effective_hold_days = max(effective_hold_days, float(new_seller_hold_days or 0))
        release_at = now + max(0.0, effective_hold_days) * 86400
        await db.execute("""
            INSERT INTO seller_wallets (user_id, currency, network, held_balance, available_balance, pending_withdrawal_balance, withdrawn_balance, lifetime_sales, lifetime_platform_fee, lifetime_net, updated_at)
            VALUES (?, 'USDT', 'BEP20', 0, 0, 0, 0, 0, 0, 0, ?)
            ON CONFLICT(user_id) DO NOTHING
        """, (seller_id, now))
        try:
            await db.execute("""
                INSERT INTO seller_wallet_movements
                (seller_id, order_id, movement_type, status, amount, gross_amount, platform_fee, currency, network, note, release_at, created_at, updated_at)
                VALUES (?, ?, 'sale_hold', 'held', ?, ?, ?, 'USDT', 'BEP20', ?, ?, ?, ?)
            """, (seller_id, order_id, net, gross, platform_fee, f"Venta retenida pedido #{order_id}", release_at, now, now))
            await db.execute("""
                UPDATE seller_wallets
                SET held_balance = held_balance + ?,
                    lifetime_sales = lifetime_sales + ?,
                    lifetime_platform_fee = lifetime_platform_fee + ?,
                    lifetime_net = lifetime_net + ?,
                    updated_at=?
                WHERE user_id=?
            """, (net, gross, platform_fee, net, now, seller_id))
        except aiosqlite.IntegrityError:
            pass
        await db.commit()
        return {
            "seller_id": seller_id,
            "gross_amount": gross,
            "platform_fee": platform_fee,
            "amount": net,
            "commission_pct": commission_pct,
            "hold_days": effective_hold_days,
            "release_at": release_at,
            "currency": "USDT",
            "network": "BEP20",
        }


async def create_auto_seller_sale_hold(
    merchant_order_id: str,
    seller_id: int,
    default_commission_pct: float = 50.0,
    hold_days: float = 0.0,
    new_seller_days: float = 0.0,
    new_seller_hold_days: float | None = None,
) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT o.id, o.merchant_order_id, o.sell_price, o.cost_price, o.platform_fee,
                   COALESCE(s.recharge_commission_pct, 0) AS recharge_commission_pct,
                   COALESCE(s.created_at, 0) AS seller_created_at
            FROM orders o
            LEFT JOIN internal_sellers s ON s.user_id=?
            WHERE o.merchant_order_id=?
        """, (seller_id, merchant_order_id)) as c:
            row = await c.fetchone()
        if not row or int(seller_id or 0) <= 0:
            return None
        gross = float(row["sell_price"] or 0)
        profit = max(0.0, float(row["platform_fee"] or 0))
        seller_commission = float(row["recharge_commission_pct"] or 0)
        commission_pct = seller_commission if seller_commission > 0 else float(default_commission_pct or 0)
        commission_pct = max(0.0, min(commission_pct, 100.0))
        amount = round(profit * commission_pct / 100.0, 8)
        platform_keep = round(max(0.0, profit - amount), 8)
        now = time.time()
        effective_hold_days = float(hold_days or 0)
        seller_created_at = float(row["seller_created_at"] or 0)
        if new_seller_hold_days is not None and new_seller_days and seller_created_at and now - seller_created_at <= float(new_seller_days) * 86400:
            effective_hold_days = max(effective_hold_days, float(new_seller_hold_days or 0))
        release_at = now + max(0.0, effective_hold_days) * 86400
        await db.execute("""
            INSERT INTO seller_wallets (user_id, currency, network, held_balance, available_balance, pending_withdrawal_balance, withdrawn_balance, lifetime_sales, lifetime_platform_fee, lifetime_net, updated_at)
            VALUES (?, 'USDT', 'BEP20', 0, 0, 0, 0, 0, 0, 0, ?)
            ON CONFLICT(user_id) DO NOTHING
        """, (seller_id, now))
        try:
            await db.execute("""
                INSERT INTO seller_wallet_movements
                (seller_id, order_id, movement_type, status, amount, gross_amount, platform_fee, currency, network, note, release_at, created_at, updated_at)
                VALUES (?, ?, 'auto_sale_hold', 'held', ?, ?, ?, 'USDT', 'BEP20', ?, ?, ?, ?)
            """, (seller_id, int(row["id"]), amount, gross, platform_keep, f"Comision recarga {merchant_order_id}", release_at, now, now))
            await db.execute("""
                UPDATE seller_wallets
                SET held_balance = held_balance + ?,
                    lifetime_sales = lifetime_sales + ?,
                    lifetime_platform_fee = lifetime_platform_fee + ?,
                    lifetime_net = lifetime_net + ?,
                    updated_at=?
                WHERE user_id=?
            """, (amount, gross, platform_keep, amount, now, seller_id))
        except aiosqlite.IntegrityError:
            pass
        await db.execute("UPDATE orders SET seller_id=?, sales_channel='seller_link', updated_at=? WHERE merchant_order_id=?", (seller_id, now, merchant_order_id))
        await db.commit()
        return {
            "seller_id": seller_id,
            "gross_amount": gross,
            "platform_profit": profit,
            "platform_fee": platform_keep,
            "amount": amount,
            "commission_pct": commission_pct,
            "hold_days": effective_hold_days,
            "release_at": release_at,
            "currency": "USDT",
            "network": "BEP20",
        }


async def void_auto_seller_sale_hold(merchant_order_id: str, note: str = "") -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id FROM orders WHERE merchant_order_id=?", (merchant_order_id,)) as c:
            order = await c.fetchone()
        if not order:
            return None
        async with db.execute("""
            SELECT * FROM seller_wallet_movements
            WHERE order_id=? AND movement_type='auto_sale_hold' AND status='held'
            LIMIT 1
        """, (int(order["id"]),)) as c:
            movement = await c.fetchone()
        if not movement:
            return None
        m = dict(movement)
        now = time.time()
        await db.execute("UPDATE seller_wallet_movements SET status='voided', note=?, updated_at=? WHERE id=?", (note or f"Recarga anulada {merchant_order_id}", now, m["id"]))
        await db.execute("""
            UPDATE seller_wallets
            SET held_balance = MAX(0, held_balance - ?),
                lifetime_sales = MAX(0, lifetime_sales - ?),
                lifetime_platform_fee = MAX(0, lifetime_platform_fee - ?),
                lifetime_net = MAX(0, lifetime_net - ?),
                updated_at=?
            WHERE user_id=?
        """, (float(m["amount"] or 0), float(m["gross_amount"] or 0), float(m["platform_fee"] or 0), float(m["amount"] or 0), now, m["seller_id"]))
        await db.commit()
        return m


async def void_seller_sale_hold(order_id: int, note: str = "") -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM seller_wallet_movements
            WHERE order_id=? AND movement_type='sale_hold' AND status='held'
            LIMIT 1
        """, (order_id,)) as c:
            movement = await c.fetchone()
        if not movement:
            return None
        m = dict(movement)
        now = time.time()
        await db.execute("""
            UPDATE seller_wallet_movements
            SET status='voided', note=?, updated_at=?
            WHERE id=?
        """, (note or f"Venta anulada pedido #{order_id}", now, m["id"]))
        await db.execute("""
            UPDATE seller_wallets
            SET held_balance = MAX(0, held_balance - ?),
                lifetime_sales = MAX(0, lifetime_sales - ?),
                lifetime_platform_fee = MAX(0, lifetime_platform_fee - ?),
                lifetime_net = MAX(0, lifetime_net - ?),
                updated_at=?
            WHERE user_id=?
        """, (float(m["amount"] or 0), float(m["gross_amount"] or 0), float(m["platform_fee"] or 0), float(m["amount"] or 0), now, m["seller_id"]))
        await db.commit()
        return m


async def release_due_seller_holds(seller_id: int | None = None) -> int:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """
            SELECT m.*
            FROM seller_wallet_movements m
            JOIN manual_orders mo ON mo.id = m.order_id
            WHERE m.movement_type='sale_hold'
              AND m.status='held'
              AND COALESCE(m.release_at, 0) > 0
              AND m.release_at <= ?
              AND mo.status='completed'
        """
        params = [now]
        if seller_id is not None:
            q += " AND m.seller_id=?"
            params.append(seller_id)
        async with db.execute(q, params) as c:
            rows = [dict(r) for r in await c.fetchall()]

        q_auto = """
            SELECT m.*
            FROM seller_wallet_movements m
            JOIN orders o ON o.id = m.order_id
            WHERE m.movement_type='auto_sale_hold'
              AND m.status='held'
              AND COALESCE(m.release_at, 0) > 0
              AND m.release_at <= ?
              AND o.order_status=2
        """
        params_auto = [now]
        if seller_id is not None:
            q_auto += " AND m.seller_id=?"
            params_auto.append(seller_id)
        async with db.execute(q_auto, params_auto) as c:
            rows.extend([dict(r) for r in await c.fetchall()])

        for m in rows:
            amount = float(m.get("amount") or 0)
            await db.execute("""
                UPDATE seller_wallet_movements
                SET status='available', updated_at=?
                WHERE id=? AND status='held'
            """, (now, m["id"]))
            await db.execute("""
                UPDATE seller_wallets
                SET held_balance = MAX(0, held_balance - ?),
                    available_balance = available_balance + ?,
                    updated_at=?
                WHERE user_id=?
            """, (amount, amount, now, m["seller_id"]))
        await db.commit()
        return len(rows)


async def list_seller_withdrawals(seller_id: int | None = None, status: str | None = None, limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """
            SELECT sw.*, u.username, u.first_name, u.email
            FROM seller_withdrawals sw
            LEFT JOIN users u ON u.user_id = sw.seller_id
            WHERE 1=1
        """
        params = []
        if seller_id is not None:
            q += " AND sw.seller_id=?"
            params.append(seller_id)
        if status:
            q += " AND sw.status=?"
            params.append(status)
        q += " ORDER BY sw.requested_at DESC LIMIT ?"
        params.append(max(1, min(int(limit or 100), 500)))
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def create_seller_withdrawal(seller_id: int, amount: float, wallet_address: str, fee_amount: float = 0.0, note: str = "") -> dict:
    amount = round(float(amount or 0), 8)
    fee_amount = round(max(0.0, float(fee_amount or 0)), 8)
    net_amount = round(max(0.0, amount - fee_amount), 8)
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        await db.execute("""
            INSERT INTO seller_wallets (user_id, currency, network, held_balance, available_balance, pending_withdrawal_balance, withdrawn_balance, lifetime_sales, lifetime_platform_fee, lifetime_net, updated_at)
            VALUES (?, 'USDT', 'BEP20', 0, 0, 0, 0, 0, 0, 0, ?)
            ON CONFLICT(user_id) DO NOTHING
        """, (seller_id, now))
        async with db.execute("SELECT * FROM seller_wallets WHERE user_id=?", (seller_id,)) as c:
            wallet = await c.fetchone()
        available = float(wallet["available_balance"] or 0) if wallet else 0
        if amount <= 0:
            await db.rollback()
            raise ValueError("Monto inválido")
        if available + 1e-9 < amount:
            await db.rollback()
            raise ValueError("Saldo disponible insuficiente")
        cur = await db.execute("""
            INSERT INTO seller_withdrawals
            (seller_id, amount, fee_amount, net_amount, currency, network, wallet_address, status, note, requested_at, updated_at)
            VALUES (?, ?, ?, ?, 'USDT', 'BEP20', ?, 'pending', ?, ?, ?)
        """, (seller_id, amount, fee_amount, net_amount, wallet_address.strip(), note or "", now, now))
        wid = cur.lastrowid
        await db.execute("""
            UPDATE seller_wallets
            SET available_balance = MAX(0, available_balance - ?),
                pending_withdrawal_balance = pending_withdrawal_balance + ?,
                updated_at=?
            WHERE user_id=?
        """, (amount, amount, now, seller_id))
        await db.execute("""
            INSERT INTO seller_wallet_movements
            (seller_id, movement_type, status, amount, gross_amount, platform_fee, currency, network, note, created_at, updated_at)
            VALUES (?, 'withdrawal_request', 'pending', ?, ?, ?, 'USDT', 'BEP20', ?, ?, ?)
        """, (seller_id, -amount, amount, fee_amount, f"Solicitud retiro #{wid}", now, now))
        await db.commit()
        return {"id": wid, "seller_id": seller_id, "amount": amount, "fee_amount": fee_amount, "net_amount": net_amount, "currency": "USDT", "network": "BEP20", "status": "pending"}


async def get_seller_withdrawal(withdrawal_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM seller_withdrawals WHERE id=?", (withdrawal_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def mark_seller_withdrawal_processing(withdrawal_id: int, provider_track_id: str, provider_status: str, raw_response: str = "") -> dict | None:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM seller_withdrawals WHERE id=?", (withdrawal_id,)) as c:
            row = await c.fetchone()
        if not row:
            return None
        if row["status"] != "pending":
            raise ValueError("Este retiro ya fue procesado")
        await db.execute("""
            UPDATE seller_withdrawals
            SET status='processing', provider_track_id=?, provider_status=?, raw_response=?, updated_at=?
            WHERE id=?
        """, (provider_track_id or "", provider_status or "processing", raw_response or "", now, withdrawal_id))
        await db.execute("""
            INSERT INTO seller_wallet_movements
            (seller_id, movement_type, status, amount, gross_amount, platform_fee, currency, network, note, created_at, updated_at)
            VALUES (?, 'withdrawal_oxapay_sent', 'processing', ?, ?, ?, 'USDT', 'BEP20', ?, ?, ?)
        """, (row["seller_id"], -float(row["amount"] or 0), float(row["amount"] or 0), float(row["fee_amount"] or 0), f"OxaPay payout {provider_track_id}", now, now))
        await db.commit()
        data = dict(row)
        data.update({"status": "processing", "provider_track_id": provider_track_id, "provider_status": provider_status, "raw_response": raw_response})
        return data


async def decide_seller_withdrawal(withdrawal_id: int, status: str, reviewed_by: int, txid: str = "", note: str = "") -> dict | None:
    if status not in ("approved", "rejected"):
        raise ValueError("Estado inválido")
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        async with db.execute("SELECT * FROM seller_withdrawals WHERE id=?", (withdrawal_id,)) as c:
            row = await c.fetchone()
        if not row:
            await db.rollback()
            return None
        w = dict(row)
        if w.get("status") not in ("pending", "processing"):
            await db.rollback()
            raise ValueError("Este retiro ya fue procesado")
        amount = float(w.get("amount") or 0)
        if status == "approved":
            await db.execute("""
                UPDATE seller_wallets
                SET pending_withdrawal_balance = MAX(0, pending_withdrawal_balance - ?),
                    withdrawn_balance = withdrawn_balance + ?,
                    updated_at=?
                WHERE user_id=?
            """, (amount, amount, now, w["seller_id"]))
        else:
            await db.execute("""
                UPDATE seller_wallets
                SET pending_withdrawal_balance = MAX(0, pending_withdrawal_balance - ?),
                    available_balance = available_balance + ?,
                    updated_at=?
                WHERE user_id=?
            """, (amount, amount, now, w["seller_id"]))
        await db.execute("""
            UPDATE seller_withdrawals
            SET status=?, txid=?, provider_status=?, note=?, reviewed_by=?, reviewed_at=?, updated_at=?
            WHERE id=?
        """, (status, txid or "", "confirmed" if status == "approved" else "rejected", note or "", reviewed_by, now, now, withdrawal_id))
        await db.execute("""
            INSERT INTO seller_wallet_movements
            (seller_id, movement_type, status, amount, gross_amount, platform_fee, currency, network, note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'USDT', 'BEP20', ?, ?, ?)
        """, (w["seller_id"], f"withdrawal_{status}", status, -amount if status == "approved" else amount, amount, float(w.get("fee_amount") or 0), note or f"Retiro #{withdrawal_id} {status}", now, now))
        await db.commit()
        w.update({"status": status, "txid": txid or "", "note": note or "", "reviewed_by": reviewed_by, "reviewed_at": now})
        return w


ACCOUNT_SELLER_PUBLIC_FIELDS = """
    asp.id, asp.user_id, asp.store_name, asp.store_slug, asp.store_description,
    asp.store_image, asp.banner_image, asp.whatsapp_url, asp.social_url_1,
    asp.social_url_2, asp.allow_external_links, asp.status,
    asp.max_active_products, asp.commission_percent, asp.total_sales,
    asp.total_orders, asp.rating, asp.seller_type, asp.created_at, asp.updated_at,
    u.username, u.first_name, u.email
"""


async def get_account_seller_profile(user_id: int = None, slug: str = None, active_only: bool = False) -> dict | None:
    if user_id is None and not slug:
        return None
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        where = "asp.user_id=?" if user_id is not None else "asp.store_slug=?"
        params = [user_id if user_id is not None else slug]
        if active_only:
            where += " AND asp.status='active'"
        async with db.execute(f"""
            SELECT {ACCOUNT_SELLER_PUBLIC_FIELDS}
            FROM account_seller_profiles asp
            LEFT JOIN users u ON u.user_id = asp.user_id
            WHERE {where}
        """, params) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def list_account_seller_profiles(status: str = None, limit: int = 200) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = f"""
            SELECT {ACCOUNT_SELLER_PUBLIC_FIELDS},
                   COUNT(mp.id) AS products_count,
                   SUM(CASE WHEN mp.is_active=1 AND mp.category='game_account' THEN 1 ELSE 0 END) AS active_products
            FROM account_seller_profiles asp
            LEFT JOIN users u ON u.user_id = asp.user_id
            LEFT JOIN manual_products mp ON mp.created_by = asp.user_id AND mp.category='game_account'
            WHERE 1=1
        """
        params = []
        if status:
            q += " AND asp.status=?"
            params.append(status)
        q += " GROUP BY asp.user_id ORDER BY asp.updated_at DESC LIMIT ?"
        params.append(max(1, min(int(limit or 200), 500)))
        async with db.execute(q, params) as c:
            rows = [dict(r) for r in await c.fetchall()]
        for row in rows:
            row["products_count"] = int(row.get("products_count") or 0)
            row["active_products"] = int(row.get("active_products") or 0)
        return rows


async def upsert_account_seller_profile(user_id: int, data: dict, created_by: int = None) -> dict:
    now = time.time()
    store_name = str(data.get("store_name") or "").strip()
    store_slug = str(data.get("store_slug") or "").strip().lower()
    if not store_name or not store_slug:
        raise ValueError("store_name and store_slug are required")
    status = str(data.get("status") or "active").strip().lower()
    if status not in {"pending", "active", "suspended", "disabled"}:
        status = "active"
    seller_type = str(data.get("seller_type") or "account").strip().lower()
    if seller_type not in {"account", "general"}:
        seller_type = "account"
    max_active = max(0, min(int(data.get("max_active_products") or 10), 10000))
    commission = max(0, min(float(data.get("commission_percent") or 10), 100))
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("""
            INSERT INTO account_seller_profiles
            (user_id, store_name, store_slug, store_description, store_image, banner_image,
             whatsapp_url, social_url_1, social_url_2, allow_external_links, status,
             max_active_products, commission_percent, seller_type, created_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                store_name=excluded.store_name,
                store_slug=excluded.store_slug,
                store_description=excluded.store_description,
                store_image=excluded.store_image,
                banner_image=excluded.banner_image,
                whatsapp_url=excluded.whatsapp_url,
                social_url_1=excluded.social_url_1,
                social_url_2=excluded.social_url_2,
                allow_external_links=excluded.allow_external_links,
                status=excluded.status,
                max_active_products=excluded.max_active_products,
                commission_percent=excluded.commission_percent,
                seller_type=excluded.seller_type,
                updated_at=excluded.updated_at
        """, (
            user_id, store_name, store_slug, data.get("store_description") or "",
            data.get("store_image") or "", data.get("banner_image") or "",
            data.get("whatsapp_url") or "", data.get("social_url_1") or "",
            data.get("social_url_2") or "", 1 if data.get("allow_external_links", True) else 0,
            status, max_active, commission, seller_type, created_by, now,
        ))
        await db.commit()
    return await get_account_seller_profile(user_id=user_id) or {}


async def count_active_account_products_by_seller(user_id: int) -> int:
    async with aiosqlite.connect(DB) as db:
        async with db.execute("""
            SELECT COUNT(*) FROM manual_products
            WHERE created_by=? AND category='game_account' AND is_active=1 AND COALESCE(account_status, 'active') != 'sold'
        """, (user_id,)) as c:
            row = await c.fetchone()
            return int(row[0] or 0)


async def get_public_account_seller_store(slug: str) -> dict | None:
    profile = await get_account_seller_profile(slug=slug, active_only=True)
    if not profile:
        return None
    seller_type = profile.get("seller_type") or "account"
    products = await get_manual_products(active_only=True, created_by=int(profile["user_id"]))
    if seller_type == "account":
        products = [p for p in products if p.get("category") == "game_account" and (p.get("account_status") or "active") != "sold"]
    else:
        products = [p for p in products if (p.get("account_status") or "active") != "sold"]
    return {"seller": profile, "products": products}


async def create_account_seller_sale(order_id: int, product_id: int, seller_id: int, customer_id: int, sale_price: float, platform_commission: float = 0.0, seller_earning: float = 0.0, status: str = "pending") -> dict | None:
    now = time.time()
    if not seller_id:
        return None
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("""
            INSERT INTO account_seller_sales
            (order_id, product_id, seller_id, customer_id, sale_price, platform_commission, seller_earning, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(order_id) DO UPDATE SET
                product_id=excluded.product_id,
                seller_id=excluded.seller_id,
                customer_id=excluded.customer_id,
                sale_price=excluded.sale_price,
                platform_commission=excluded.platform_commission,
                seller_earning=excluded.seller_earning,
                status=excluded.status,
                updated_at=excluded.updated_at
        """, (order_id, product_id, seller_id, customer_id, float(sale_price or 0), float(platform_commission or 0), float(seller_earning or 0), status, now))
        await db.execute("""
            UPDATE account_seller_profiles
            SET total_sales = (SELECT COALESCE(SUM(sale_price), 0) FROM account_seller_sales WHERE seller_id=? AND status IN ('pending','completed','delivered')),
                total_orders = (SELECT COUNT(*) FROM account_seller_sales WHERE seller_id=? AND status IN ('pending','completed','delivered')),
                updated_at=?
            WHERE user_id=?
        """, (seller_id, seller_id, now, seller_id))
        await db.commit()
    return await get_account_seller_sale(order_id)


async def get_account_seller_sale(order_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT s.*, mp.name AS product_name, mp.category, u.first_name AS customer_name,
                   u.username AS customer_username, asp.store_name, asp.store_slug
            FROM account_seller_sales s
            JOIN manual_products mp ON mp.id = s.product_id
            LEFT JOIN users u ON u.user_id = s.customer_id
            LEFT JOIN users su ON su.user_id = s.seller_id
            LEFT JOIN account_seller_profiles asp ON asp.user_id = s.seller_id
            WHERE s.order_id=?
        """, (order_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def link_account_seller_sale_case(order_id: int, case_id: int):
    async with aiosqlite.connect(DB) as db:
        await db.execute("UPDATE account_seller_sales SET case_id=?, updated_at=? WHERE order_id=?", (case_id, time.time(), order_id))
        await db.commit()


async def update_account_seller_sale_status(order_id: int, status: str, completed_at: float | None = None):
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT seller_id FROM account_seller_sales WHERE order_id=?", (order_id,)) as c:
            row = await c.fetchone()
        await db.execute("""
            UPDATE account_seller_sales
            SET status=?, completed_at=COALESCE(?, completed_at), updated_at=?
            WHERE order_id=?
        """, (status, completed_at, now, order_id))
        if row:
            seller_id = int(row["seller_id"] or 0)
            await db.execute("""
                UPDATE account_seller_profiles
                SET total_sales = (SELECT COALESCE(SUM(sale_price), 0) FROM account_seller_sales WHERE seller_id=? AND status IN ('pending','completed','delivered')),
                    total_orders = (SELECT COUNT(*) FROM account_seller_sales WHERE seller_id=? AND status IN ('pending','completed','delivered')),
                    updated_at=?
                WHERE user_id=?
            """, (seller_id, seller_id, now, seller_id))
        await db.commit()


async def list_account_seller_sales(seller_id: int = None, status: str = None, limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """
            SELECT s.*, mp.name AS product_name, mp.account_game, mp.account_platform, mp.account_region,
                   mo.status AS order_status, mo.option_name, mo.customer_data, mo.created_at AS order_created_at,
                   c.id AS case_id_live, c.status AS case_status,
                   u.first_name AS customer_name, u.username AS customer_username, u.email AS customer_email,
                   su.first_name AS seller_name, su.username AS seller_username, su.email AS seller_email,
                   asp.store_name, asp.store_slug
            FROM account_seller_sales s
            JOIN manual_products mp ON mp.id = s.product_id
            JOIN manual_orders mo ON mo.id = s.order_id
            LEFT JOIN manual_order_cases c ON c.order_id = s.order_id
            LEFT JOIN users u ON u.user_id = s.customer_id
            LEFT JOIN users su ON su.user_id = s.seller_id
            LEFT JOIN account_seller_profiles asp ON asp.user_id = s.seller_id
            WHERE 1=1
        """
        params=[]
        if seller_id is not None:
            q += " AND s.seller_id=?"
            params.append(seller_id)
        if status:
            q += " AND s.status=?"
            params.append(status)
        q += " ORDER BY s.created_at DESC LIMIT ?"
        params.append(max(1, min(int(limit or 100), 500)))
        async with db.execute(q, params) as c:
            rows = [dict(r) for r in await c.fetchall()]
        for row in rows:
            if row.get("case_id") is None and row.get("case_id_live") is not None:
                row["case_id"] = row.get("case_id_live")
        return rows


async def create_or_get_manual_order_case(order_id: int, product_id: int = None, customer_id: int = None, seller_id: int = None, initial_message: str = None) -> int:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id FROM manual_order_cases WHERE order_id=?", (order_id,)) as c:
            row = await c.fetchone()
            if row:
                return int(row["id"])
        if product_id is None or customer_id is None:
            async with db.execute("SELECT product_id, user_id, seller_id FROM manual_orders WHERE id=?", (order_id,)) as c:
                order = await c.fetchone()
                if not order:
                    raise ValueError("manual order not found")
                product_id = product_id if product_id is not None else order["product_id"]
                customer_id = customer_id if customer_id is not None else order["user_id"]
                seller_id = seller_id if seller_id is not None else order["seller_id"]
        cur = await db.execute("""
            INSERT INTO manual_order_cases (order_id, product_id, customer_id, seller_id, status)
            VALUES (?, ?, ?, ?, 'open')
        """, (order_id, product_id, customer_id, seller_id))
        case_id = cur.lastrowid
        if initial_message:
            await db.execute("""
                INSERT INTO manual_order_case_messages (case_id, order_id, sender_id, sender_role, message, is_internal_note)
                VALUES (?, ?, 0, 'system', ?, 0)
            """, (case_id, order_id, initial_message))
        await db.commit()
        return int(case_id)


async def get_manual_order_case_by_order(order_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT c.*, mo.status as order_status, mo.price, mo.option_name, mo.created_at as order_created_at,
                   mp.name as product_name, mp.category, mp.created_by as product_owner_id,
                   u.first_name as customer_name, u.username as customer_username, u.email as customer_email,
                   su.first_name as seller_name, su.username as seller_username, su.email as seller_email,
                   asp.store_name as seller_store_name, asp.store_slug as seller_store_slug
            FROM manual_order_cases c
            JOIN manual_orders mo ON mo.id = c.order_id
            JOIN manual_products mp ON mp.id = c.product_id
            LEFT JOIN users u ON u.user_id = c.customer_id
            LEFT JOIN users su ON su.user_id = COALESCE(c.seller_id, mp.created_by)
            LEFT JOIN account_seller_profiles asp ON asp.user_id = COALESCE(c.seller_id, mp.created_by)
            WHERE c.order_id=?
        """, (order_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def list_manual_order_cases(status: str = None, customer_id: int = None, seller_id: int = None, limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """
            SELECT c.*, mo.status as order_status, mo.price, mo.option_name, mo.created_at as order_created_at,
                   mp.name as product_name, mp.category, mp.created_by as product_owner_id,
                   u.first_name as customer_name, u.username as customer_username, u.email as customer_email,
                   su.first_name as seller_name, su.username as seller_username, su.email as seller_email,
                   asp.store_name as seller_store_name, asp.store_slug as seller_store_slug
            FROM manual_order_cases c
            JOIN manual_orders mo ON mo.id = c.order_id
            JOIN manual_products mp ON mp.id = c.product_id
            LEFT JOIN users u ON u.user_id = c.customer_id
            LEFT JOIN users su ON su.user_id = COALESCE(c.seller_id, mp.created_by)
            LEFT JOIN account_seller_profiles asp ON asp.user_id = COALESCE(c.seller_id, mp.created_by)
            WHERE 1=1
        """
        params=[]
        if status:
            q += " AND c.status=?"
            params.append(status)
        if customer_id is not None:
            q += " AND c.customer_id=?"
            params.append(customer_id)
        if seller_id is not None:
            q += " AND COALESCE(c.seller_id, mp.created_by)=?"
            params.append(seller_id)
        q += " ORDER BY c.updated_at DESC LIMIT ?"
        params.append(max(1, min(int(limit or 100), 500)))
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def add_manual_case_message(case_id: int, order_id: int, sender_id: int, sender_role: str, message: str, is_internal_note: bool = False, attachment_url: str = None) -> int:
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO manual_order_case_messages (case_id, order_id, sender_id, sender_role, message, attachment_url, is_internal_note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (case_id, order_id, sender_id, sender_role, message, attachment_url, 1 if is_internal_note else 0))
        await db.execute("UPDATE manual_order_cases SET updated_at=? WHERE id=?", (time.time(), case_id))
        await db.commit()
        return int(cur.lastrowid)


async def get_manual_case_messages(case_id: int, include_internal: bool = False, limit: int = 200) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = "SELECT * FROM manual_order_case_messages WHERE case_id=? AND hidden_at IS NULL"
        params=[case_id]
        if not include_internal:
            q += " AND is_internal_note=0"
        q += " ORDER BY created_at ASC LIMIT ?"
        params.append(max(1, min(int(limit or 200), 500)))
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def update_manual_order_case_status(case_id: int, status: str, actor_id: int = 0, note: str = ""):
    now = time.time()
    closed_at = now if status in ("closed", "delivered") else None
    async with aiosqlite.connect(DB) as db:
        await db.execute("UPDATE manual_order_cases SET status=?, updated_at=?, closed_at=COALESCE(?, closed_at) WHERE id=?", (status, now, closed_at, case_id))
        await db.commit()
    if note:
        case = None
        async with aiosqlite.connect(DB) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT order_id FROM manual_order_cases WHERE id=?", (case_id,)) as c:
                case = await c.fetchone()
        if case:
            await add_manual_case_message(case_id, int(case["order_id"]), actor_id or 0, "system", note, False)


async def mark_case_read(case_id: int, user_id: int, role: str) -> float:
    """Marca el caso como leído por este usuario ahora mismo.
    Devuelve el timestamp de lectura guardado."""
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO manual_order_case_reads (case_id, user_id, role, read_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(case_id, user_id) DO UPDATE SET read_at=excluded.read_at, role=excluded.role
        """, (case_id, user_id, role, now))
        await db.commit()
    return now


async def get_case_read_status(case_id: int) -> dict:
    """Devuelve los timestamps de última lectura del caso para el cliente y el vendedor/admin."""
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT user_id, role, read_at
            FROM manual_order_case_reads
            WHERE case_id=?
        """, (case_id,)) as c:
            rows = [dict(r) for r in await c.fetchall()]
    customer_read_at = 0.0
    seller_read_at = 0.0
    for r in rows:
        if r["role"] == "customer":
            customer_read_at = max(customer_read_at, r["read_at"])
        elif r["role"] in ("seller", "admin"):
            seller_read_at = max(seller_read_at, r["read_at"])
    return {"customer_read_at": customer_read_at, "seller_read_at": seller_read_at}


# ══════════════════════════════════════
#  NOTIFICACIONES (FASE 1)
# ══════════════════════════════════════

async def create_notification(user_id: int, type: str, title: str, message: str, related_order_id: int = None, related_case_id: int = None, related_product_id: int = None, url: str = None) -> int:
    """Crea una notificación interna para un usuario."""
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO notifications (user_id, type, title, message, related_order_id, related_case_id, related_product_id, url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, type, title, message, related_order_id, related_case_id, related_product_id, url))
        await db.commit()
        return int(cur.lastrowid)


async def list_notifications(user_id: int, limit: int = 50) -> list[dict]:
    """Lista las notificaciones de un usuario ordenadas por las más recientes."""
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (user_id, limit)) as c:
            return [dict(r) for r in await c.fetchall()]


async def mark_notification_read(notification_id: int, user_id: int):
    """Marca una notificación específica de un usuario como leída."""
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE notifications
            SET is_read = 1, read_at = ?
            WHERE id = ? AND user_id = ?
        """, (now, notification_id, user_id))
        await db.commit()


async def mark_all_notifications_read(user_id: int):
    """Marca todas las notificaciones pendientes de un usuario como leídas."""
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE notifications
            SET is_read = 1, read_at = ?
            WHERE user_id = ? AND is_read = 0
        """, (now, user_id))
        await db.commit()


async def count_unread_notifications(user_id: int) -> int:
    """Devuelve el número de notificaciones no leídas de un usuario."""
    async with aiosqlite.connect(DB) as db:
        async with db.execute("""
            SELECT COUNT(*) FROM notifications
            WHERE user_id = ? AND is_read = 0
        """, (user_id,)) as c:
            row = await c.fetchone()
            return int(row[0]) if row else 0


# ══════════════════════════════════════
#  NÚMEROS VIRTUALES (SMS)
# ══════════════════════════════════════

async def create_sms_order(user_id: int, fivesim_order_id: str, phone: str, country: str, service: str, operator: str, cost_price: float, sell_price: float, raw_response: str) -> int:
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO sms_orders (user_id, fivesim_order_id, phone, country, service, operator, cost_price, sell_price, raw_response, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        """, (user_id, fivesim_order_id, phone, country, service, operator, cost_price, sell_price, raw_response))
        await db.commit()
        return int(cur.lastrowid)

async def get_sms_order(order_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sms_orders WHERE id = ?", (order_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def get_sms_order_by_fivesim_id(fivesim_order_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sms_orders WHERE fivesim_order_id = ?", (fivesim_order_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def get_user_sms_orders(user_id: int, limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM sms_orders
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (user_id, limit)) as c:
            return [dict(r) for r in await c.fetchall()]

async def update_sms_order_status(order_id: int, status: str, code: str = None, error_message: str = None):
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        if status == 'completed':
            await db.execute("""
                UPDATE sms_orders
                SET status = ?, code = ?, completed_at = ?, updated_at = ?
                WHERE id = ?
            """, (status, code, now, now, order_id))
        elif status in ('canceled', 'expired', 'failed'):
            await db.execute("""
                UPDATE sms_orders
                SET status = ?, error_message = ?, canceled_at = ?, updated_at = ?
                WHERE id = ?
            """, (status, error_message, now, now, order_id))
        else:
            await db.execute("""
                UPDATE sms_orders
                SET status = ?, updated_at = ?
                WHERE id = ?
            """, (status, now, order_id))
        await db.commit()

async def refund_sms_order(order_id: int, reason: str = "Cancelación SMS") -> bool:
    order = await get_sms_order(order_id)
    if not order:
        return False
    if order.get("refunded_at"):
        return False # Ya reembolsado
    
    sell_price = float(order["sell_price"])
    user_id = int(order["user_id"])
    
    # Reembolsar balance
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        # Aumentar balance del usuario
        await db.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (sell_price, user_id))
        # Registrar movimiento en balance_log
        await db.execute("""
            INSERT INTO balance_log (user_id, amount, type, ref_id, note)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, sell_price, "refund", f"sms_{order_id}", f"Reembolso SMS: {reason}"))
        # Actualizar orden
        await db.execute("""
            UPDATE sms_orders
            SET refunded_at = ?, status = 'canceled', updated_at = ?
            WHERE id = ?
        """, (now, now, order_id))
        await db.commit()
    
    # Crear notificación interna
    try:
        await create_notification(
            user_id=user_id,
            type="refund",
            title="Reembolso SMS",
            message=f"Se han reembolsado ${sell_price:.2f} USDT por cancelación de número virtual ({order['service']} - {order['country']})."
        )
    except Exception:
        pass
    
    return True


async def get_sms_catalog_overrides(item_type: str = None) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        if item_type:
            async with db.execute("SELECT * FROM sms_catalog_overrides WHERE item_type = ? ORDER BY sort_order ASC, item_key ASC", (item_type,)) as c:
                return [dict(r) for r in await c.fetchall()]
        else:
            async with db.execute("SELECT * FROM sms_catalog_overrides ORDER BY item_type ASC, sort_order ASC") as c:
                return [dict(r) for r in await c.fetchall()]

async def set_sms_catalog_override(item_type: str, item_key: str, display_name: str = None, icon_url: str = None, banner_url: str = None, is_featured: int = 0, is_hidden: int = 0, sort_order: int = 100, custom_markup: float = None, min_price: float = None):
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO sms_catalog_overrides (
                item_type, item_key, display_name, icon_url, banner_url, is_featured, is_hidden, sort_order, custom_markup, min_price, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(item_type, item_key) DO UPDATE SET
                display_name = COALESCE(excluded.display_name, display_name),
                icon_url = COALESCE(excluded.icon_url, icon_url),
                banner_url = COALESCE(excluded.banner_url, banner_url),
                is_featured = excluded.is_featured,
                is_hidden = excluded.is_hidden,
                sort_order = excluded.sort_order,
                custom_markup = COALESCE(excluded.custom_markup, custom_markup),
                min_price = COALESCE(excluded.min_price, min_price),
                updated_at = excluded.updated_at
        """, (item_type, item_key, display_name, icon_url, banner_url, is_featured, is_hidden, sort_order, custom_markup, min_price, now))
        await db.commit()


# ═════════════════════════════════════════════════════════════════════════
#  SOPORTE Y CHATS UNIFICADOS (HELPERS)
# ═════════════════════════════════════════════════════════════════════════

async def create_support_ticket(user_id: int, category: str, subject: str, description: str, associated_order_id: str = None, associated_order_type: str = None, associated_seller_id: int = None) -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        now = time.time()
        
        # Insert Ticket
        cursor = await db.execute("""
            INSERT INTO support_tickets (user_id, category, subject, description, associated_order_id, associated_order_type, associated_seller_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
        """, (user_id, category, subject, description, associated_order_id, associated_order_type, associated_seller_id, now, now))
        ticket_id = cursor.lastrowid
        
        # Determine room_type based on category and order type
        room_type = 'support'
        if category == 'payment_issue':
            room_type = 'payment_issue'
        elif category == 'order_issue':
            if associated_order_type == 'sms':
                room_type = 'sms_issue'
            elif associated_order_type == 'manual':
                room_type = 'order_case'
            else:
                room_type = 'support'
        elif category == 'seller_dispute':
            room_type = 'order_case'

        # Create Chat Room associated with the ticket
        cursor2 = await db.execute("""
            INSERT INTO chat_rooms (ticket_id, customer_id, seller_id, room_type, status, last_message_at, created_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?)
        """, (ticket_id, user_id, associated_seller_id, room_type, now, now))
        room_id = cursor2.lastrowid
        
        # Add initial description message as a chat message if present
        if description:
            await db.execute("""
                INSERT INTO chat_messages (room_id, sender_id, sender_role, message_text, created_at)
                VALUES (?, ?, 'customer', ?, ?)
            """, (room_id, user_id, description, now))
            
        await db.commit()
        
        async with db.execute("SELECT * FROM support_tickets WHERE id = ?", (ticket_id,)) as c:
            ticket = dict(await c.fetchone())
            ticket["room_id"] = room_id
            return ticket

async def get_or_create_direct_chat_room(customer_id: int, seller_id: int) -> int:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        # Check if active direct chat room exists (ticket_id is null)
        async with db.execute("""
            SELECT id FROM chat_rooms 
            WHERE ticket_id IS NULL AND customer_id = ? AND seller_id = ? AND status = 'active'
        """, (customer_id, seller_id)) as c:
            row = await c.fetchone()
            if row:
                return row["id"]
        
        # If not exists, create
        now = time.time()
        cursor = await db.execute("""
            INSERT INTO chat_rooms (ticket_id, customer_id, seller_id, room_type, status, last_message_at, created_at)
            VALUES (NULL, ?, ?, 'seller_direct', 'active', ?, ?)
        """, (customer_id, seller_id, now, now))
        await db.commit()
        return cursor.lastrowid

async def get_chat_room(room_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM chat_rooms WHERE id = ?", (room_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def get_chat_messages(room_id: int, limit: int = 200) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT m.*, u.username as sender_username, u.first_name as sender_first_name
            FROM chat_messages m
            LEFT JOIN users u ON u.user_id = m.sender_id
            WHERE m.room_id = ?
            ORDER BY m.created_at ASC
            LIMIT ?
        """, (room_id, limit)) as c:
            return [dict(r) for r in await c.fetchall()]

async def add_chat_message(room_id: int, sender_id: int, sender_role: str, message_text: str, attachment_url: str = None, attachment_type: str = None) -> dict:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        # Insert Message
        cursor = await db.execute("""
            INSERT INTO chat_messages (room_id, sender_id, sender_role, message_text, attachment_url, attachment_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (room_id, sender_id, sender_role, message_text, attachment_url, attachment_type, now))
        msg_id = cursor.lastrowid
        
        # Update last_message_at in room
        await db.execute("""
            UPDATE chat_rooms SET last_message_at = ? WHERE id = ?
        """, (now, room_id))
        
        # Mark read for the sender
        await db.execute("""
            INSERT INTO chat_room_reads (room_id, user_id, read_at)
            VALUES (?, ?, ?)
            ON CONFLICT(room_id, user_id) DO UPDATE SET read_at = ?
        """, (room_id, sender_id, now, now))
        
        await db.commit()
        
        async with db.execute("SELECT * FROM chat_messages WHERE id = ?", (msg_id,)) as c:
            return dict(await c.fetchone())

async def mark_room_as_read(room_id: int, user_id: int):
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO chat_room_reads (room_id, user_id, read_at)
            VALUES (?, ?, ?)
            ON CONFLICT(room_id, user_id) DO UPDATE SET read_at = ?
        """, (room_id, user_id, now, now))
        await db.commit()

async def get_room_unread_count(room_id: int, user_id: int) -> int:
    async with aiosqlite.connect(DB) as db:
        # Get last read time
        async with db.execute("SELECT read_at FROM chat_room_reads WHERE room_id = ? AND user_id = ?", (room_id, user_id)) as c:
            row = await c.fetchone()
            read_at = row[0] if row else 0
            
        # Count unread messages (sender_id != user_id)
        async with db.execute("""
            SELECT COUNT(*) FROM chat_messages 
            WHERE room_id = ? AND sender_id != ? AND created_at > ?
        """, (room_id, user_id, read_at)) as c2:
            return (await c2.fetchone())[0]

async def get_unified_inbox(user_id: int, role: str) -> list[dict]:
    items = []
    
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        
        # 1. FETCH CHAT ROOMS (Support & Direct Seller Chats)
        if role == 'admin':
            query = """
                SELECT r.*, t.category, t.subject, t.status as ticket_status,
                       u_cust.username as cust_username, u_cust.first_name as cust_first_name,
                       u_sell.username as sell_username, u_sell.first_name as sell_first_name,
                       p.store_name as seller_store_name
                FROM chat_rooms r
                LEFT JOIN support_tickets t ON t.id = r.ticket_id
                LEFT JOIN users u_cust ON u_cust.user_id = r.customer_id
                LEFT JOIN users u_sell ON u_sell.user_id = r.seller_id
                LEFT JOIN account_seller_profiles p ON p.user_id = r.seller_id
                ORDER BY r.last_message_at DESC
            """
            params = ()
        elif role == 'seller':
            query = """
                SELECT r.*, t.category, t.subject, t.status as ticket_status,
                       u_cust.username as cust_username, u_cust.first_name as cust_first_name,
                       u_sell.username as sell_username, u_sell.first_name as sell_first_name,
                       p.store_name as seller_store_name
                FROM chat_rooms r
                LEFT JOIN support_tickets t ON t.id = r.ticket_id
                LEFT JOIN users u_cust ON u_cust.user_id = r.customer_id
                LEFT JOIN users u_sell ON u_sell.user_id = r.seller_id
                LEFT JOIN account_seller_profiles p ON p.user_id = r.seller_id
                WHERE r.seller_id = ? OR r.customer_id = ?
                ORDER BY r.last_message_at DESC
            """
            params = (user_id, user_id)
        else:
            query = """
                SELECT r.*, t.category, t.subject, t.status as ticket_status,
                       u_cust.username as cust_username, u_cust.first_name as cust_first_name,
                       u_sell.username as sell_username, u_sell.first_name as sell_first_name,
                       p.store_name as seller_store_name, p.store_image as seller_store_image
                FROM chat_rooms r
                LEFT JOIN support_tickets t ON t.id = r.ticket_id
                LEFT JOIN users u_cust ON u_cust.user_id = r.customer_id
                LEFT JOIN users u_sell ON u_sell.user_id = r.seller_id
                LEFT JOIN account_seller_profiles p ON p.user_id = r.seller_id
                WHERE r.customer_id = ?
                ORDER BY r.last_message_at DESC
            """
            params = (user_id,)
            
        async with db.execute(query, params) as c:
            rooms = [dict(r) for r in await c.fetchall()]
            
        for r in rooms:
            room_id = r["id"]
            # Get last message
            async with db.execute("""
                SELECT message_text, created_at, sender_role FROM chat_messages 
                WHERE room_id = ? ORDER BY created_at DESC LIMIT 1
            """, (room_id,)) as c_msg:
                msg_row = await c_msg.fetchone()
                last_msg_text = msg_row[0] if msg_row else "Sin mensajes"
                last_msg_time = msg_row[1] if msg_row else r["created_at"]
                last_msg_sender = msg_row[2] if msg_row else ""
                
            # Get unread count
            async with db.execute("SELECT read_at FROM chat_room_reads WHERE room_id = ? AND user_id = ?", (room_id, user_id)) as c_read:
                read_row = await c_read.fetchone()
                read_at = read_row[0] if read_row else 0
                
            async with db.execute("SELECT COUNT(*) FROM chat_messages WHERE room_id = ? AND sender_id != ? AND created_at > ?", (room_id, user_id, read_at)) as c_unread:
                unread_count = (await c_unread.fetchone())[0]
                
            # Title resolution
            if r["ticket_id"]:
                title = f"Soporte: {r['subject'] or r['category']}"
                type_name = "support"
            else:
                if role == 'seller' and r['seller_id'] == user_id:
                    title = f"Cliente: {r['cust_first_name'] or r['cust_username'] or ('ID ' + str(r['customer_id']))}"
                else:
                    title = f"Tienda: {r['seller_store_name'] or r['sell_username'] or 'Vendedor'}"
                type_name = "seller_chat"
                
            items.append({
                "type": type_name,
                "id": f"room_{room_id}",
                "room_id": room_id,
                "ticket_id": r["ticket_id"],
                "title": title,
                "status": r["ticket_status"] or "active",
                "last_message": last_msg_text,
                "last_message_time": last_msg_time,
                "last_message_sender": last_msg_sender,
                "unread_count": unread_count,
                "image_url": r.get("seller_store_image") or ""
            })
            
        # 2. FETCH MANUAL ORDER CASES
        if role == 'admin':
            case_query = """
                SELECT c.*, u_cust.username as cust_username, u_cust.first_name as cust_first_name,
                       p.store_name as seller_store_name
                FROM manual_order_cases c
                LEFT JOIN users u_cust ON u_cust.user_id = c.customer_id
                LEFT JOIN account_seller_profiles p ON p.user_id = c.seller_id
                ORDER BY c.updated_at DESC
            """
            case_params = ()
        elif role == 'seller':
            case_query = """
                SELECT c.*, u_cust.username as cust_username, u_cust.first_name as cust_first_name,
                       p.store_name as seller_store_name
                FROM manual_order_cases c
                LEFT JOIN users u_cust ON u_cust.user_id = c.customer_id
                LEFT JOIN account_seller_profiles p ON p.user_id = c.seller_id
                WHERE c.seller_id = ?
                ORDER BY c.updated_at DESC
            """
            case_params = (user_id,)
        else:
            case_query = """
                SELECT c.*, p.store_name as seller_store_name, p.store_image as seller_store_image
                FROM manual_order_cases c
                LEFT JOIN account_seller_profiles p ON p.user_id = c.seller_id
                WHERE c.customer_id = ?
                ORDER BY c.updated_at DESC
            """
            case_params = (user_id,)
            
        async with db.execute(case_query, case_params) as c_case:
            cases = [dict(c) for c in await c_case.fetchall()]
            
        for c in cases:
            case_id = c["id"]
            # Get last message
            async with db.execute("""
                SELECT message, created_at, sender_role FROM manual_order_case_messages 
                WHERE case_id = ? AND is_internal_note = 0 ORDER BY created_at DESC LIMIT 1
            """, (case_id,)) as c_msg:
                msg_row = await c_msg.fetchone()
                last_msg_text = msg_row[0] if msg_row else "Caso abierto"
                last_msg_time = msg_row[1] if msg_row else c["created_at"]
                last_msg_sender = msg_row[2] if msg_row else ""
                
            # Get unread count
            async with db.execute("SELECT read_at FROM manual_order_case_reads WHERE case_id = ? AND user_id = ?", (case_id, user_id)) as c_read:
                read_row = await c_read.fetchone()
                read_at = read_row[0] if read_row else 0
                
            async with db.execute("SELECT COUNT(*) FROM manual_order_case_messages WHERE case_id = ? AND sender_id != ? AND created_at > ? AND is_internal_note = 0", (case_id, user_id, read_at)) as c_unread:
                unread_count = (await c_unread.fetchone())[0]
                
            if role == 'seller':
                title = f"Disputa Pedido #{c['order_id']} ({c['cust_first_name'] or c['cust_username']})"
            elif role == 'admin':
                title = f"Disputa Pedido #{c['order_id']} ({c['cust_username']} vs {c['seller_store_name']})"
            else:
                title = f"Disputa Pedido #{c['order_id']} ({c['seller_store_name'] or 'Vendedor'})"
                
            items.append({
                "type": "order_case",
                "id": f"case_{case_id}",
                "case_id": case_id,
                "order_id": c["order_id"],
                "title": title,
                "status": c["status"],
                "last_message": last_msg_text,
                "last_message_time": last_msg_time,
                "last_message_sender": last_msg_sender,
                "unread_count": unread_count,
                "image_url": c.get("seller_store_image") or ""
            })
            
    # Sort all inbox items by last_message_time descending
    items.sort(key=lambda x: x["last_message_time"], reverse=True)
    return items

async def list_all_support_tickets(status: str = None) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        if status:
            async with db.execute("""
                SELECT t.*, u.username as cust_username, u.first_name as cust_first_name, r.id as room_id
                FROM support_tickets t
                LEFT JOIN users u ON u.user_id = t.user_id
                LEFT JOIN chat_rooms r ON r.ticket_id = t.id
                WHERE t.status = ?
                ORDER BY t.updated_at DESC
            """, (status,)) as c:
                return [dict(r) for r in await c.fetchall()]
        else:
            async with db.execute("""
                SELECT t.*, u.username as cust_username, u.first_name as cust_first_name, r.id as room_id
                FROM support_tickets t
                LEFT JOIN users u ON u.user_id = t.user_id
                LEFT JOIN chat_rooms r ON r.ticket_id = t.id
                ORDER BY t.updated_at DESC
            """) as c:
                return [dict(r) for r in await c.fetchall()]

async def get_support_ticket(ticket_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT t.*, u.username as cust_username, u.first_name as cust_first_name, r.id as room_id
            FROM support_tickets t
            LEFT JOIN users u ON u.user_id = t.user_id
            LEFT JOIN chat_rooms r ON r.ticket_id = t.id
            WHERE t.id = ?
        """, (ticket_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def update_support_ticket_status(ticket_id: int, status: str):
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?
        """, (status, now, ticket_id))
        await db.commit()


