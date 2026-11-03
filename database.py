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
import hashlib
import logging
import re
import secrets
import time
import uuid

import aiosqlite

import config

log = logging.getLogger(__name__)
DB = config.DB_PATH

PUBLIC_CODE_PREFIX = "FS-323"
PAYMENT_HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{2,22}[a-z0-9]$")
RESERVED_PAYMENT_HANDLES = {
    "admin", "api", "b2b", "francho", "franchoshop", "help", "login", "pay",
    "perfil", "profile", "registro", "soporte", "support", "wallet",
}


def _generate_public_code() -> str:
    """Genera una referencia visible no secuencial para cuentas de usuario."""
    return f"{PUBLIC_CODE_PREFIX}-{secrets.randbelow(1_000_000):06d}"


def normalize_payment_handle(value: str) -> str:
    return str(value or "").strip().lstrip("@").lower()


def validate_payment_handle(value: str) -> str:
    handle = normalize_payment_handle(value)
    if not PAYMENT_HANDLE_RE.fullmatch(handle):
        raise ValueError("El usuario debe tener entre 4 y 24 caracteres y usar solo letras, números, _ o -")
    if handle in RESERVED_PAYMENT_HANDLES or handle.startswith("fs-"):
        raise ValueError("Ese usuario está reservado")
    return handle


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
            --   COBROS PÚBLICOS (Francho Pay)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS public_payment_requests (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                payment_id          TEXT UNIQUE NOT NULL,
                recipient_user_id   INTEGER NOT NULL,
                recipient_handle    TEXT NOT NULL,
                payer_user_id       INTEGER,
                payer_kind          TEXT NOT NULL DEFAULT 'external',
                amount_usd          REAL NOT NULL,
                requested_currency  TEXT NOT NULL,
                requested_network   TEXT NOT NULL,
                provider_track_id   TEXT UNIQUE NOT NULL,
                payment_address     TEXT,
                provider_amount     TEXT,
                provider_currency   TEXT,
                provider_network    TEXT,
                provider_payload    TEXT,
                client_ip_hash      TEXT,
                client_browser      TEXT,
                client_platform     TEXT,
                client_locale       TEXT,
                client_timezone     TEXT,
                status              TEXT NOT NULL DEFAULT 'pending',
                expires_at          REAL,
                paid_at             REAL,
                created_at          REAL DEFAULT (unixepoch()),
                updated_at          REAL DEFAULT (unixepoch()),
                FOREIGN KEY (recipient_user_id) REFERENCES users(user_id),
                FOREIGN KEY (payer_user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_public_payment_recipient ON public_payment_requests(recipient_user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_public_payment_payer ON public_payment_requests(payer_user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_public_payment_status ON public_payment_requests(status, created_at);

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
                product_id  INTEGER,
                manual_product_id INTEGER,
                source      TEXT DEFAULT 'order',
                verified_label TEXT DEFAULT '',
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

            CREATE TABLE IF NOT EXISTS trusted_user_devices (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       INTEGER NOT NULL,
                device_id     TEXT NOT NULL,
                device_name   TEXT,
                ip_address    TEXT,
                created_at    REAL DEFAULT (unixepoch()),
                last_seen_at  REAL DEFAULT (unixepoch()),
                UNIQUE(user_id, device_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_trusted_dev_user ON trusted_user_devices(user_id);

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
            --   SERVICIOS SMM (SMMFOLLOWS & JAP DUAL)
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS smm_services (
                service_id          INTEGER PRIMARY KEY,
                name                TEXT NOT NULL,
                service_type        TEXT,
                category            TEXT,
                rate                REAL DEFAULT 0,
                min_qty             INTEGER DEFAULT 1,
                max_qty             INTEGER DEFAULT 1000,
                refill              INTEGER DEFAULT 0,
                cancel              INTEGER DEFAULT 0,
                is_active           INTEGER DEFAULT 0,
                display_name        TEXT,
                icon_url            TEXT,
                instructions        TEXT,
                custom_markup       REAL,
                min_price           REAL,
                sort_order          INTEGER DEFAULT 100,
                provider            TEXT DEFAULT 'smmfollows',
                raw_json            TEXT,
                synced_at           REAL DEFAULT (unixepoch()),
                updated_at          REAL DEFAULT (unixepoch())
            );
            CREATE INDEX IF NOT EXISTS idx_smm_services_category ON smm_services(category, is_active);
            CREATE INDEX IF NOT EXISTS idx_smm_services_active ON smm_services(is_active, sort_order);

            CREATE TABLE IF NOT EXISTS smm_orders (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id             INTEGER NOT NULL,
                provider_order_id   TEXT UNIQUE,
                service_id          INTEGER NOT NULL,
                service_name        TEXT,
                category            TEXT,
                link                TEXT NOT NULL,
                quantity            INTEGER NOT NULL,
                drip_feed           INTEGER DEFAULT 0,
                runs                INTEGER DEFAULT 1,
                interval            INTEGER DEFAULT 0,
                total_quantity      INTEGER DEFAULT 0,
                cost_price          REAL DEFAULT 0,
                sell_price          REAL NOT NULL,
                start_count         TEXT,
                remains             TEXT,
                provider_status     TEXT,
                status              TEXT DEFAULT 'pending',
                raw_response        TEXT,
                error_message       TEXT,
                provider            TEXT DEFAULT 'smmfollows',
                created_at          REAL DEFAULT (unixepoch()),
                updated_at          REAL DEFAULT (unixepoch()),
                completed_at        REAL,
                refunded_at         REAL,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_smm_orders_user ON smm_orders(user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_smm_orders_status ON smm_orders(status);

            CREATE TABLE IF NOT EXISTS fzr_orders (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id             INTEGER NOT NULL,
                provider_order_id   TEXT,
                product_type        TEXT NOT NULL,
                product_name        TEXT,
                target              TEXT NOT NULL,
                quantity            INTEGER DEFAULT 0,
                months              INTEGER DEFAULT 0,
                cost_price          REAL DEFAULT 0,
                sell_price          REAL NOT NULL,
                provider_status     TEXT,
                status              TEXT DEFAULT 'pending',
                raw_response        TEXT,
                error_message       TEXT,
                created_at          REAL DEFAULT (unixepoch()),
                updated_at          REAL DEFAULT (unixepoch()),
                completed_at        REAL,
                refunded_at         REAL,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_fzr_orders_user ON fzr_orders(user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_fzr_orders_status ON fzr_orders(status);
            CREATE INDEX IF NOT EXISTS idx_fzr_orders_provider ON fzr_orders(provider_order_id);

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

            -- ═══════════════════════════════════════
            --   ASISTENTE IA / SOPORTE HÍBRIDO
            -- ═══════════════════════════════════════
            CREATE TABLE IF NOT EXISTS ai_chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                handoff_ticket_id INTEGER,
                handoff_room_id INTEGER,
                last_intent TEXT,
                created_at REAL DEFAULT (unixepoch()),
                updated_at REAL DEFAULT (unixepoch()),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id, updated_at);

            CREATE TABLE IF NOT EXISTS ai_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                sender_role TEXT NOT NULL,
                message_text TEXT NOT NULL,
                metadata TEXT,
                created_at REAL DEFAULT (unixepoch()),
                FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id, created_at);
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

        # Identidad pública de Francho Shop. No reutilizar username: ese campo
        # pertenece a Telegram y puede cambiar fuera de la plataforma.
        public_identity_cols = [
            ("public_code", "TEXT"),
            ("payment_handle", "TEXT"),
            ("payment_profile_enabled", "INTEGER NOT NULL DEFAULT 0"),
            ("payment_handle_changed_at", "REAL"),
            ("payment_profile_updated_at", "REAL"),
        ]
        async with db.execute("PRAGMA table_info(users)") as c:
            user_cols = {r[1] for r in await c.fetchall()}
        for col, defn in public_identity_cols:
            if col not in user_cols:
                await db.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")

        await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_code ON users(public_code)")
        await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_payment_handle_ci ON users(lower(payment_handle)) WHERE payment_handle IS NOT NULL")

        # Auditoría mínima de Francho Pay. No se guarda IP cruda ni ubicación GPS.
        payment_audit_cols = [
            ("payer_kind", "TEXT NOT NULL DEFAULT 'external'"),
            ("client_ip_hash", "TEXT"),
            ("client_browser", "TEXT"),
            ("client_platform", "TEXT"),
            ("client_locale", "TEXT"),
            ("client_timezone", "TEXT"),
        ]
        async with db.execute("PRAGMA table_info(public_payment_requests)") as c:
            payment_cols = {r[1] for r in await c.fetchall()}
        for col, defn in payment_audit_cols:
            if col not in payment_cols:
                await db.execute(f"ALTER TABLE public_payment_requests ADD COLUMN {col} {defn}")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_public_payment_payer ON public_payment_requests(payer_user_id, created_at)")
        await db.commit()

        # Inspector Transfermóvil: dispositivos emparejados y alertas de pagos
        # pendientes. Los tokens se guardan solo como hash y nunca en texto plano.
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS transfermovil_inspector_pairings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code_hash TEXT NOT NULL UNIQUE,
                created_by INTEGER NOT NULL,
                expires_at REAL NOT NULL,
                used_at REAL,
                created_at REAL NOT NULL DEFAULT (unixepoch())
            );
            CREATE TABLE IF NOT EXISTS transfermovil_inspector_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_hash TEXT NOT NULL UNIQUE,
                device_name TEXT NOT NULL,
                paired_by INTEGER NOT NULL,
                created_at REAL NOT NULL DEFAULT (unixepoch()),
                last_seen_at REAL,
                revoked_at REAL
            );
            CREATE TABLE IF NOT EXISTS transfermovil_inspector_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                created_at REAL NOT NULL DEFAULT (unixepoch()),
                acknowledged_at REAL,
                UNIQUE(order_id, event_type)
            );
            CREATE INDEX IF NOT EXISTS idx_inspector_alerts_pending
                ON transfermovil_inspector_alerts(acknowledged_at, created_at);
        """)
        await db.commit()

        # Asignar una referencia no secuencial a las cuentas existentes. El valor
        # interno user_id sigue siendo la clave de relaciones y nunca se expone.
        async with db.execute("SELECT user_id FROM users WHERE public_code IS NULL OR trim(public_code) = ''") as c:
            missing_public_codes = [row[0] for row in await c.fetchall()]
        for existing_user_id in missing_public_codes:
            for _ in range(100):
                public_code = _generate_public_code()
                async with db.execute("SELECT 1 FROM users WHERE public_code = ?", (public_code,)) as c:
                    if not await c.fetchone():
                        await db.execute("UPDATE users SET public_code = ? WHERE user_id = ?", (public_code, existing_user_id))
                        break
            else:
                raise RuntimeError("No se pudo generar un identificador público único")
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

        async with db.execute("PRAGMA table_info(smm_services)") as c:
            smm_svc_cols = {r[1] for r in await c.fetchall()}
        if smm_svc_cols and "provider" not in smm_svc_cols:
            await db.execute("ALTER TABLE smm_services ADD COLUMN provider TEXT DEFAULT 'smmfollows'")
            await db.commit()

        async with db.execute("PRAGMA table_info(smm_orders)") as c:
            smm_ord_cols = {r[1] for r in await c.fetchall()}
        if smm_ord_cols and "provider" not in smm_ord_cols:
            await db.execute("ALTER TABLE smm_orders ADD COLUMN provider TEXT DEFAULT 'smmfollows'")
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
    await ensure_user_public_code(user_id)


async def get_user(user_id: int) -> dict | None:
    if isinstance(user_id, dict):
        user_id = user_id.get("user_id")
    if not user_id:
        return None
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE user_id=?", (user_id,)) as c:
            r = await c.fetchone()
            return dict(r) if r else None


async def ensure_user_public_code(user_id: int) -> str | None:
    """Obtiene o asigna el código público de una cuenta sin revelar su user_id."""
    async with aiosqlite.connect(DB) as db:
        await db.execute("BEGIN IMMEDIATE")
        async with db.execute("SELECT public_code FROM users WHERE user_id = ?", (user_id,)) as c:
            row = await c.fetchone()
        if not row:
            await db.rollback()
            return None
        if row[0]:
            await db.commit()
            return row[0]
        for _ in range(100):
            public_code = _generate_public_code()
            async with db.execute("SELECT 1 FROM users WHERE public_code = ?", (public_code,)) as c:
                if await c.fetchone():
                    continue
            await db.execute("UPDATE users SET public_code = ? WHERE user_id = ?", (public_code, user_id))
            await db.commit()
            return public_code
        await db.rollback()
        raise RuntimeError("No se pudo generar un identificador público único")


async def get_user_by_payment_handle(handle: str) -> dict | None:
    clean_handle = normalize_payment_handle(handle)
    if not clean_handle:
        return None
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE lower(payment_handle) = lower(?)", (clean_handle,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def get_user_by_public_code(public_code: str) -> dict | None:
    clean_code = str(public_code or "").strip().upper()
    if not clean_code:
        return None
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE upper(public_code) = ?", (clean_code,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def update_user_payment_identity(user_id: int, handle: str | None = None, enabled: bool | None = None) -> dict:
    """Actualiza el handle propio y la visibilidad del perfil de cobro.

    El handle no tiene relación con el username de Telegram. Se limita el cambio
    de un handle ya reclamado a uno cada 30 días para evitar suplantación y abuso.
    """
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        async with db.execute("SELECT payment_handle, payment_handle_changed_at, payment_profile_enabled FROM users WHERE user_id = ?", (user_id,)) as c:
            current = await c.fetchone()
        if not current:
            await db.rollback()
            raise ValueError("Usuario no encontrado")

        current_handle = current["payment_handle"] or ""
        new_handle = current_handle
        values = []
        fields = []

        if handle is not None:
            new_handle = validate_payment_handle(handle)
            if new_handle != current_handle:
                changed_at = float(current["payment_handle_changed_at"] or 0)
                if current_handle and now - changed_at < 30 * 24 * 60 * 60:
                    await db.rollback()
                    raise ValueError("Puedes cambiar tu usuario nuevamente dentro de 30 días")
                async with db.execute("SELECT user_id FROM users WHERE lower(payment_handle) = lower(?) AND user_id <> ?", (new_handle, user_id)) as c:
                    if await c.fetchone():
                        await db.rollback()
                        raise ValueError("Ese usuario ya está en uso")
                fields.extend(["payment_handle = ?", "payment_handle_changed_at = ?"])
                values.extend([new_handle, now])

        new_enabled = bool(current["payment_profile_enabled"])
        if enabled is not None:
            new_enabled = bool(enabled)
            if new_enabled and not new_handle:
                await db.rollback()
                raise ValueError("Primero reclama un usuario para activar tu perfil público")
            fields.extend(["payment_profile_enabled = ?", "payment_profile_updated_at = ?"])
            values.extend([1 if new_enabled else 0, now])

        if fields:
            values.append(user_id)
            await db.execute(f"UPDATE users SET {', '.join(fields)} WHERE user_id = ?", values)
        await db.commit()
        return {
            "payment_handle": new_handle or None,
            "payment_profile_enabled": new_enabled,
            "payment_handle_changed_at": now if handle is not None and new_handle != current_handle else current["payment_handle_changed_at"],
            "payment_profile_updated_at": now if enabled is not None else current["payment_profile_updated_at"] if "payment_profile_updated_at" in current.keys() else None,
        }


async def get_public_payment_profile(handle: str) -> dict | None:
    clean_handle = normalize_payment_handle(handle)
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT user_id, public_code, payment_handle, display_name, first_name, photo_url,
                   payment_profile_enabled, is_banned
            FROM users
            WHERE lower(payment_handle) = lower(?)
              AND payment_profile_enabled = 1
              AND is_banned = 0
            LIMIT 1
        """, (clean_handle,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


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


async def search_users(
    query: str = "",
    limit: int = 20,
    role: str = "",
    status: str = "",
    segment: str = "",
    sort: str = "last_seen_desc",
    **kwargs
) -> list[dict]:
    """Busca usuarios con filtros opcionales de texto, rol, estado, segmento y orden."""
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        where_clauses = []
        params = []

        q_raw = (query or "").strip().lstrip("@")
        if q_raw:
            where_clauses.append("(CAST(user_id AS TEXT) LIKE ? OR username LIKE ? OR first_name LIKE ? OR email LIKE ?)")
            params.extend([f"%{q_raw}%"] * 4)

        if role and str(role).strip().lower() not in ("", "all", "todos"):
            where_clauses.append("role = ?")
            params.append(str(role).strip().lower())

        if status:
            st = str(status).strip().lower()
            if st == "banned":
                where_clauses.append("is_banned = 1")
            elif st == "active":
                where_clauses.append("is_banned = 0")

        if segment:
            seg = str(segment).strip().lower()
            if seg in ("buyers", "compradores"):
                where_clauses.append("total_spent > 0")
            elif seg in ("depositors", "depositantes"):
                where_clauses.append("total_deposit > 0")
            elif seg in ("with_balance", "con_saldo"):
                where_clauses.append("balance > 0")
            elif seg in ("resellers", "revendedores"):
                where_clauses.append("role = 'reseller'")

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        sort_map = {
            "last_seen_desc": "last_seen DESC",
            "last_seen_asc": "last_seen ASC",
            "created_at_desc": "created_at DESC",
            "created_at_asc": "created_at ASC",
            "balance_desc": "balance DESC",
            "balance_asc": "balance ASC",
            "spent_desc": "total_spent DESC",
            "deposit_desc": "total_deposit DESC",
        }
        order_sql = sort_map.get(sort, "last_seen DESC")

        sql = f"SELECT * FROM users {where_sql} ORDER BY {order_sql} LIMIT ?"
        params.append(int(limit) if limit else 20)

        async with db.execute(sql, tuple(params)) as c:
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
    amount = round(float(amount), 2)
    if amount <= 0:
        return False
    async with aiosqlite.connect(DB) as db:
        # Reserva y descuenta dentro de la misma transaccion. Asi dos compras simultaneas
        # no pueden usar el mismo saldo antes de que la otra termine.
        await db.execute("BEGIN IMMEDIATE")
        cursor = await db.execute(
            """
            UPDATE users
            SET balance = balance - ?, total_spent = total_spent + ?
            WHERE user_id = ? AND balance >= ?
            """,
            (amount, amount, user_id, amount),
        )
        if cursor.rowcount != 1:
            await db.rollback()
            return False
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


async def get_fc_transfer_history(user_id: int, limit: int = 20) -> list[dict]:
    """Historial exclusivo de transferencias internas de FC entre usuarios."""
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT * FROM balance_log
            WHERE user_id=? AND type IN ('transfer_out', 'transfer_in', 'transfer_sent', 'transfer_received', 'payment_received')
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ) as c:
            return [dict(r) for r in await c.fetchall()]


# ══════════════════════════════════════
#  DEPÓSITOS (OxaPay)
# ══════════════════════════════════════

def gen_deposit_id() -> str:
    return f"DEP{int(time.time())}{uuid.uuid4().hex[:6].upper()}"


def gen_public_payment_id() -> str:
    """Referencia pública no secuencial para cobros entre perfiles."""
    return f"FS-149-{secrets.token_hex(5).upper()}"


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
#  COBROS PÚBLICOS (Francho Pay)
# ══════════════════════════════════════

async def create_public_payment_request(
    payment_id: str,
    recipient_user_id: int,
    recipient_handle: str,
    amount_usd: float,
    requested_currency: str,
    requested_network: str,
    provider_track_id: str,
    payment_address: str = "",
    provider_amount: str = "",
    provider_currency: str = "",
    provider_network: str = "",
    provider_payload: str = "",
    expires_at: float | None = None,
    payer_user_id: int | None = None,
    payer_kind: str = "external",
    client_ip_hash: str = "",
    client_browser: str = "",
    client_platform: str = "",
    client_locale: str = "",
    client_timezone: str = "",
) -> dict:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            INSERT INTO public_payment_requests (
                payment_id, recipient_user_id, recipient_handle, payer_user_id, payer_kind,
                amount_usd, requested_currency, requested_network, provider_track_id,
                payment_address, provider_amount, provider_currency, provider_network,
                provider_payload, client_ip_hash, client_browser, client_platform,
                client_locale, client_timezone, expires_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payment_id, recipient_user_id, recipient_handle, payer_user_id, payer_kind,
                amount_usd, requested_currency, requested_network, provider_track_id,
                payment_address, provider_amount, provider_currency, provider_network,
                provider_payload, client_ip_hash, client_browser, client_platform,
                client_locale, client_timezone, expires_at, now, now,
            ),
        )
        await db.commit()
        async with db.execute("SELECT * FROM public_payment_requests WHERE payment_id = ?", (payment_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else {}


async def list_public_payments_for_user(user_id: int, direction: str = "all", limit: int = 50) -> list[dict]:
    """Historial propio de Francho Pay; nunca revela datos del pagador externo."""
    clean_direction = direction if direction in {"sent", "received", "all"} else "all"
    safe_limit = max(1, min(int(limit), 100))
    if clean_direction == "sent":
        clause, params = "p.payer_user_id = ?", [user_id]
    elif clean_direction == "received":
        clause, params = "p.recipient_user_id = ?", [user_id]
    else:
        clause, params = "(p.payer_user_id = ? OR p.recipient_user_id = ?)", [user_id, user_id]
    params.append(safe_limit)
    query = f"""
        SELECT p.payment_id, p.payer_user_id, p.payer_kind, p.recipient_user_id, p.recipient_handle,
               p.amount_usd, p.provider_currency, p.provider_network, p.status,
               p.expires_at, p.paid_at, p.created_at, p.updated_at
        FROM public_payment_requests p
        WHERE {clause}
        ORDER BY p.created_at DESC
        LIMIT ?
    """
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(query, params) as c:
            return [dict(row) for row in await c.fetchall()]


async def list_public_payments_admin(status: str = "", limit: int = 100) -> list[dict]:
    """Vista administrativa con señales de auditoría seudonimizadas."""
    safe_limit = max(1, min(int(limit), 200))
    params: list = []
    where = ""
    if status:
        where = "WHERE p.status = ?"
        params.append(status.lower())
    params.append(safe_limit)
    query = f"""
        SELECT p.*, recipient.display_name AS recipient_name, recipient.email AS recipient_email,
               payer.display_name AS payer_name, payer.email AS payer_email
        FROM public_payment_requests p
        LEFT JOIN users recipient ON recipient.user_id = p.recipient_user_id
        LEFT JOIN users payer ON payer.user_id = p.payer_user_id
        {where}
        ORDER BY p.created_at DESC
        LIMIT ?
    """
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(query, params) as c:
            return [dict(row) for row in await c.fetchall()]


async def get_public_payment_by_track(provider_track_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM public_payment_requests WHERE provider_track_id = ?", (provider_track_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def get_public_payment_by_id(payment_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM public_payment_requests WHERE payment_id = ?", (payment_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def get_pending_public_payment_requests(limit: int = 20, since: float | None = None) -> list[dict]:
    query = "SELECT * FROM public_payment_requests WHERE status IN ('pending', 'paying')"
    params: list = []
    if since is not None:
        query += " AND created_at >= ?"
        params.append(since)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(int(limit))
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(query, params) as c:
            return [dict(row) for row in await c.fetchall()]


async def update_public_payment_status(provider_track_id: str, status: str, provider_payload: str = "") -> None:
    async with aiosqlite.connect(DB) as db:
        if provider_payload:
            await db.execute(
                "UPDATE public_payment_requests SET status = ?, provider_payload = ?, updated_at = ? WHERE provider_track_id = ?",
                (status, provider_payload, time.time(), provider_track_id),
            )
        else:
            await db.execute(
                "UPDATE public_payment_requests SET status = ?, updated_at = ? WHERE provider_track_id = ?",
                (status, time.time(), provider_track_id),
            )
        await db.commit()


async def settle_public_payment_request(provider_track_id: str, provider_payload: str = "") -> tuple[dict | None, bool]:
    """Marca como pagado y acredita una sola vez el saldo del destinatario.

    No actualiza total_deposit: recibir un cobro no equivale a una recarga propia
    ni debe habilitar precios de revendedor.
    """
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        async with db.execute("SELECT * FROM public_payment_requests WHERE provider_track_id = ?", (provider_track_id,)) as c:
            row = await c.fetchone()
        if not row:
            await db.rollback()
            return None, False
        payment = dict(row)
        if payment.get("status") == "paid":
            await db.commit()
            return payment, False

        amount = round(float(payment.get("amount_usd") or 0), 2)
        if amount <= 0:
            await db.rollback()
            raise ValueError("Monto de cobro público inválido")
        recipient_user_id = int(payment["recipient_user_id"])
        await db.execute(
            """
            UPDATE public_payment_requests
            SET status = 'paid', paid_at = ?, updated_at = ?, provider_payload = ?
            WHERE provider_track_id = ? AND status <> 'paid'
            """,
            (now, now, provider_payload, provider_track_id),
        )
        if db.total_changes < 1:
            await db.commit()
            return payment, False
        await db.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amount, recipient_user_id))
        await db.execute(
            """
            INSERT INTO balance_log (user_id, amount, type, ref_id, note)
            VALUES (?, ?, 'payment_received', ?, ?)
            """,
            (recipient_user_id, amount, payment["payment_id"], f"Pago recibido en @{payment['recipient_handle']}"),
        )
        await db.commit()
        payment.update({"status": "paid", "paid_at": now, "updated_at": now})
        return payment, True


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




async def ensure_reviews_schema():
    async with aiosqlite.connect(DB) as db:
        async with db.execute("PRAGMA table_info(order_reviews)") as c:
            cols = {row[1] for row in await c.fetchall()}
        required = {
            "product_id": "INTEGER",
            "manual_product_id": "INTEGER",
            "source": "TEXT DEFAULT 'order'",
            "verified_label": "TEXT DEFAULT ''",
        }
        for col, definition in required.items():
            if col not in cols:
                await db.execute(f"ALTER TABLE order_reviews ADD COLUMN {col} {definition}")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reviews_product ON order_reviews(product_id, manual_product_id)")
        await db.commit()

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
    await ensure_reviews_schema()
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO order_reviews (order_type, order_id, user_id, rating, comment, source)
            VALUES (?, ?, ?, ?, ?, 'order')
            ON CONFLICT(order_type, order_id, user_id) DO UPDATE SET
                rating=excluded.rating,
                comment=excluded.comment,
                source='order',
                created_at=excluded.created_at
        """, (order_type, str(order_id), user_id, int(rating), comment or ""))
        await db.commit()
        return cur.lastrowid


async def add_legacy_review(user_id: int, rating: int, comment: str = "", product_id: int | None = None, manual_product_id: int | None = None) -> int:
    await ensure_reviews_schema()
    product_id = int(product_id or 0) or None
    manual_product_id = int(manual_product_id or 0) or None
    if not product_id and not manual_product_id:
        raise ValueError("product_id or manual_product_id required")
    order_type = "legacy_manual" if manual_product_id else "legacy_auto"
    order_id = f"legacy:{manual_product_id or product_id}"
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO order_reviews (order_type, order_id, user_id, rating, comment, product_id, manual_product_id, source, verified_label)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'legacy', 'Cliente verificado por Francho Shop')
            ON CONFLICT(order_type, order_id, user_id) DO UPDATE SET
                rating=excluded.rating,
                comment=excluded.comment,
                product_id=excluded.product_id,
                manual_product_id=excluded.manual_product_id,
                source='legacy',
                verified_label='Cliente verificado por Francho Shop',
                created_at=excluded.created_at
        """, (order_type, order_id, int(user_id), int(rating), comment or "", product_id, manual_product_id))
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
    await ensure_reviews_schema()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        clauses = []
        params = []
        if product_ids:
            clean_ids = [int(pid) for pid in product_ids if int(pid or 0) > 0]
            if clean_ids:
                placeholders = ",".join("?" for _ in clean_ids)
                clauses.append(f"((r.order_type='auto' AND o.product_id IN ({placeholders})) OR (r.order_type='legacy_auto' AND r.product_id IN ({placeholders})))")
                params.extend(clean_ids)
                params.extend(clean_ids)
        elif product_id is not None:
            clauses.append("((r.order_type='auto' AND o.product_id=?) OR (r.order_type='legacy_auto' AND r.product_id=?))")
            params.extend([int(product_id), int(product_id)])
        if manual_product_id is not None:
            clauses.append("((r.order_type='manual' AND mo.product_id=?) OR (r.order_type='legacy_manual' AND r.manual_product_id=?))")
            params.extend([int(manual_product_id), int(manual_product_id)])
        where_sql = "WHERE " + " OR ".join(f"({c})" for c in clauses) if clauses else ""
        async with db.execute(f"""
            SELECT COUNT(*) as count, COALESCE(AVG(r.rating),0) as avg_rating
            FROM order_reviews r
            LEFT JOIN orders o ON r.order_type='auto' AND r.order_id=o.merchant_order_id
            LEFT JOIN manual_orders mo ON r.order_type='manual' AND r.order_id=CAST(mo.id AS TEXT)
            {where_sql}
        """, params) as c:
            stats = dict(await c.fetchone())
        async with db.execute(f"""
            SELECT r.id, r.order_type, r.order_id, r.product_id, r.manual_product_id, r.rating, r.comment, r.created_at,
                   r.source, r.verified_label,
                   u.first_name, u.username,
                   COALESCE(o.product_name, mp.name, mp_legacy.name) as product_name
            FROM order_reviews r
            LEFT JOIN users u ON u.user_id = r.user_id
            LEFT JOIN orders o ON r.order_type='auto' AND r.order_id=o.merchant_order_id
            LEFT JOIN manual_orders mo ON r.order_type='manual' AND r.order_id=CAST(mo.id AS TEXT)
            LEFT JOIN manual_products mp ON mo.product_id=mp.id
            LEFT JOIN manual_products mp_legacy ON r.manual_product_id=mp_legacy.id
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
            "id": row.get("id"),
            "product_id": row.get("product_id"),
            "manual_product_id": row.get("manual_product_id"),
            "rating": int(row.get("rating") or 0),
            "comment": row.get("comment") or "",
            "created_at": row.get("created_at"),
            "customer_name": name,
            "product_name": row.get("product_name") or "Producto",
            "order_type": row.get("order_type"),
            "source": row.get("source") or "order",
            "verified_label": row.get("verified_label") or ("Compra verificada" if (row.get("source") or "order") == "order" else "Cliente verificado por Francho Shop"),
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
    await ensure_user_public_code(new_id)
    return new_id


async def set_user_password(user_id: int, password_hash: str):
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "UPDATE users SET password_hash=? WHERE user_id=?",
            (password_hash, user_id),
        )
        await db.commit()


async def update_user_totp_secret(user_id: int, secret: str):
    async with aiosqlite.connect(DB) as db:
        await db.execute("UPDATE users SET totp_secret=? WHERE user_id=?", (secret, user_id))
        await db.commit()


async def set_user_totp_enabled(user_id: int, enabled: bool):
    async with aiosqlite.connect(DB) as db:
        await db.execute("UPDATE users SET totp_enabled=? WHERE user_id=?", (1 if enabled else 0, user_id))
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


async def delete_user_sessions(user_id: int, except_token: str | None = None):
    """Cierra las sesiones de una cuenta despues de un cambio de credenciales."""
    async with aiosqlite.connect(DB) as db:
        if except_token:
            await db.execute("DELETE FROM web_sessions WHERE user_id=? AND token<>?", (user_id, except_token))
        else:
            await db.execute("DELETE FROM web_sessions WHERE user_id=?", (user_id,))
        await db.commit()


async def is_trusted_device(user_id: int, device_id: str) -> bool:
    if not device_id or not device_id.strip():
        return False
    async with aiosqlite.connect(DB) as db:
        async with db.execute(
            "SELECT 1 FROM trusted_user_devices WHERE user_id=? AND device_id=?",
            (user_id, device_id.strip())
        ) as c:
            row = await c.fetchone()
            return row is not None


async def register_trusted_device(user_id: int, device_id: str, device_name: str = None, ip_address: str = None):
    if not device_id or not device_id.strip():
        return
    import time
    now = time.time()
    clean_dev = device_id.strip()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO trusted_user_devices (user_id, device_id, device_name, ip_address, created_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, device_id) DO UPDATE SET
                last_seen_at = excluded.last_seen_at,
                ip_address = COALESCE(excluded.ip_address, ip_address)
        """, (user_id, clean_dev, device_name, ip_address, now, now))
        await db.commit()


# ════════════════════════════════════════════════════════
#   INSPECTOR TRANSFERMÓVIL
# ════════════════════════════════════════════════════════

def _inspector_token_hash(value: str) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()


async def create_transfermovil_inspector_pairing(created_by: int, ttl_seconds: int = 600) -> str:
    """Crea un código de un solo uso. Solo se almacena su hash."""
    code = "-".join((secrets.token_hex(3).upper(), secrets.token_hex(3).upper()))
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("DELETE FROM transfermovil_inspector_pairings WHERE expires_at < ? OR used_at IS NOT NULL", (now,))
        await db.execute(
            "INSERT INTO transfermovil_inspector_pairings(code_hash, created_by, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (_inspector_token_hash(code), int(created_by), now + max(60, int(ttl_seconds)), now),
        )
        await db.commit()
    return code


async def pair_transfermovil_inspector(code: str, device_name: str) -> tuple[str, dict] | None:
    """Consume un código temporal y devuelve el token crudo solo una vez."""
    now = time.time()
    code_hash = _inspector_token_hash(code)
    safe_name = (device_name or "Inspector Android")[:100]
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        async with db.execute(
            "SELECT * FROM transfermovil_inspector_pairings WHERE code_hash=? AND used_at IS NULL AND expires_at > ?",
            (code_hash, now),
        ) as cursor:
            pairing = await cursor.fetchone()
        if not pairing:
            await db.rollback()
            return None
        raw_token = secrets.token_urlsafe(32)
        await db.execute("UPDATE transfermovil_inspector_pairings SET used_at=? WHERE id=?", (now, pairing["id"]))
        cursor = await db.execute(
            "INSERT INTO transfermovil_inspector_devices(token_hash, device_name, paired_by, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
            (_inspector_token_hash(raw_token), safe_name, int(pairing["created_by"]), now, now),
        )
        await db.commit()
        return raw_token, {"id": cursor.lastrowid, "device_name": safe_name}


async def get_transfermovil_inspector_device(raw_token: str) -> dict | None:
    if not raw_token:
        return None
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM transfermovil_inspector_devices WHERE token_hash=? AND revoked_at IS NULL",
            (_inspector_token_hash(raw_token),),
        ) as cursor:
            device = await cursor.fetchone()
        if not device:
            return None
        await db.execute("UPDATE transfermovil_inspector_devices SET last_seen_at=? WHERE id=?", (now, device["id"]))
        await db.commit()
        return dict(device)


async def enqueue_transfermovil_inspector_alert(order_id: str, event_type: str = "proof_submitted") -> None:
    async with aiosqlite.connect(DB) as db:
        await db.execute(
            "INSERT OR IGNORE INTO transfermovil_inspector_alerts(order_id, event_type, created_at) VALUES (?, ?, ?)",
            (str(order_id), str(event_type), time.time()),
        )
        await db.commit()


async def list_transfermovil_inspector_alerts(limit: int = 20) -> list[dict]:
    safe_limit = max(1, min(int(limit), 50))
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT a.id AS alert_id, a.event_type, a.created_at AS alert_created_at,
                   o.merchant_order_id AS order_id, o.product_name, o.payment_method,
                   o.payment_status, o.cup_amount_snapshot, o.payment_amount, o.created_at AS order_created_at
            FROM transfermovil_inspector_alerts a
            JOIN orders o ON o.merchant_order_id = a.order_id
            WHERE a.acknowledged_at IS NULL
              AND o.payment_status IN ('awaiting_proof', 'pending_verification', 'verifying')
            ORDER BY a.created_at ASC
            LIMIT ?
        """, (safe_limit,)) as cursor:
            return [dict(row) for row in await cursor.fetchall()]


async def acknowledge_transfermovil_inspector_alert(alert_id: int) -> bool:
    async with aiosqlite.connect(DB) as db:
        cursor = await db.execute(
            "UPDATE transfermovil_inspector_alerts SET acknowledged_at=? WHERE id=? AND acknowledged_at IS NULL",
            (time.time(), int(alert_id)),
        )
        await db.commit()
        return cursor.rowcount > 0


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
                delivery_time   TEXT DEFAULT '',
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

            CREATE TABLE IF NOT EXISTS referral_campaigns (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id          INTEGER NOT NULL UNIQUE,
                seller_id           INTEGER,
                reward_amount_usdt  REAL NOT NULL DEFAULT 0,
                payer_type          TEXT NOT NULL DEFAULT 'platform',
                status              TEXT NOT NULL DEFAULT 'disabled',
                min_order_amount_usdt REAL DEFAULT 0,
                created_at          REAL DEFAULT (unixepoch()),
                updated_at          REAL DEFAULT (unixepoch()),
                FOREIGN KEY (product_id) REFERENCES manual_products(id)
            );
            CREATE INDEX IF NOT EXISTS idx_referral_campaigns_product ON referral_campaigns(product_id);
            CREATE INDEX IF NOT EXISTS idx_referral_campaigns_seller ON referral_campaigns(seller_id, status);

            CREATE TABLE IF NOT EXISTS referral_links (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         INTEGER NOT NULL,
                product_id      INTEGER NOT NULL,
                campaign_id     INTEGER NOT NULL,
                referral_code   TEXT NOT NULL UNIQUE,
                created_at      REAL DEFAULT (unixepoch()),
                UNIQUE(user_id, product_id, campaign_id)
            );
            CREATE INDEX IF NOT EXISTS idx_referral_links_user_product ON referral_links(user_id, product_id);

            CREATE TABLE IF NOT EXISTS referral_attributions (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                referral_code       TEXT NOT NULL,
                referrer_user_id    INTEGER NOT NULL,
                visitor_user_id     INTEGER,
                product_id          INTEGER NOT NULL,
                campaign_id         INTEGER NOT NULL,
                clicked_at          REAL DEFAULT (unixepoch()),
                expires_at          REAL,
                ip_hash             TEXT,
                user_agent_hash     TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_referral_attr_code ON referral_attributions(referral_code);
            CREATE INDEX IF NOT EXISTS idx_referral_attr_visitor ON referral_attributions(visitor_user_id, product_id, clicked_at);

            CREATE TABLE IF NOT EXISTS referral_commissions (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id            INTEGER NOT NULL UNIQUE,
                product_id          INTEGER NOT NULL,
                campaign_id         INTEGER NOT NULL,
                referrer_user_id    INTEGER NOT NULL,
                buyer_user_id       INTEGER NOT NULL,
                seller_id           INTEGER,
                reward_amount_usdt  REAL NOT NULL,
                payer_type          TEXT NOT NULL,
                status              TEXT NOT NULL DEFAULT 'pending',
                created_at          REAL DEFAULT (unixepoch()),
                approved_at         REAL,
                paid_at             REAL,
                canceled_reason     TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_referral_comm_referrer ON referral_commissions(referrer_user_id, status);
            CREATE INDEX IF NOT EXISTS idx_referral_comm_seller ON referral_commissions(seller_id, status);
            CREATE INDEX IF NOT EXISTS idx_referral_comm_campaign ON referral_commissions(campaign_id, status);
        """)
        async with db.execute("PRAGMA table_info(manual_orders)") as c:
            order_cols = {r[1] for r in await c.fetchall()}
        for col, defn in [
            ("option_id", "INTEGER"),
            ("option_name", "TEXT"),
            ("customer_data", "TEXT"),
            ("seller_id", "INTEGER"),
            ("completed_by", "INTEGER"),
            ("delivery_time", "TEXT DEFAULT ''"),
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


async def get_manual_products(active_only: bool = True, created_by: int = None, store_slug: str = None, is_main_store: bool = False) -> list[dict]:
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
        if is_main_store:
            filters.append("(store_slug IS NULL OR store_slug = '' OR store_slug = '__main__')")
        elif store_slug is not None:
            filters.append("store_slug=?")
            params.append(store_slug)
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


async def create_manual_order(
    product_id: int,
    user_id: int,
    price: float,
    option_id: int = None,
    option_name: str = None,
    customer_data: dict = None,
    delivery_time: str = None,
    **kwargs
) -> int:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT created_by FROM manual_products WHERE id=?", (product_id,)) as p:
            product = await p.fetchone()
        seller_id = product["created_by"] if product else None
        c = await db.execute("""
            INSERT INTO manual_orders (product_id, option_id, option_name, user_id, seller_id, price, customer_data, delivery_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (product_id, option_id, option_name, user_id, seller_id, price, json.dumps(customer_data or {}, ensure_ascii=False), str(delivery_time or '')))
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



async def get_active_referral_campaign(product_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM referral_campaigns
            WHERE product_id=? AND status='active' AND reward_amount_usdt > 0
            LIMIT 1
        """, (product_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def get_referral_campaign(product_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM referral_campaigns WHERE product_id=?", (product_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def list_referral_campaigns(seller_id: int | None = None) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """
            SELECT rc.*, mp.name AS product_name, mp.icon_url, mp.category,
                   u.username AS seller_username, u.first_name AS seller_name
            FROM referral_campaigns rc
            JOIN manual_products mp ON mp.id = rc.product_id
            LEFT JOIN users u ON u.user_id = rc.seller_id
            WHERE 1=1
        """
        params = []
        if seller_id is not None:
            q += " AND rc.seller_id=?"
            params.append(seller_id)
        q += " ORDER BY rc.updated_at DESC, rc.id DESC"
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def upsert_referral_campaign(product_id: int, seller_id: int | None, reward_amount: float, payer_type: str, status: str, min_order_amount: float = 0.0) -> dict:
    now = time.time()
    reward = round(max(0.0, float(reward_amount or 0)), 8)
    payer = payer_type if payer_type in {"platform", "seller"} else "platform"
    clean_status = status if status in {"active", "paused", "disabled"} else "disabled"
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("""
            INSERT INTO referral_campaigns
            (product_id, seller_id, reward_amount_usdt, payer_type, status, min_order_amount_usdt, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(product_id) DO UPDATE SET
                seller_id=excluded.seller_id,
                reward_amount_usdt=excluded.reward_amount_usdt,
                payer_type=excluded.payer_type,
                status=excluded.status,
                min_order_amount_usdt=excluded.min_order_amount_usdt,
                updated_at=excluded.updated_at
        """, (product_id, seller_id, reward, payer, clean_status, max(0.0, float(min_order_amount or 0)), now, now))
        await db.commit()
        async with db.execute("SELECT * FROM referral_campaigns WHERE product_id=?", (product_id,)) as c:
            row = await c.fetchone()
            return dict(row)


def _referral_code(user_id: int, product_id: int, campaign_id: int) -> str:
    raw = f"rp_{int(user_id):x}_{int(product_id):x}_{int(campaign_id):x}_{uuid.uuid4().hex[:8]}"
    return raw[:64]


async def get_or_create_referral_link(user_id: int, product_id: int, campaign_id: int) -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM referral_links
            WHERE user_id=? AND product_id=? AND campaign_id=?
            LIMIT 1
        """, (user_id, product_id, campaign_id)) as c:
            row = await c.fetchone()
            if row:
                return dict(row)
        for _ in range(5):
            code = _referral_code(user_id, product_id, campaign_id)
            try:
                cur = await db.execute("""
                    INSERT INTO referral_links (user_id, product_id, campaign_id, referral_code)
                    VALUES (?, ?, ?, ?)
                """, (user_id, product_id, campaign_id, code))
                await db.commit()
                async with db.execute("SELECT * FROM referral_links WHERE id=?", (cur.lastrowid,)) as c:
                    return dict(await c.fetchone())
            except aiosqlite.IntegrityError:
                continue
        raise RuntimeError("No se pudo generar código de referido")


async def get_referral_link_by_code(referral_code: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT rl.*, rc.status AS campaign_status, rc.reward_amount_usdt, rc.payer_type, rc.seller_id, rc.min_order_amount_usdt
            FROM referral_links rl
            JOIN referral_campaigns rc ON rc.id = rl.campaign_id
            WHERE rl.referral_code=?
            LIMIT 1
        """, (referral_code,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def create_referral_attribution(referral_code: str, visitor_user_id: int | None = None, expires_at: float | None = None, ip_hash: str = "", user_agent_hash: str = "") -> dict | None:
    link = await get_referral_link_by_code(referral_code)
    if not link or link.get("campaign_status") != "active":
        return None
    referrer = int(link["user_id"])
    visitor = int(visitor_user_id) if visitor_user_id else None
    if visitor and visitor == referrer:
        return None
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("""
            INSERT INTO referral_attributions
            (referral_code, referrer_user_id, visitor_user_id, product_id, campaign_id, clicked_at, expires_at, ip_hash, user_agent_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (referral_code, referrer, visitor, int(link["product_id"]), int(link["campaign_id"]), time.time(), expires_at, ip_hash, user_agent_hash))
        await db.commit()
        async with db.execute("SELECT * FROM referral_attributions WHERE id=?", (cur.lastrowid,)) as c:
            return dict(await c.fetchone())


async def create_pending_referral_commission(order_id: int, product_id: int, buyer_user_id: int, referral_code: str | None, order_amount: float) -> dict | None:
    code = (referral_code or "").strip()
    if not code:
        return None
    link = await get_referral_link_by_code(code)
    if not link or link.get("campaign_status") != "active":
        return None
    if int(link.get("product_id") or 0) != int(product_id):
        return None
    referrer_id = int(link.get("user_id") or 0)
    buyer_id = int(buyer_user_id or 0)
    if referrer_id <= 0 or buyer_id <= 0 or referrer_id == buyer_id:
        return None
    reward = round(float(link.get("reward_amount_usdt") or 0), 8)
    if reward <= 0:
        return None
    min_order = float(link.get("min_order_amount_usdt") or 0)
    if min_order > 0 and float(order_amount or 0) + 1e-9 < min_order:
        return None
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        try:
            cur = await db.execute("""
                INSERT INTO referral_commissions
                (order_id, product_id, campaign_id, referrer_user_id, buyer_user_id, seller_id, reward_amount_usdt, payer_type, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """, (order_id, product_id, int(link["campaign_id"]), referrer_id, buyer_id, link.get("seller_id"), reward, link.get("payer_type") or "platform", time.time()))
            await db.commit()
        except aiosqlite.IntegrityError:
            return None
        async with db.execute("SELECT * FROM referral_commissions WHERE id=?", (cur.lastrowid,)) as c:
            return dict(await c.fetchone())


async def debit_seller_referral_reward(seller_id: int, order_id: int, commission_id: int, amount: float) -> bool:
    amount = round(max(0.0, float(amount or 0)), 8)
    if amount <= 0 or int(seller_id or 0) <= 0:
        return False
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        await db.execute("""
            INSERT INTO seller_wallets (user_id, currency, network, updated_at)
            VALUES (?, 'USDT', 'BEP20', ?)
            ON CONFLICT(user_id) DO NOTHING
        """, (seller_id, now))
        async with db.execute("SELECT available_balance FROM seller_wallets WHERE user_id=?", (seller_id,)) as c:
            wallet = await c.fetchone()
        available = float(wallet["available_balance"] or 0) if wallet else 0.0
        if available + 1e-9 < amount:
            await db.rollback()
            return False
        await db.execute("""
            UPDATE seller_wallets
            SET available_balance = MAX(0, available_balance - ?), updated_at=?
            WHERE user_id=?
        """, (amount, now, seller_id))
        await db.execute("""
            INSERT INTO seller_wallet_movements
            (seller_id, order_id, movement_type, status, amount, gross_amount, platform_fee, currency, network, note, created_at, updated_at)
            VALUES (?, ?, 'referral_reward', 'paid', ?, ?, 0, 'USDT', 'BEP20', ?, ?, ?)
        """, (seller_id, order_id, -amount, amount, f"Recompensa compartido comisión #{commission_id}", now, now))
        await db.commit()
        return True


async def pay_referral_commission(order_id: int) -> dict | None:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM referral_commissions WHERE order_id=?", (order_id,)) as c:
            row = await c.fetchone()
        if not row:
            return None
        commission = dict(row)
        if commission.get("status") == "paid":
            return commission
        if commission.get("status") not in {"pending", "approved"}:
            return commission
    if commission.get("payer_type") == "seller":
        ok = await debit_seller_referral_reward(int(commission.get("seller_id") or 0), int(order_id), int(commission["id"]), float(commission.get("reward_amount_usdt") or 0))
        if not ok:
            async with aiosqlite.connect(DB) as db:
                await db.execute("UPDATE referral_campaigns SET status='paused', updated_at=? WHERE id=?", (now, commission["campaign_id"]))
                await db.commit()
            return commission
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        async with db.execute("SELECT * FROM referral_commissions WHERE id=?", (commission["id"],)) as c:
            current = await c.fetchone()
        if not current or current["status"] == "paid":
            await db.rollback()
            return dict(current) if current else None
        if current["status"] not in ("pending", "approved"):
            await db.rollback()
            return dict(current)
        amount = round(float(current["reward_amount_usdt"] or 0), 8)
        await db.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (amount, int(current["referrer_user_id"])))
        await db.execute("""
            INSERT INTO balance_log (user_id, amount, type, ref_id, note)
            VALUES (?, ?, 'referral_reward', ?, ?)
        """, (int(current["referrer_user_id"]), amount, str(order_id), f"Recompensa por compartir producto #{current['product_id']}"))
        await db.execute("""
            UPDATE referral_commissions
            SET status='paid', approved_at=COALESCE(approved_at, ?), paid_at=?
            WHERE id=?
        """, (now, now, int(current["id"])))
        await db.commit()
    return await get_referral_commission_by_order(order_id)


async def get_referral_commission_by_order(order_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM referral_commissions WHERE order_id=?", (order_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def cancel_referral_commission(order_id: int, reason: str = "") -> dict | None:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM referral_commissions WHERE order_id=?", (order_id,)) as c:
            row = await c.fetchone()
        if not row:
            return None
        if row["status"] == "paid":
            return dict(row)
        await db.execute("""
            UPDATE referral_commissions
            SET status='canceled', canceled_reason=?
            WHERE order_id=? AND status IN ('pending', 'approved')
        """, (reason or "Pedido cancelado o reembolsado", order_id))
        await db.commit()
    return await get_referral_commission_by_order(order_id)


async def reverse_referral_commission(commission_id: int, reason: str = "") -> dict | None:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        async with db.execute("SELECT * FROM referral_commissions WHERE id=?", (commission_id,)) as c:
            row = await c.fetchone()
        if not row:
            await db.rollback()
            return None
        commission = dict(row)
        if commission["status"] == "paid":
            amount = round(float(commission["reward_amount_usdt"] or 0), 8)
            await db.execute("UPDATE users SET balance = MAX(0, balance - ?) WHERE user_id=?", (amount, int(commission["referrer_user_id"])))
            await db.execute("""
                INSERT INTO balance_log (user_id, amount, type, ref_id, note)
                VALUES (?, ?, 'referral_reward_reversal', ?, ?)
            """, (int(commission["referrer_user_id"]), -amount, str(commission["order_id"]), reason or "Reversión de recompensa"))
        await db.execute("UPDATE referral_commissions SET status='reversed', canceled_reason=? WHERE id=?", (reason or "Reversada por admin", commission_id))
        await db.commit()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM referral_commissions WHERE id=?", (commission_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None


async def list_referral_commissions(status: str = "", referrer_user_id: int | None = None, seller_id: int | None = None, limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """
            SELECT rc.*, mp.name AS product_name,
                   ru.username AS referrer_username, ru.first_name AS referrer_name,
                   bu.username AS buyer_username, bu.first_name AS buyer_name
            FROM referral_commissions rc
            JOIN manual_products mp ON mp.id = rc.product_id
            LEFT JOIN users ru ON ru.user_id = rc.referrer_user_id
            LEFT JOIN users bu ON bu.user_id = rc.buyer_user_id
            WHERE 1=1
        """
        params = []
        if status:
            q += " AND rc.status=?"
            params.append(status)
        if referrer_user_id is not None:
            q += " AND rc.referrer_user_id=?"
            params.append(referrer_user_id)
        if seller_id is not None:
            q += " AND rc.seller_id=?"
            params.append(seller_id)
        q += " ORDER BY rc.created_at DESC LIMIT ?"
        params.append(max(1, min(int(limit or 100), 500)))
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


async def get_user_referral_dashboard(user_id: int) -> dict:
    links = []
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT rl.*, mp.name AS product_name, mp.icon_url, rc.reward_amount_usdt, rc.status AS campaign_status
            FROM referral_links rl
            JOIN manual_products mp ON mp.id = rl.product_id
            JOIN referral_campaigns rc ON rc.id = rl.campaign_id
            WHERE rl.user_id=?
            ORDER BY rl.created_at DESC
        """, (user_id,)) as c:
            links = [dict(r) for r in await c.fetchall()]
    commissions = await list_referral_commissions(referrer_user_id=user_id, limit=500)
    return {
        "links": links,
        "commissions": commissions,
        "pending_total": round(sum(float(c.get("reward_amount_usdt") or 0) for c in commissions if c.get("status") in {"pending", "approved"}), 2),
        "paid_total": round(sum(float(c.get("reward_amount_usdt") or 0) for c in commissions if c.get("status") == "paid"), 2),
        "canceled_total": round(sum(float(c.get("reward_amount_usdt") or 0) for c in commissions if c.get("status") in {"canceled", "reversed"}), 2),
    }


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


# ══════════════════════════════════════
#  SERVICIOS SMM
# ══════════════════════════════════════

async def upsert_smm_service(service: dict):
    now = time.time()
    service_id = int(service.get("service") or service.get("service_id") or 0)
    if not service_id:
        return
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO smm_services (service_id, name, service_type, category, rate, min_qty, max_qty, refill, cancel, raw_json, synced_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(service_id) DO UPDATE SET
                name = excluded.name,
                service_type = excluded.service_type,
                category = excluded.category,
                rate = excluded.rate,
                min_qty = excluded.min_qty,
                max_qty = excluded.max_qty,
                refill = excluded.refill,
                cancel = excluded.cancel,
                raw_json = excluded.raw_json,
                synced_at = excluded.synced_at,
                updated_at = excluded.updated_at
        """, (
            service_id,
            str(service.get("name") or "").strip(),
            str(service.get("type") or service.get("service_type") or "").strip(),
            str(service.get("category") or "General").strip(),
            float(service.get("rate") or 0),
            int(float(service.get("min") or service.get("min_qty") or 1)),
            int(float(service.get("max") or service.get("max_qty") or 1000)),
            1 if service.get("refill") else 0,
            1 if service.get("cancel") else 0,
            json.dumps(service, ensure_ascii=False),
            now,
            now,
        ))
        await db.commit()


async def upsert_smm_services_bulk(services: list[dict], provider: str = "smmfollows"):
    if not services:
        return
    now = time.time()
    params = []
    for s in services:
        sid = int(s.get("service") or s.get("service_id") or 0)
        if not sid:
            continue
        p = str(s.get("provider") or provider or "smmfollows").strip().lower()
        params.append((
            sid,
            str(s.get("name") or "").strip(),
            str(s.get("type") or s.get("service_type") or "").strip(),
            str(s.get("category") or "General").strip(),
            float(s.get("rate") or 0),
            int(float(s.get("min") or s.get("min_qty") or 1)),
            int(float(s.get("max") or s.get("max_qty") or 1000)),
            1 if s.get("refill") else 0,
            1 if s.get("cancel") else 0,
            p,
            json.dumps(s, ensure_ascii=False),
            now,
            now,
        ))
    if not params:
        return
    async with aiosqlite.connect(DB) as db:
        await db.executemany("""
            INSERT INTO smm_services (service_id, name, service_type, category, rate, min_qty, max_qty, refill, cancel, provider, raw_json, synced_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(service_id) DO UPDATE SET
                name = excluded.name,
                service_type = excluded.service_type,
                category = excluded.category,
                rate = excluded.rate,
                min_qty = excluded.min_qty,
                max_qty = excluded.max_qty,
                refill = excluded.refill,
                cancel = excluded.cancel,
                provider = excluded.provider,
                raw_json = excluded.raw_json,
                synced_at = excluded.synced_at,
                updated_at = excluded.updated_at
        """, params)
        await db.commit()


async def list_smm_services(active_only: bool = False, category: str = None, provider: str = None, include_hidden: bool = False) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = "SELECT * FROM smm_services WHERE 1=1"
        params = []
        if active_only:
            q += " AND is_active=1"
        if category:
            q += " AND category=?"
            params.append(category)
        if provider:
            q += " AND provider=?"
            params.append(provider)
        if not include_hidden:
            q += " AND COALESCE(is_active,0) >= 0"
        q += " ORDER BY sort_order ASC, category ASC, name ASC"
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]

async def get_smm_service(service_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM smm_services WHERE service_id=?", (service_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def update_smm_service_config(service_id: int, data: dict):
    allowed = {"is_active", "display_name", "icon_url", "instructions", "custom_markup", "min_price", "sort_order"}
    keys = [k for k in data.keys() if k in allowed]
    if not keys:
        return
    parts = [f"{k}=?" for k in keys] + ["updated_at=?"]
    vals = [data[k] for k in keys] + [time.time(), int(service_id)]
    async with aiosqlite.connect(DB) as db:
        await db.execute(f"UPDATE smm_services SET {', '.join(parts)} WHERE service_id=?", vals)
        await db.commit()

async def create_smm_order(user_id: int, provider_order_id: str, service_id: int, service_name: str, category: str, link: str, quantity: int, cost_price: float, sell_price: float, raw_response: str, drip_feed: bool = False, runs: int = 1, interval: int = 0, total_quantity: int = 0, provider: str = "smmfollows") -> int:
    total_quantity = int(total_quantity or quantity)
    provider_val = str(provider or "smmfollows").strip().lower()
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO smm_orders (user_id, provider_order_id, service_id, service_name, category, link, quantity, drip_feed, runs, interval, total_quantity, cost_price, sell_price, raw_response, provider, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        """, (user_id, provider_order_id, service_id, service_name, category, link, quantity, 1 if drip_feed else 0, runs, interval, total_quantity, cost_price, sell_price, raw_response, provider_val))
        await db.commit()
        return int(cur.lastrowid)

async def get_smm_order(order_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM smm_orders WHERE id=?", (order_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def get_user_smm_orders(user_id: int, limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM smm_orders WHERE user_id=? ORDER BY created_at DESC LIMIT ?", (user_id, limit)) as c:
            return [dict(r) for r in await c.fetchall()]

async def list_smm_orders(limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT o.*, u.username, u.first_name
            FROM smm_orders o
            LEFT JOIN users u ON u.user_id=o.user_id
            ORDER BY o.created_at DESC
            LIMIT ?
        """, (limit,)) as c:
            return [dict(r) for r in await c.fetchall()]

async def update_smm_order_status(order_id: int, status: str, provider_status: str = None, start_count: str = None, remains: str = None, raw_response: str = None, error_message: str = None):
    now = time.time()
    completed_at = now if status == 'completed' else None
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE smm_orders
            SET status=?, provider_status=COALESCE(?, provider_status), start_count=COALESCE(?, start_count), remains=COALESCE(?, remains), raw_response=COALESCE(?, raw_response), error_message=COALESCE(?, error_message), completed_at=COALESCE(?, completed_at), updated_at=?
            WHERE id=?
        """, (status, provider_status, start_count, remains, raw_response, error_message, completed_at, now, order_id))
        await db.commit()

async def refund_smm_order(order_id: int, amount: float = None, reason: str = "Reembolso SMM") -> bool:
    order = await get_smm_order(order_id)
    if not order or order.get("refunded_at"):
        return False
    refund_amount = float(amount if amount is not None else order["sell_price"])
    if refund_amount <= 0:
        return False
    now = time.time()
    user_id = int(order["user_id"])
    async with aiosqlite.connect(DB) as db:
        await db.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (refund_amount, user_id))
        await db.execute("INSERT INTO balance_log (user_id, amount, type, ref_id, note) VALUES (?, ?, ?, ?, ?)", (user_id, refund_amount, "refund", f"smm_{order_id}", f"Reembolso SMM: {reason}"))
        await db.execute("UPDATE smm_orders SET refunded_at=?, status='refunded', updated_at=? WHERE id=?", (now, now, order_id))
        await db.commit()
    try:
        await create_notification(user_id=user_id, type="refund", title="Reembolso SMM", message=f"Se han reembolsado ${refund_amount:.2f} USDT por tu pedido SMM.")
    except Exception:
        pass
    return True


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

async def get_or_create_ai_chat_session(user_id: int) -> dict:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM ai_chat_sessions
            WHERE user_id=? AND status IN ('active', 'handoff')
            ORDER BY updated_at DESC LIMIT 1
        """, (user_id,)) as c:
            row = await c.fetchone()
            if row:
                return dict(row)
        now = time.time()
        cur = await db.execute("""
            INSERT INTO ai_chat_sessions (user_id, status, created_at, updated_at)
            VALUES (?, 'active', ?, ?)
        """, (user_id, now, now))
        await db.commit()
        async with db.execute("SELECT * FROM ai_chat_sessions WHERE id=?", (cur.lastrowid,)) as c:
            return dict(await c.fetchone())

async def get_ai_chat_session(session_id: int, user_id: int | None = None) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        if user_id is None:
            params = (session_id,)
            query = "SELECT * FROM ai_chat_sessions WHERE id=?"
        else:
            params = (session_id, user_id)
            query = "SELECT * FROM ai_chat_sessions WHERE id=? AND user_id=?"
        async with db.execute(query, params) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def list_ai_chat_messages(session_id: int, limit: int = 60) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM ai_chat_messages
            WHERE session_id=?
            ORDER BY created_at DESC LIMIT ?
        """, (session_id, limit)) as c:
            rows = [dict(r) for r in await c.fetchall()]
            return list(reversed(rows))

async def add_ai_chat_message(session_id: int, user_id: int, sender_role: str, message_text: str, metadata: dict | None = None) -> dict:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("""
            INSERT INTO ai_chat_messages (session_id, user_id, sender_role, message_text, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (session_id, user_id, sender_role, message_text, json.dumps(metadata or {}, ensure_ascii=False), now))
        await db.execute("UPDATE ai_chat_sessions SET updated_at=? WHERE id=?", (now, session_id))
        await db.commit()
        async with db.execute("SELECT * FROM ai_chat_messages WHERE id=?", (cur.lastrowid,)) as c:
            return dict(await c.fetchone())

async def mark_ai_chat_handoff(session_id: int, ticket_id: int, room_id: int, last_intent: str = 'human_support'):
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE ai_chat_sessions
            SET status='handoff', handoff_ticket_id=?, handoff_room_id=?, last_intent=?, updated_at=?
            WHERE id=?
        """, (ticket_id, room_id, last_intent, now, session_id))
        await db.commit()

# ═════════════════════════════════════════════════════════════════════════
#  FZR CARDS / TELEGRAM HELPERS
# ═════════════════════════════════════════════════════════════════════════

async def create_fzr_order(user_id: int, provider_order_id: str | None, product_type: str, product_name: str, target: str, quantity: int = 0, months: int = 0, cost_price: float = 0.0, sell_price: float = 0.0, raw_response: str = "", provider_status: str | None = None) -> int:
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            INSERT INTO fzr_orders (user_id, provider_order_id, product_type, product_name, target, quantity, months, cost_price, sell_price, raw_response, provider_status, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        """, (user_id, provider_order_id, product_type, product_name, target, int(quantity or 0), int(months or 0), float(cost_price or 0), float(sell_price or 0), raw_response, provider_status))
        await db.commit()
        return int(cur.lastrowid)

async def get_fzr_order(order_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM fzr_orders WHERE id=?", (order_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def get_user_fzr_orders(user_id: int, limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM fzr_orders WHERE user_id=? ORDER BY created_at DESC LIMIT ?", (user_id, limit)) as c:
            return [dict(r) for r in await c.fetchall()]

async def list_fzr_orders(limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT o.*, u.username, u.first_name
            FROM fzr_orders o
            LEFT JOIN users u ON u.user_id=o.user_id
            ORDER BY o.created_at DESC
            LIMIT ?
        """, (limit,)) as c:
            return [dict(r) for r in await c.fetchall()]

async def update_fzr_order_status(order_id: int, status: str, provider_status: str | None = None, raw_response: str | None = None, error_message: str | None = None):
    now = time.time()
    completed_at = now if status == 'completed' else None
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE fzr_orders
            SET status=?, provider_status=COALESCE(?, provider_status), raw_response=COALESCE(?, raw_response), error_message=COALESCE(?, error_message), completed_at=COALESCE(?, completed_at), updated_at=?
            WHERE id=?
        """, (status, provider_status, raw_response, error_message, completed_at, now, order_id))
        await db.commit()



# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: STREAMING (STREAMZONE B2B)
# ══════════════════════════════════════════════════════════════════════════════

async def get_streaming_catalog_overrides() -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM streaming_catalog_overrides ORDER BY sort_order ASC, product_id ASC") as c:
            return [dict(r) for r in await c.fetchall()]

async def get_streaming_catalog_override(product_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM streaming_catalog_overrides WHERE product_id = ?", (str(product_id).strip(),)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def set_streaming_catalog_override(
    product_id: str,
    custom_name: str = None,
    custom_image_url: str = None,
    custom_description: str = None,
    custom_terms: str = None,
    retail_price_usd: float = None,
    reseller_price_usd: float = None,
    markup_percent: float = None,
    is_hidden: int = 0,
    is_featured: int = 0,
    sort_order: int = 100
):
    now = time.time()
    pid = str(product_id).strip()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT INTO streaming_catalog_overrides (
                product_id, custom_name, custom_image_url, custom_description, custom_terms,
                retail_price_usd, reseller_price_usd, markup_percent, is_hidden, is_featured, sort_order, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(product_id) DO UPDATE SET
                custom_name = excluded.custom_name,
                custom_image_url = excluded.custom_image_url,
                custom_description = excluded.custom_description,
                custom_terms = excluded.custom_terms,
                retail_price_usd = excluded.retail_price_usd,
                reseller_price_usd = excluded.reseller_price_usd,
                markup_percent = excluded.markup_percent,
                is_hidden = excluded.is_hidden,
                is_featured = excluded.is_featured,
                sort_order = excluded.sort_order,
                updated_at = excluded.updated_at
        """, (
            pid, custom_name, custom_image_url, custom_description, custom_terms,
            retail_price_usd, reseller_price_usd, markup_percent, is_hidden, is_featured, sort_order, now
        ))
        await db.commit()

async def record_streaming_order(
    user_id: int,
    streamzone_order_id: str,
    product_id: str,
    product_name: str,
    quantity: int = 1,
    cost_price_cop: float = 0.0,
    cost_price_usd: float = 0.0,
    sell_price_usd: float = 0.0,
    credentials_json: str = "[]",
    status: str = "completed",
    error_message: str = None,
    raw_response: str = "{}"
) -> int:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        cursor = await db.execute("""
            INSERT INTO streaming_orders (
                user_id, streamzone_order_id, product_id, product_name, quantity,
                cost_price_cop, cost_price_usd, sell_price_usd, credentials_json,
                status, error_message, raw_response, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, streamzone_order_id, product_id, product_name, quantity,
            cost_price_cop, cost_price_usd, sell_price_usd, credentials_json,
            status, error_message, raw_response, now, now
        ))
        await db.commit()
        return cursor.lastrowid

async def get_streaming_orders(limit: int = 100, user_id: int = None) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        if user_id:
            q = "SELECT o.*, u.username, u.first_name FROM streaming_orders o LEFT JOIN users u ON u.user_id = o.user_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT ?"
            params = (user_id, limit)
        else:
            q = "SELECT o.*, u.username, u.first_name FROM streaming_orders o LEFT JOIN users u ON u.user_id = o.user_id ORDER BY o.created_at DESC LIMIT ?"
            params = (limit,)
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: CATÁLOGO FZR
# ══════════════════════════════════════════════════════════════════════════════

def _fzr_json(value, fallback):
    try:
        return json.dumps(value if value is not None else fallback, ensure_ascii=False, default=str)
    except Exception:
        return json.dumps(fallback, ensure_ascii=False)

async def upsert_fzr_catalog_categories(provider_type: str, categories: list[dict]) -> int:
    now = time.time()
    rows = []
    for item in categories:
        category_id = str(item.get("category_id") or "").strip()
        name = str(item.get("name") or category_id).strip()
        if not category_id or not name:
            continue
        rows.append((
            provider_type, category_id, name, item.get("image_url"),
            int(bool(item.get("is_available", True))), _fzr_json(item.get("raw"), {}), now, now,
        ))
    if not rows:
        return 0
    async with aiosqlite.connect(DB) as conn:
        await conn.executemany("""
            INSERT INTO fzr_catalog_categories
                (provider_type, category_id, name, image_url, is_available, raw_json, synced_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(provider_type, category_id) DO UPDATE SET
                name=excluded.name,
                image_url=COALESCE(excluded.image_url, fzr_catalog_categories.image_url),
                is_available=excluded.is_available,
                raw_json=excluded.raw_json,
                synced_at=excluded.synced_at,
                updated_at=excluded.updated_at
        """, rows)
        await conn.commit()
    return len(rows)

async def upsert_fzr_catalog_offers(provider_type: str, category_id: str, offers: list[dict]) -> int:
    now = time.time()
    rows = []
    for item in offers:
        offer_id = str(item.get("offer_id") or "").strip()
        name = str(item.get("name") or offer_id).strip()
        if not offer_id or not name:
            continue
        rows.append((
            provider_type, category_id, offer_id, name, item.get("cost_usdt"), item.get("currency"),
            item.get("stock"), item.get("min_quantity"), item.get("max_quantity"),
            _fzr_json(item.get("required_fields"), []), int(bool(item.get("is_available", True))),
            _fzr_json(item.get("raw"), {}), now, now,
        ))
    if not rows:
        return 0
    async with aiosqlite.connect(DB) as conn:
        await conn.executemany("""
            INSERT INTO fzr_catalog_offers
                (provider_type, category_id, offer_id, name, cost_usdt, currency, stock, min_quantity,
                 max_quantity, required_fields, is_available, raw_json, synced_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(provider_type, category_id, offer_id) DO UPDATE SET
                name=excluded.name,
                cost_usdt=excluded.cost_usdt,
                currency=excluded.currency,
                stock=excluded.stock,
                min_quantity=excluded.min_quantity,
                max_quantity=excluded.max_quantity,
                required_fields=excluded.required_fields,
                is_available=excluded.is_available,
                raw_json=excluded.raw_json,
                synced_at=excluded.synced_at,
                updated_at=excluded.updated_at
        """, rows)
        await conn.commit()
    return len(rows)

async def list_fzr_catalog_categories(provider_type: str | None = None) -> list[dict]:
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        sql = """
            SELECT c.*, m.game_name, m.region_key, m.display_name, m.icon_url AS mapping_icon_url,
                   m.description, m.instructions, m.retail_markup, m.reseller_markup,
                   COALESCE(m.is_active, 0) AS mapping_active
            FROM fzr_catalog_categories c
            LEFT JOIN fzr_catalog_mappings m
              ON m.provider_type=c.provider_type AND m.category_id=c.category_id
        """
        params = []
        if provider_type:
            sql += " WHERE c.provider_type=?"
            params.append(provider_type)
        sql += " ORDER BY c.name COLLATE NOCASE"
        async with conn.execute(sql, params) as cur:
            return [dict(row) for row in await cur.fetchall()]

async def update_fzr_catalog_category_image(provider_type: str, category_id: str, image_url: str) -> None:
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("UPDATE fzr_catalog_categories SET image_url=?, updated_at=? WHERE provider_type=? AND category_id=?", (image_url, time.time(), provider_type, category_id))
        await conn.commit()

async def update_fzr_catalog_category_available(provider_type: str, category_id: str, is_available: bool) -> None:
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("UPDATE fzr_catalog_categories SET is_available=?, updated_at=? WHERE provider_type=? AND category_id=?", (1 if is_available else 0, time.time(), provider_type, category_id))
        await conn.commit()

async def get_fzr_catalog_category(provider_type: str, category_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("""
            SELECT c.*, m.game_name, m.region_key, m.display_name, m.icon_url AS mapping_icon_url,
                   m.description, m.instructions, m.retail_markup, m.reseller_markup,
                   COALESCE(m.is_active, 0) AS mapping_active
            FROM fzr_catalog_categories c
            LEFT JOIN fzr_catalog_mappings m
              ON m.provider_type=c.provider_type AND m.category_id=c.category_id
            WHERE c.provider_type=? AND c.category_id=?
        """, (provider_type, category_id)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None

async def list_fzr_catalog_offers(provider_type: str, category_id: str) -> list[dict]:
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("""
            SELECT * FROM fzr_catalog_offers
            WHERE provider_type=? AND category_id=?
            ORDER BY name COLLATE NOCASE
        """, (provider_type, category_id)) as cur:
            return [dict(row) for row in await cur.fetchall()]

async def upsert_fzr_catalog_mapping(provider_type: str, category_id: str, values: dict, approved_by: int) -> dict:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("""
            INSERT INTO fzr_catalog_mappings
                (provider_type, category_id, game_name, region_key, display_name, icon_url, description,
                 instructions, retail_markup, reseller_markup, is_active, approved_at, approved_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(provider_type, category_id) DO UPDATE SET
                game_name=excluded.game_name,
                region_key=excluded.region_key,
                display_name=excluded.display_name,
                icon_url=excluded.icon_url,
                description=excluded.description,
                instructions=excluded.instructions,
                retail_markup=excluded.retail_markup,
                reseller_markup=excluded.reseller_markup,
                is_active=excluded.is_active,
                approved_at=excluded.approved_at,
                approved_by=excluded.approved_by,
                updated_at=excluded.updated_at
        """, (
            provider_type, category_id, values["game_name"], values.get("region_key") or "__standard__",
            values.get("display_name"), values.get("icon_url"), values.get("description"), values.get("instructions"),
            values.get("retail_markup"), values.get("reseller_markup"), int(bool(values.get("is_active"))),
            now if values.get("is_active") else None, approved_by, now, now,
        ))
        await conn.commit()
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM fzr_catalog_mappings WHERE provider_type=? AND category_id=?", (provider_type, category_id)) as cur:
            return dict(await cur.fetchone())

async def refund_fzr_order(order_id: int, reason: str = "Cancelada / Reembolsada por el proveedor") -> bool:
    order = await get_fzr_order(order_id)
    if not order:
        return False
    if order.get("refunded_at"):
        return False
    user_id = order["user_id"]
    sell_price = float(order.get("sell_price") or 0.0)
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        if sell_price > 0:
            await db.execute("UPDATE users SET balance = balance + ?, total_spent = MAX(0.0, total_spent - ?) WHERE user_id = ?", (sell_price, sell_price, user_id))
            await db.execute("""
                INSERT INTO balance_log (user_id, amount, type, ref_id, note)
                VALUES (?, ?, 'refund', ?, ?)
            """, (user_id, sell_price, f"fzr_{order_id}", f"Reembolso FZR: {reason}"))
        await db.execute("UPDATE fzr_orders SET status='refunded', refunded_at=?, error_message=?, updated_at=? WHERE id=?", (now, reason, now, order_id))
        await db.commit()
    try:
        await create_notification(user_id=user_id, type="refund", title="Reembolso de Pedido", message=f"Tu pedido #{order_id} ({order.get('product_name')}) ha sido reembolsado (${sell_price:.2f} USDT).")
    except Exception:
        pass
    return True


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: PEDIDOS CUP & VERIFICACIÓN
# ══════════════════════════════════════════════════════════════════════════════

async def create_cup_order(
    *, user_id: int, user_role: str, product_id: int, product_name: str,
    cost_price: float, public_sell_price: float, markup_pct: float,
    recharge_config: str, payment_method: str, payment_amount: int,
    cup_usdt_purchase_price: float, cup_sale_factor: float, cup_sale_rate: float,
) -> str:
    """Crea una orden por CUP sin tocar el monedero ni enviar al proveedor."""
    mid = gen_order_id()
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("""
            INSERT INTO orders (
                merchant_order_id, user_id, user_role, product_id, product_name,
                quantity, cost_price, sell_price, platform_fee, markup_pct,
                recharge_config, currency, sales_channel,
                payment_method, payment_status, payment_currency, payment_amount,
                provider_cost_usdt_snapshot, cup_usdt_purchase_price_snapshot,
                cup_sale_factor_snapshot, cup_sale_rate_snapshot, cup_amount_snapshot,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'USDT', 'direct',
                      ?, 'awaiting_proof', 'CUP', ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            mid, user_id, user_role, product_id, product_name,
            cost_price, public_sell_price, round(public_sell_price - cost_price, 4), markup_pct,
            recharge_config, payment_method, int(payment_amount), cost_price,
            cup_usdt_purchase_price, cup_sale_factor, cup_sale_rate, int(payment_amount), now, now,
        ))
        await conn.commit()
    return mid

async def find_recent_equivalent_fzr_cup_order(
    *, user_id: int, recharge_config: str, payment_method: str, within_seconds: int = 1800
) -> dict | None:
    """Devuelve una reserva CUP FZR aún pendiente para reintentos del mismo checkout.

    El cliente puede recargar la página o perder la conexión después de crear la
    reserva, antes de subir el comprobante. Reutilizarla evita generar dos pagos
    por la misma compra, sin impedir una compra nueva una vez pasado el plazo.
    """
    cutoff = time.time() - max(60, int(within_seconds))
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("""
            SELECT merchant_order_id, payment_status, payment_method, payment_amount,
                   product_name, created_at
            FROM orders
            WHERE user_id=?
              AND sales_channel='fzr_cup'
              AND recharge_config=?
              AND payment_method=?
              AND payment_status IN ('awaiting_proof', 'pending_verification', 'awaiting_network_confirmation')
              AND created_at>=?
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id, recharge_config, payment_method, cutoff)) as cursor:
            row = await cursor.fetchone()
    return dict(row) if row else None


async def create_fzr_cup_order(
    *, user_id: int, user_role: str, provider_type: str, category_id: str, offer_id: str,
    product_name: str, cost_price: float, public_sell_price: float, markup_pct: float,
    fields: dict, quantity: int, payment_method: str, payment_amount: int,
    cup_usdt_purchase_price: float, cup_sale_factor: float, cup_sale_rate: float,
    items: list[dict] | None = None
) -> str:
    """Crea una orden CUP FZR. El proveedor se llama únicamente tras verificar el pago."""
    mid = gen_order_id()
    now = time.time()
    payload = {"fields": fields, "quantity": int(quantity)}
    if items:
        payload["items"] = items
    recharge_config = json.dumps(payload, ensure_ascii=False, default=str)
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("""
            INSERT INTO orders (
                merchant_order_id, user_id, user_role, product_id, product_name,
                quantity, cost_price, sell_price, platform_fee, markup_pct,
                recharge_config, currency, sales_channel,
                payment_method, payment_status, payment_currency, payment_amount,
                provider_cost_usdt_snapshot, cup_usdt_purchase_price_snapshot,
                cup_sale_factor_snapshot, cup_sale_rate_snapshot, cup_amount_snapshot,
                provider_code, provider_type, provider_category_id, provider_offer_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'USDT', 'fzr_cup',
                      ?, 'awaiting_proof', 'CUP', ?, ?, ?, ?, ?, ?, 'fzr', ?, ?, ?, ?, ?)
        """, (
            mid, user_id, user_role, product_name, int(quantity), cost_price, public_sell_price,
            round(public_sell_price - cost_price, 4), markup_pct, recharge_config,
            payment_method, int(payment_amount), cost_price, cup_usdt_purchase_price,
            cup_sale_factor, cup_sale_rate, int(payment_amount), provider_type, category_id,
            offer_id, now, now,
        ))
        await conn.commit()
    return mid

async def create_manual_cup_order(
    *, user_id: int, user_role: str, product_id: int, product_name: str,
    cost_price: float, public_sell_price: float,
    recharge_config: str, payment_method: str, payment_amount: int,
    cup_usdt_purchase_price: float, cup_sale_factor: float, cup_sale_rate: float,
    seller_id: int = None,
) -> str:
    """Crea una orden CUP para producto manual sin tocar monedero."""
    mid = gen_order_id()
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("""
            INSERT INTO orders (
                merchant_order_id, user_id, user_role, product_id, product_name,
                quantity, cost_price, sell_price, platform_fee, markup_pct,
                recharge_config, currency, sales_channel,
                payment_method, payment_status, payment_currency, payment_amount,
                provider_cost_usdt_snapshot, cup_usdt_purchase_price_snapshot,
                cup_sale_factor_snapshot, cup_sale_rate_snapshot, cup_amount_snapshot,
                seller_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?, 'USDT', 'manual_cup',
                      ?, 'awaiting_proof', 'CUP', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            mid, user_id, user_role, product_id, product_name,
            cost_price, public_sell_price, round(public_sell_price - cost_price, 4),
            recharge_config, payment_method, int(payment_amount), cost_price,
            cup_usdt_purchase_price, cup_sale_factor, cup_sale_rate, int(payment_amount),
            seller_id, now, now,
        ))
        await conn.commit()
    return mid

async def list_cup_orders(payment_status: str | None = None, limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        query = "SELECT * FROM orders WHERE payment_method IN ('cup_card_transfer', 'cup_mobile_balance')"
        params = []
        if payment_status:
            query += " AND payment_status=?"
            params.append(payment_status)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(max(1, min(int(limit), 300)))
        async with conn.execute(query, params) as c:
            return [dict(row) for row in await c.fetchall()]

async def claim_cup_order_verification(merchant_order_id: str, admin_id: int) -> dict | None:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("BEGIN IMMEDIATE")
        cur = await conn.execute("""
            UPDATE orders
            SET payment_status='verifying', cup_payment_verified_by=?, updated_at=?
            WHERE merchant_order_id=? AND payment_status IN ('pending_verification', 'awaiting_network_confirmation')
              AND payment_method IN ('cup_card_transfer', 'cup_mobile_balance')
        """, (admin_id, now, merchant_order_id))
        if cur.rowcount != 1:
            await conn.rollback()
            return None
        async with conn.execute("SELECT * FROM orders WHERE merchant_order_id=?", (merchant_order_id,)) as c:
            row = await c.fetchone()
        await conn.commit()
        return dict(row) if row else None

async def finish_cup_order_verification(merchant_order_id: str, provider_order_id: str, order_status: int, admin_id: int) -> None:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("""
            UPDATE orders
            SET payment_status='verified', cup_payment_verified_by=?, cup_payment_verified_at=?,
                buffpin_order_id=?, order_status=?, updated_at=?
            WHERE merchant_order_id=? AND payment_status='verifying'
        """, (admin_id, now, provider_order_id, order_status, now, merchant_order_id))
        await conn.commit()

async def finish_fzr_cup_order_verification(merchant_order_id: str, provider_order_id: str, provider_status: str, admin_id: int) -> None:
    now = time.time()
    normalized = str(provider_status or "processing").lower()
    completed = normalized in {"completed", "complete", "delivered", "success"}
    failed = normalized in {"failed", "rejected", "cancelled", "canceled", "refunded", "refund"}
    order_status = 2 if completed else (4 if failed else 1)
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("""
            UPDATE orders
            SET payment_status='verified', cup_payment_verified_by=?, cup_payment_verified_at=?, buffpin_order_id=?, provider_order_id=?,
                provider_status=?, order_status=?, updated_at=?
            WHERE merchant_order_id=? AND payment_status='verifying' AND provider_code='fzr'
        """, (admin_id, now, provider_order_id, provider_order_id, normalized, order_status, now, merchant_order_id))
        await conn.commit()

async def mark_cup_order_provider_failed(merchant_order_id: str, error_message: str) -> None:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("""
            UPDATE orders
            SET payment_status='provider_failed', order_status=4, error_message=?, updated_at=?
            WHERE merchant_order_id=? AND payment_status='verifying'
        """, (str(error_message)[:1000], now, merchant_order_id))
        await conn.commit()

async def reject_cup_order_payment(merchant_order_id: str, admin_id: int, reason: str) -> dict | None:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        cur = await conn.execute("""
            UPDATE orders
            SET payment_status='rejected', cup_payment_verified_by=?, cup_payment_verified_at=?,
                cup_payment_rejection_reason=?, updated_at=?
            WHERE merchant_order_id=? AND payment_status IN ('awaiting_proof', 'pending_verification')
              AND payment_method IN ('cup_card_transfer', 'cup_mobile_balance')
        """, (admin_id, now, reason.strip()[:1000], now, merchant_order_id))
        if cur.rowcount != 1:
            await conn.rollback()
            return None
        async with conn.execute("SELECT * FROM orders WHERE merchant_order_id=?", (merchant_order_id,)) as c:
            row = await c.fetchone()
        await conn.commit()
        return dict(row) if row else None

async def submit_cup_payment_proof(merchant_order_id: str, user_id: int, proof_url: str, reference: str = "") -> dict | None:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        cur = await conn.execute("""
            UPDATE orders
            SET cup_payment_proof_url=?, cup_payment_reference=?, cup_payment_submitted_at=?,
                payment_status='pending_verification', updated_at=?
            WHERE merchant_order_id=? AND user_id=?
              AND payment_method IN ('cup_card_transfer', 'cup_mobile_balance')
              AND payment_status IN ('awaiting_proof', 'pending_verification')
        """, (proof_url, reference.strip()[:200], now, now, merchant_order_id, user_id))
        if cur.rowcount != 1:
            await conn.rollback()
            return None
        async with conn.execute("SELECT * FROM orders WHERE merchant_order_id=?", (merchant_order_id,)) as c:
            row = await c.fetchone()
        await conn.commit()
        return dict(row) if row else None

async def update_fzr_cup_order_provider_status(merchant_order_id: str, provider_status: str, raw_response: str = "", error_message: str = None) -> None:
    normalized = str(provider_status or "processing").lower()
    completed = normalized in {"completed", "complete", "delivered", "success"}
    failed = normalized in {"failed", "rejected", "cancelled", "canceled", "refunded", "refund"}
    order_status = 2 if completed else (4 if failed else 1)
    refund_status = 1 if failed else 0
    async with aiosqlite.connect(DB) as conn:
        if failed and error_message:
            await conn.execute("""
                UPDATE orders
                SET provider_status=?, order_status=?, refund_status=CASE WHEN refund_status=0 THEN ? ELSE refund_status END, error_message=?, updated_at=?
                WHERE merchant_order_id=? AND provider_code='fzr' AND payment_status IN ('verified', 'paid')
            """, (normalized, order_status, refund_status, error_message, time.time(), merchant_order_id))
        else:
            await conn.execute("""
                UPDATE orders
                SET provider_status=?, order_status=?, refund_status=CASE WHEN ?=4 AND refund_status=0 THEN 1 ELSE refund_status END, updated_at=?
                WHERE merchant_order_id=? AND provider_code='fzr' AND payment_status IN ('verified', 'paid')
            """, (normalized, order_status, order_status, time.time(), merchant_order_id))
        await conn.commit()

async def _enqueue_reseller_order_event(conn, merchant_order_id: str, event_type: str):
    try:
        async with conn.execute("SELECT user_id FROM orders WHERE merchant_order_id=?", (merchant_order_id,)) as cur:
            row = await cur.fetchone()
        if not row:
            return
        user_id = row[0]
        event_id = f"evt_{int(time.time()*1000)}_{merchant_order_id[:8]}"
        await conn.execute(
            "INSERT OR IGNORE INTO reseller_webhook_events (event_id, user_id, event_type, order_id) VALUES (?, ?, ?, ?)",
            (event_id, user_id, event_type, merchant_order_id)
        )
        async with conn.execute(
            "SELECT id, event_types FROM reseller_webhook_endpoints WHERE user_id=? AND status='active'",
            (user_id,)
        ) as cur:
            endpoints = await cur.fetchall()
        now = time.time()
        for ep in endpoints:
            await conn.execute(
                "INSERT OR IGNORE INTO reseller_webhook_deliveries (event_id, endpoint_id, status, next_attempt_at) VALUES (?, ?, 'pending', ?)",
                (event_id, ep[0], now)
            )
    except Exception:
        pass

async def refund_order_balance(merchant_order_id: str, user_id: int, amount: float, note: str = "Reembolso de pedido") -> bool:
    amount = round(float(amount), 4)
    if not merchant_order_id or amount <= 0:
        return False
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("BEGIN IMMEDIATE")
        cur = await conn.execute(
            "UPDATE orders SET refund_status=1, updated_at=? WHERE merchant_order_id=? AND COALESCE(refund_status,0)=0",
            (now, merchant_order_id),
        )
        if cur.rowcount != 1:
            await conn.rollback()
            return False
        await conn.execute("UPDATE users SET balance=balance+? WHERE user_id=?", (amount, user_id))
        await conn.execute(
            "INSERT INTO balance_log (user_id, amount, type, ref_id, note) VALUES (?, ?, 'refund', ?, ?)",
            (user_id, amount, merchant_order_id, note),
        )
        await _enqueue_reseller_order_event(conn, merchant_order_id, "order.refunded")
        await conn.commit()
    try:
        await create_notification(
            user_id=int(user_id), type="balance", title="Saldo reembolsado",
            message=f"Se devolvieron {amount:.2f} USDT a tu saldo.", url="/pedidos",
        )
    except Exception as exc:
        log.warning("Error creating refund notification: %s", exc)
    return True


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: VIP, KYC & RETIROS DE USUARIOS
# ══════════════════════════════════════════════════════════════════════════════

VIP_PLANS = {
    "vip_standard": {
        "id": "vip_standard",
        "name": "Francho Gold",
        "title": "Francho Gold",
        "price": 4.99,
        "price_usd": 4.99,
        "duration_days": 30,
        "badge": "⭐ GOLD",
        "fee_discount": 1.00,
        "priority_support": True,
        "features": [
            "0% comisión en todos tus retiros (USDT / FC)",
            "Insignia GOLD exclusiva en tu perfil y P2P",
            "Límite diario de retiros y operaciones ampliado a $2,500 FC",
            "Prioridad máxima en órdenes de soporte y reclamos",
            "Acceso anticipado a promociones y ofertas relámpago"
        ]
    },
    "vip_pro": {
        "id": "vip_pro",
        "name": "Francho Gold Pro",
        "title": "Francho Gold Pro",
        "price": 9.99,
        "price_usd": 9.99,
        "duration_days": 30,
        "badge": "👑 GOLD Pro",
        "fee_discount": 1.00,
        "priority_support": True,
        "features": [
            "0% comisión en todos tus retiros (USDT / FC)",
            "Insignia 👑 GOLD Pro exclusiva con máxima reputación",
            "Límite diario de retiros ampliado a $10,000 FC",
            "Canal directo con el Administrador y Soporte VIP",
            "Prioridad máxima en emparejamiento de órdenes P2P",
            "Tarifas mayoristas preferenciales en servicios selectos"
        ]
    },
}

async def get_user_vip_status(user_id: int) -> dict:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM user_vip_subscriptions
            WHERE user_id = ? AND status = 'active' AND expires_at > ?
            ORDER BY expires_at DESC LIMIT 1
        """, (user_id, now)) as c:
            row = await c.fetchone()
            if row:
                d = dict(row)
                d["is_vip"] = True
                d["days_remaining"] = max(0, int((d["expires_at"] - now) // 86400))
                pid = d.get("plan_id")
                if pid in VIP_PLANS:
                    d["badge"] = VIP_PLANS[pid].get("badge", "⭐ GOLD")
                    d["plan_name"] = VIP_PLANS[pid].get("title", "Francho Gold")
                elif not d.get("badge"):
                    d["badge"] = "⭐ GOLD"
                    d["plan_name"] = "Francho Gold"
                return d
            return {"is_vip": False, "plan_id": None, "badge": None, "expires_at": None, "days_remaining": 0}

async def subscribe_user_vip(user_id: int, plan_id: str, months: int = 1) -> dict:
    if plan_id == "vip_monthly":
        plan_id = "vip_standard"
    if plan_id not in VIP_PLANS:
        raise ValueError("Plan VIP inválido")
    plan = VIP_PLANS[plan_id]
    cost = round(plan.get("price", plan.get("price_usd", 4.99)) * max(1, months), 2)
    now = time.time()
    duration_days = plan.get("duration_days", 30) * max(1, months)
    duration_seconds = duration_days * 86400

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,)) as c:
            u = await c.fetchone()
            if not u or float(u["balance"]) < cost:
                raise ValueError("Saldo insuficiente en tu monedero Francho")

        cur_status = await get_user_vip_status(user_id)
        if cur_status["is_vip"] and cur_status.get("expires_at", 0) > now:
            new_expires = cur_status["expires_at"] + duration_seconds
        else:
            new_expires = now + duration_seconds

        await db.execute("UPDATE users SET balance = balance - ? WHERE user_id = ?", (cost, user_id))
        await db.execute("""
            INSERT INTO balance_log (user_id, amount, type, ref_id, note)
            VALUES (?, ?, 'vip_subscription', ?, ?)
        """, (user_id, -cost, plan_id, f"Suscripción {plan.get('title') or plan.get('name')} ({months} mes(es))"))

        cursor = await db.execute("""
            INSERT INTO user_vip_subscriptions (user_id, plan_id, plan_title, price_paid, duration_days, starts_at, expires_at, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
        """, (user_id, plan_id, plan.get("title") or plan.get("name"), cost, duration_days, now, new_expires, now))
        await db.commit()
        return {
            "ok": True,
            "subscription_id": cursor.lastrowid,
            "plan_id": plan_id,
            "plan_title": plan.get("title") or plan.get("name"),
            "price_paid": cost,
            "expires_at": new_expires
        }

async def get_user_kyc(user_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM user_kyc WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,)) as c:
            row = await c.fetchone()
            if not row:
                return None
            d = dict(row)
            d["is_verified"] = d.get("status") == "approved"
            d["tier"] = 1 if d["is_verified"] else 0
            return d

async def submit_user_kyc(
    user_id: int,
    full_name: str,
    doc_type: str,
    doc_number: str,
    front_url: str,
    back_url: str = None,
    selfie_url: str = None
) -> dict:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM user_kyc WHERE user_id = ? AND status IN ('pending', 'approved')", (user_id,)) as c:
            existing = await c.fetchone()
            if existing:
                if existing["status"] == "approved":
                    raise ValueError("Tu identidad ya ha sido verificada y aprobada.")
                raise ValueError("Ya tienes una solicitud de verificación KYC en proceso.")

        cursor = await db.execute("""
            INSERT INTO user_kyc (user_id, full_name, doc_type, doc_number, doc_front_url, doc_back_url, selfie_url, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        """, (user_id, full_name.strip(), doc_type.strip(), doc_number.strip(), front_url.strip(), (back_url or "").strip(), (selfie_url or "").strip(), now, now))
        await db.commit()
        return {"ok": True, "kyc_id": cursor.lastrowid, "status": "pending"}

async def admin_list_kyc(status: str = "pending", limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = "SELECT k.*, u.username, u.first_name, u.email FROM user_kyc k LEFT JOIN users u ON u.user_id = k.user_id"
        params = []
        if status and status != "all":
            q += " WHERE k.status = ?"
            params.append(status)
        q += " ORDER BY k.created_at ASC LIMIT ?"
        params.append(limit)
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]

async def admin_review_kyc(user_id: int, status: str, admin_id: int, note: str = "") -> dict:
    if status not in ("approved", "rejected"):
        raise ValueError("Estado de revisión inválido")
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE user_kyc
            SET status = ?, reviewed_by = ?, rejection_reason = ?, updated_at = ?
            WHERE user_id = ? AND status = 'pending'
        """, (status, admin_id, note, now, user_id))
        await db.commit()
    try:
        title = "Verificación KYC Aprobada ✅" if status == "approved" else "Verificación KYC Rechazada ⚠️"
        msg = "¡Tu identidad ha sido verificada exitosamente!" if status == "approved" else f"Tu solicitud no fue aprobada: {note}"
        await create_notification(user_id=user_id, type="kyc", title=title, message=msg, url="/perfil")
    except Exception:
        pass
    return {"ok": True, "status": status}

async def create_user_wallet_withdrawal(
    user_id: int,
    amount: float,
    method: str,
    payout_details: str
) -> dict:
    amount = round(float(amount), 2)
    if amount < 5.0:
        raise ValueError("El monto mínimo de retiro es de 5.00 USDT")

    now = time.time()
    vip_status = await get_user_vip_status(user_id)
    fee_percent = 0.0 if vip_status["is_vip"] else 0.03
    fee_amount = round(amount * fee_percent, 2)
    net_payout = round(amount - fee_amount, 2)

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,)) as c:
            u = await c.fetchone()
            if not u or float(u["balance"]) < amount:
                raise ValueError("Saldo insuficiente en tu monedero Francho")

        await db.execute("UPDATE users SET balance = balance - ? WHERE user_id = ?", (amount, user_id))
        await db.execute("""
            INSERT INTO balance_log (user_id, amount, type, ref_id, note)
            VALUES (?, ?, 'wallet_withdrawal', '', ?)
        """, (user_id, -amount, f"Retiro solicitado por {method}"))

        cursor = await db.execute("""
            INSERT INTO user_wallet_withdrawals (
                user_id, amount, fee, net_amount, method, payout_details, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        """, (user_id, amount, fee_amount, net_payout, method.strip(), payout_details.strip(), now, now))
        await db.commit()
        return {
            "ok": True,
            "withdrawal_id": cursor.lastrowid,
            "amount": amount,
            "fee": fee_amount,
            "net_amount": net_payout,
            "status": "pending"
        }

async def list_user_wallet_withdrawals(user_id: int = None, limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        if user_id:
            q = "SELECT w.*, u.username, u.first_name FROM user_wallet_withdrawals w LEFT JOIN users u ON u.user_id = w.user_id WHERE w.user_id = ? ORDER BY w.created_at DESC LIMIT ?"
            params = (user_id, limit)
        else:
            q = "SELECT w.*, u.username, u.first_name, u.email FROM user_wallet_withdrawals w LEFT JOIN users u ON u.user_id = w.user_id ORDER BY w.created_at DESC LIMIT ?"
            params = (limit,)
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]

async def admin_decide_user_withdrawal(
    withdrawal_id: int,
    action: str,
    admin_id: int,
    tx_id: str = "",
    note: str = ""
) -> dict:
    if action not in ("approve", "reject"):
        raise ValueError("Acción inválida")
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM user_wallet_withdrawals WHERE id = ? AND status = 'pending'", (withdrawal_id,)) as c:
            w = await c.fetchone()
            if not w:
                raise ValueError("Retiro no encontrado o ya procesado")

        uid = w["user_id"]
        amt = float(w["amount"])

        if action == "approve":
            await db.execute("""
                UPDATE user_wallet_withdrawals
                SET status = 'completed', tx_id = ?, admin_note = ?, reviewed_by = ?, updated_at = ?
                WHERE id = ?
            """, (tx_id.strip(), note.strip(), admin_id, now, withdrawal_id))
            await db.commit()
            try:
                await create_notification(user_id=uid, type="withdrawal", title="Retiro Completado 💸", message=f"Tu retiro de ${w['net_amount']:.2f} USDT ha sido transferido.", url="/perfil")
            except Exception:
                pass
            return {"ok": True, "status": "completed"}
        else:
            await db.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amt, uid))
            await db.execute("""
                INSERT INTO balance_log (user_id, amount, type, ref_id, note)
                VALUES (?, ?, 'withdrawal_refund', ?, ?)
            """, (uid, amt, str(withdrawal_id), f"Reembolso por retiro rechazado: {note}"))
            await db.execute("""
                UPDATE user_wallet_withdrawals
                SET status = 'rejected', admin_note = ?, reviewed_by = ?, updated_at = ?
                WHERE id = ?
            """, (note.strip(), admin_id, now, withdrawal_id))
            await db.commit()
            try:
                await create_notification(user_id=uid, type="withdrawal", title="Retiro Rechazado ❌", message=f"Tu solicitud de retiro fue rechazada y tu saldo reembolsado: {note}", url="/perfil")
            except Exception:
                pass
            return {"ok": True, "status": "rejected"}


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: SWAPS DE CRIPTOMONEDAS
# ══════════════════════════════════════════════════════════════════════════════

async def create_swap_order(
    user_id: int,
    from_currency: str,
    to_currency: str,
    from_amount: float,
    to_amount: float,
    deposit_address: str,
    payout_address: str,
    rate: float
) -> int:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        cursor = await db.execute("""
            INSERT INTO user_crypto_swaps (
                user_id, from_currency, to_currency, from_amount, to_amount,
                deposit_address, payout_address, rate, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        """, (
            user_id, from_currency.upper(), to_currency.upper(), from_amount, to_amount,
            deposit_address, payout_address, rate, now, now
        ))
        await db.commit()
        return cursor.lastrowid

async def update_swap_order(swap_id: int, status: str, tx_hash: str = None, error: str = None):
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE user_crypto_swaps
            SET status = ?, tx_hash = COALESCE(?, tx_hash), error_message = COALESCE(?, error_message), updated_at = ?
            WHERE id = ?
        """, (status, tx_hash, error, now, swap_id))
        await db.commit()

async def get_swap_order(swap_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM user_crypto_swaps WHERE id = ?", (swap_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def list_user_swap_orders(user_id: int, limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM user_crypto_swaps WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", (user_id, limit)) as c:
            return [dict(r) for r in await c.fetchall()]


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: TIENDAS WEB DE REVENDEDORES (WHITE-LABEL)
# ══════════════════════════════════════════════════════════════════════════════

async def get_web_store_by_slug(slug: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        clean_slug = str(slug).lower().strip()
        async with db.execute("SELECT * FROM reseller_web_stores WHERE LOWER(slug) = ?", (clean_slug,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def get_web_store_by_domain(domain: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        clean_domain = str(domain).lower().strip().replace("http://", "").replace("https://", "").split("/")[0]
        async with db.execute("SELECT * FROM reseller_web_stores WHERE LOWER(custom_domain) = ?", (clean_domain,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def get_web_store_by_user(user_id: int) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM reseller_web_stores WHERE user_id = ?", (user_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def upsert_web_store(user_id: int, store_data: dict) -> dict:
    now = time.time()
    slug = (store_data.get("slug") or store_data.get("store_slug") or f"store{user_id}").lower().strip()
    name = (store_data.get("store_name") or f"Tienda {user_id}").strip()
    tagline = store_data.get("tagline") or ""
    logo = store_data.get("logo_url") or ""
    banner = store_data.get("banner_url") or ""
    p_color = store_data.get("primary_color") or "#00C26F"
    s_color = store_data.get("secondary_color") or "#3B82F6"
    bg_style = store_data.get("bg_style") or "midnight"
    theme_cfg = json.dumps(store_data["theme_config"]) if isinstance(store_data.get("theme_config"), dict) else (store_data.get("theme_config") or "{}")
    game_markups = json.dumps(store_data["game_markups"]) if isinstance(store_data.get("game_markups"), dict) else (store_data.get("game_markups") or "{}")
    payment_methods = json.dumps(store_data["payment_methods"]) if isinstance(store_data.get("payment_methods"), dict) else (store_data.get("payment_methods") or "{}")
    contact_email = store_data.get("contact_email") or ""
    email_config = json.dumps(store_data["email_config"]) if isinstance(store_data.get("email_config"), dict) else (store_data.get("email_config") or "{}")
    wa = store_data.get("whatsapp_number") or ""
    tg = store_data.get("telegram_username") or ""
    ig = store_data.get("instagram_url") or ""
    domain = (store_data.get("custom_domain") or "").lower().strip()
    markup = float(store_data.get("markup_percent") or store_data.get("profit_markup_percent") or 10.0)
    store_mode = store_data.get("store_mode") or "both"
    notif_prefs = json.dumps(store_data["notification_prefs"]) if isinstance(store_data.get("notification_prefs"), dict) else (store_data.get("notification_prefs") or '{"notify_telegram": true, "notify_email": true}')

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM reseller_web_stores WHERE user_id = ?", (user_id,)) as c:
            existing = await c.fetchone()

        if existing:
            await db.execute("""
                UPDATE reseller_web_stores SET
                    slug = ?, store_name = ?, tagline = ?, logo_url = ?, banner_url = ?,
                    primary_color = ?, secondary_color = ?, bg_style = ?, theme_config = ?,
                    game_markups = ?, payment_methods = ?, contact_email = ?, email_config = ?,
                    whatsapp_number = ?, telegram_username = ?, instagram_url = ?,
                    custom_domain = ?, markup_percent = ?, store_mode = ?, notification_prefs = ?,
                    updated_at = ?
                WHERE user_id = ?
            """, (slug, name, tagline, logo, banner, p_color, s_color, bg_style, theme_cfg,
                  game_markups, payment_methods, contact_email, email_config, wa, tg, ig,
                  domain, markup, store_mode, notif_prefs, now, user_id))
        else:
            plan = store_data.get("plan") or "basico"
            billing = store_data.get("plan_billing") or "monthly"
            expires_at = float(store_data.get("expires_at") or (now + 30 * 86400))
            await db.execute("""
                INSERT INTO reseller_web_stores (
                    user_id, slug, store_name, tagline, logo_url, banner_url,
                    primary_color, secondary_color, bg_style, theme_config,
                    game_markups, payment_methods, contact_email, email_config,
                    whatsapp_number, telegram_username, instagram_url,
                    custom_domain, markup_percent, plan, plan_billing,
                    is_active, expires_at, store_mode, notification_prefs,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
            """, (user_id, slug, name, tagline, logo, banner,
                  p_color, s_color, bg_style, theme_cfg,
                  game_markups, payment_methods, contact_email, email_config,
                  wa, tg, ig,
                  domain, markup, plan, billing,
                  expires_at, store_mode, notif_prefs,
                  now, now))
        await db.commit()

        async with db.execute("SELECT * FROM reseller_web_stores WHERE user_id = ?", (user_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def record_web_store_subscription(store_id: int, user_id: int, plan: str, billing_cycle: str = "monthly", days: int = 30, amount: float = 0.0, months: int = None, **kwargs) -> dict:
    now = time.time()
    if months is not None:
        duration_days = int(months) * 30
    else:
        duration_days = int(days or 30)
    add_seconds = duration_days * 86400

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("""
            UPDATE reseller_web_stores
            SET plan = ?,
                plan_billing = ?,
                expires_at = MAX(COALESCE(expires_at, ?), ?) + ?,
                is_active = 1,
                updated_at = ?
            WHERE id = ?
        """, (plan, billing_cycle, now, now, add_seconds, now, store_id))

        if amount > 0:
            await db.execute("""
                INSERT INTO reseller_store_invoices (store_id, user_id, plan, billing_cycle, amount, duration_days, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'paid', ?)
            """, (store_id, user_id, plan, billing_cycle, float(amount), int(duration_days), now))

        await db.commit()

        async with db.execute("SELECT * FROM reseller_web_stores WHERE id = ?", (store_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def list_all_web_stores(limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM reseller_web_stores ORDER BY created_at DESC LIMIT ?", (limit,)) as c:
            return [dict(r) for r in await c.fetchall()]

async def update_user_balance(user_id: int, amount: float, reason: str = ""):
    tx_type = "reseller_profit" if amount > 0 else "debit"
    return await add_balance(user_id=int(user_id), amount=float(amount), tx_type=tx_type, note=reason)


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: AUTH, GOOGLE & SOPORTE
# ══════════════════════════════════════════════════════════════════════════════

async def link_google(user_id: int, google_id: str, email: str = None) -> bool:
    async with aiosqlite.connect(DB) as db:
        await db.execute("UPDATE users SET google_id = ?, email = COALESCE(?, email) WHERE user_id = ?", (google_id, email, user_id))
        await db.commit()
    return True

async def create_google_user(email: str, name: str = "", google_id: str = "", photo_url: str = "", **kwargs) -> dict:
    now = time.time()
    clean_email = email.lower().strip()

    # Detectar inteligentemente si los argumentos name y google_id vinieron invertidos
    # El google_id es una cadena larga de dígitos numéricos (sub)
    val_a = str(name or "").strip()
    val_b = str(google_id or "").strip()
    if val_a.isdigit() and len(val_a) > 10 and not val_b.isdigit():
        actual_gid = val_a
        actual_name = val_b
    else:
        actual_gid = val_b if val_b.isdigit() else (val_a if val_a.isdigit() else val_b)
        actual_name = val_a if not val_a.isdigit() else val_b

    first_name = actual_name.split()[0] if actual_name else clean_email.split('@')[0]
    username = clean_email.split('@')[0]
    generated_id = int(str(uuid.uuid4().int)[:9])

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("""
            INSERT INTO users (
                user_id, username, first_name, email, google_id, photo_url,
                role, balance, created_at, last_seen
            ) VALUES (?, ?, ?, ?, ?, ?, 'user', 0.0, ?, ?)
        """, (generated_id, username, first_name, clean_email, actual_gid, photo_url, now, now))
        await db.commit()
        async with db.execute("SELECT * FROM users WHERE user_id = ?", (generated_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else {"user_id": generated_id}

async def update_google_user_profile(user_id: int, google_id: str = None, photo_url: str = None, name: str = None, **kwargs):
    now = time.time()
    actual_name = name or (google_id if (google_id and not str(google_id).isdigit()) else None)
    first_name = actual_name.split()[0] if actual_name else None
    actual_gid = str(google_id) if (google_id and str(google_id).isdigit()) else None
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            UPDATE users
            SET first_name = COALESCE(?, first_name),
                photo_url = COALESCE(?, photo_url),
                google_id = COALESCE(?, google_id),
                last_seen = ?
            WHERE user_id = ?
        """, (first_name, photo_url, actual_gid, now, user_id))
        await db.commit()

async def get_user_by_telegram_id(telegram_id: int) -> dict | None:
    if not telegram_id:
        return None
    tid = int(telegram_id)
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE telegram_id = ? OR user_id = ?", (tid, tid)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def upsert_telegram_user(telegram_id: int, first_name: str = "", username: str = None, photo_url: str = None) -> dict:
    tid = int(telegram_id)
    now = time.time()
    clean_username = username.strip().lstrip("@") if username else None
    clean_name = first_name.strip() if first_name else (clean_username or f"User{tid}")

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE telegram_id = ? OR user_id = ?", (tid, tid)) as c:
            existing = await c.fetchone()

        if existing:
            uid = existing["user_id"]
            await db.execute("""
                UPDATE users SET
                    telegram_id = ?,
                    username = COALESCE(?, username),
                    first_name = COALESCE(?, first_name),
                    photo_url = COALESCE(?, photo_url),
                    last_seen = ?
                WHERE user_id = ?
            """, (tid, clean_username, clean_name, photo_url, now, uid))
            await db.commit()
            async with db.execute("SELECT * FROM users WHERE user_id = ?", (uid,)) as c2:
                return dict(await c2.fetchone())
        else:
            await db.execute("""
                INSERT INTO users (
                    user_id, telegram_id, username, first_name, photo_url,
                    role, auth_method, balance, created_at, last_seen
                ) VALUES (?, ?, ?, ?, ?, 'user', 'telegram', 0.0, ?, ?)
            """, (tid, tid, clean_username, clean_name, photo_url, now, now))
            await db.commit()
            async with db.execute("SELECT * FROM users WHERE user_id = ?", (tid,)) as c2:
                return dict(await c2.fetchone())

async def link_telegram_to_user(user_id: int, telegram_id: int) -> bool:
    tid = int(telegram_id)
    uid = int(user_id)
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        async with db.execute("SELECT user_id FROM users WHERE telegram_id = ? AND user_id != ?", (tid, uid)) as c:
            other = await c.fetchone()
            if other:
                return False
        await db.execute("UPDATE users SET telegram_id = ?, last_seen = ? WHERE user_id = ?", (tid, now, uid))
        await db.commit()
        return True

async def init_telegram_login_tokens_table():
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS telegram_login_tokens (
                token TEXT PRIMARY KEY,
                telegram_id INTEGER,
                username TEXT,
                first_name TEXT,
                photo_url TEXT,
                status TEXT DEFAULT 'pending',
                created_at REAL,
                expires_at REAL
            )
        """)
        await db.commit()

async def create_telegram_login_token(token: str, expires_seconds: int = 600) -> bool:
    await init_telegram_login_tokens_table()
    now = time.time()
    expires_at = now + expires_seconds
    async with aiosqlite.connect(DB) as db:
        await db.execute("""
            INSERT OR REPLACE INTO telegram_login_tokens (token, status, created_at, expires_at)
            VALUES (?, 'pending', ?, ?)
        """, (token, now, expires_at))
        await db.commit()
        return True

async def approve_telegram_login_token(token: str, telegram_id: int, username: str = None, first_name: str = None, photo_url: str = None) -> bool:
    await init_telegram_login_tokens_table()
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            UPDATE telegram_login_tokens
            SET telegram_id = ?, username = ?, first_name = ?, photo_url = ?, status = 'approved'
            WHERE token = ? AND expires_at > ? AND status = 'pending'
        """, (int(telegram_id), username, first_name, photo_url, token, now))
        await db.commit()
        return cur.rowcount > 0

async def get_telegram_login_token(token: str) -> dict | None:
    await init_telegram_login_tokens_table()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM telegram_login_tokens WHERE token = ?", (token,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def get_user_by_username(username: str) -> dict | None:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        clean_user = username.lower().replace("@", "").strip()
        async with db.execute("SELECT * FROM users WHERE lower(username) = ?", (clean_user,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def transfer_balance(sender_id: int, recipient_id: int, amount: float, note: str = "") -> dict:
    amount = round(float(amount), 2)
    if amount <= 0:
        raise ValueError("El monto a transferir debe ser mayor a 0")
    if sender_id == recipient_id:
        raise ValueError("No puedes transferirte saldo a ti mismo")

    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")

        async with db.execute("SELECT balance, username, first_name FROM users WHERE user_id = ?", (sender_id,)) as c:
            sender = await c.fetchone()
            if not sender:
                await db.rollback()
                raise ValueError("Usuario remitente no encontrado")
            if float(sender["balance"]) < amount:
                await db.rollback()
                raise ValueError("Saldo insuficiente")

        async with db.execute("SELECT balance, username, first_name FROM users WHERE user_id = ?", (recipient_id,)) as c:
            recipient = await c.fetchone()
            if not recipient:
                await db.rollback()
                raise ValueError("Usuario destinatario no encontrado")

        await db.execute("UPDATE users SET balance = balance - ? WHERE user_id = ?", (amount, sender_id))
        await db.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amount, recipient_id))

        rec_name = recipient["first_name"] or recipient["username"] or f"ID {recipient_id}"
        snd_name = sender["first_name"] or sender["username"] or f"ID {sender_id}"

        await db.execute("""
            INSERT INTO balance_log (user_id, amount, type, ref_id, note)
            VALUES (?, ?, 'transfer_out', ?, ?)
        """, (sender_id, -amount, str(recipient_id), f"Transferencia enviada a {rec_name}. {note}".strip()))

        await db.execute("""
            INSERT INTO balance_log (user_id, amount, type, ref_id, note)
            VALUES (?, ?, 'transfer_in', ?, ?)
        """, (recipient_id, amount, str(sender_id), f"Transferencia recibida de {snd_name}. {note}".strip()))

        await db.commit()

    try:
        await create_notification(
            user_id=recipient_id,
            type="balance",
            title="Saldo Recibido 💰",
            message=f"Has recibido ${amount:.2f} USDT de {snd_name}.",
            url="/perfil"
        )
    except Exception:
        pass

    return {
        "ok": True,
        "transferred": amount,
        "sender_id": sender_id,
        "recipient_id": recipient_id,
        "recipient_name": rec_name
    }

async def get_or_create_user_support_room(user_id: int) -> dict:
    """Obtiene o crea una sala de chat de soporte dedicada para el usuario (incluso sin pedidos)."""
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM chat_rooms 
            WHERE customer_id = ? AND room_type = 'support' AND status = 'active'
            ORDER BY id DESC LIMIT 1
        """, (user_id,)) as c:
            row = await c.fetchone()
            if row:
                return dict(row)
                
        now = time.time()
        cursor = await db.execute("""
            INSERT INTO chat_rooms (ticket_id, customer_id, seller_id, room_type, status, last_message_at, created_at)
            VALUES (NULL, ?, NULL, 'support', 'active', ?, ?)
        """, (user_id, now, now))
        room_id = cursor.lastrowid
        
        welcome_msg = "¡Hola! Bienvenido al soporte de Francho Shop 24/7. ¿En qué podemos ayudarte hoy?"
        await db.execute("""
            INSERT INTO chat_messages (room_id, sender_id, sender_role, message_text, created_at)
            VALUES (?, 0, 'admin', ?, ?)
        """, (room_id, welcome_msg, now))
        await db.commit()
        
        async with db.execute("SELECT * FROM chat_rooms WHERE id = ?", (room_id,)) as c:
            return dict(await c.fetchone())


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: PAGINACIÓN DE PEDIDOS, MATCH & AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

async def get_user_orders_page(
    user_id: int, limit: int, before_created_at: float | None = None, before_id: int | None = None,
) -> list[dict]:
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT * FROM orders WHERE user_id=?"
        params = [user_id]
        if before_created_at is not None and before_id is not None:
            query += " AND (created_at < ? OR (created_at = ? AND id < ?))"
            params.extend([before_created_at, before_created_at, before_id])
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        params.append(limit)
        async with db.execute(query, params) as c:
            return [dict(r) for r in await c.fetchall()]

async def get_completed_orders_with_account_value(account_id: str, owner_user_id: int | None = None) -> list[dict]:
    clean_account = str(account_id or "").strip()
    if not clean_account:
        return []
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        sql = """
            SELECT o.*, p.goods_name, p.type, p.pay_price, p.cost_currency, p.platform_config, p.raw_json
            FROM orders o
            LEFT JOIN products_cache p ON p.id = o.product_id
            WHERE o.order_status = 2 AND o.recharge_config LIKE ?
        """
        params = [f"%{clean_account}%"]
        if owner_user_id:
            sql += " AND o.user_id = ?"
            params.append(owner_user_id)
        sql += " ORDER BY o.id DESC LIMIT 50"
        async with conn.execute(sql, params) as cur:
            return [dict(r) for r in await cur.fetchall()]

async def list_admin_automatic_orders(
    *, limit: int = 100, status: str = "", query: str = "", user_id: str = "", seller_id: str = "",
) -> list[dict]:
    """Pedidos automáticos de la tienda: saldo USDT, CUP y FZR, con datos del comprador."""
    safe_limit = max(1, min(int(limit or 100), 300))
    import re
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        sql = """
            SELECT o.*, u.first_name AS customer_name, u.username AS customer_username, u.email AS customer_email
            FROM orders o LEFT JOIN users u ON u.user_id=o.user_id
            WHERE NOT (o.payment_method IN ('cup_card_transfer','cup_mobile_balance') AND o.payment_status='awaiting_proof')
        """
        params: list = []
        if user_id and str(user_id).isdigit():
            sql += " AND o.user_id=?"; params.append(int(user_id))
        if seller_id and str(seller_id).isdigit():
            sql += " AND o.seller_id=?"; params.append(int(seller_id))
        if query.strip():
            like = f"%{query.strip()}%"
            sql += " AND (o.merchant_order_id LIKE ? OR o.product_name LIKE ? OR CAST(o.user_id AS TEXT) LIKE ? OR u.username LIKE ? OR u.email LIKE ?)"
            params.extend([like, like, like, like, like])
        status_map = {"completed": 2, "processing": 1, "failed": 4, "partial": 3}
        if status in status_map:
            sql += " AND o.order_status=?"; params.append(status_map[status])
        elif status == "pending":
            sql += " AND (o.order_status=0 OR (o.payment_method IN ('cup_card_transfer','cup_mobile_balance') AND o.payment_status IN ('awaiting_proof','pending_verification','verifying')))"
        sql += " ORDER BY o.created_at DESC LIMIT ?"; params.append(safe_limit)
        async with conn.execute(sql, params) as cur:
            normal = [dict(row) for row in await cur.fetchall()]
        async with conn.execute("""
            SELECT f.*, u.first_name AS customer_name, u.username AS customer_username, u.email AS customer_email
            FROM fzr_orders f LEFT JOIN users u ON u.user_id=f.user_id
            ORDER BY f.created_at DESC LIMIT ?
        """, (safe_limit,)) as cur:
            fzr = [dict(row) for row in await cur.fetchall()]

        cat_map = {}
        async with conn.execute("SELECT category_id, name, image_url FROM fzr_catalog_categories") as cur:
            for r in await cur.fetchall():
                cat_map[str(r["category_id"]).lower()] = {"name": r["name"], "image_url": r["image_url"]}

        icon_map = {}
        try:
            async with conn.execute("SELECT game_name, icon_url, display_name FROM game_icons") as cur:
                for r in await cur.fetchall():
                    disp = str(r["display_name"] or r["game_name"] or "")
                    clean = re.sub(r'[^a-zA-Z0-9]', '', disp.lower())
                    if clean:
                        icon_map[clean] = r["icon_url"]
        except Exception:
            pass

    def enrich_auto_order(row: dict, is_fzr: bool = False) -> dict:
        raw_name = str(row.get("product_name") or "").strip()
        cat_id = str(row.get("provider_category_id") or "").lower().strip()
        formatted_name = raw_name
        image_url = None

        if cat_id and cat_id in cat_map:
            cinfo = cat_map[cat_id]
            image_url = cinfo.get("image_url")
            if "·" in raw_name:
                suffix = raw_name.split("·", 1)[1].strip()
                formatted_name = f"{cinfo['name']} · {suffix}"
            elif not raw_name or raw_name.lower() == cat_id:
                formatted_name = cinfo["name"]
        elif "·" in raw_name:
            prefix, suffix = [x.strip() for x in raw_name.split("·", 1)]
            prefix_key = prefix.lower()
            if prefix_key in cat_map:
                cinfo = cat_map[prefix_key]
                image_url = cinfo.get("image_url")
                formatted_name = f"{cinfo['name']} · {suffix}"
            else:
                pretty_prefix = prefix.replace("_", " ").title()
                pretty_prefix = re.sub(r'(?i)\(?latam\)?', '(LATAM)', pretty_prefix)
                formatted_name = f"{pretty_prefix} · {suffix}"
        elif raw_name.lower() in cat_map:
            cinfo = cat_map[raw_name.lower()]
            formatted_name = cinfo["name"]
            image_url = cinfo.get("image_url")

        if not image_url:
            clean_name = re.sub(r'[^a-zA-Z0-9]', '', formatted_name.lower())
            for k, v in icon_map.items():
                if k in clean_name or clean_name.startswith(k):
                    image_url = v
                    break

        created_at = float(row.get("created_at") or 0)
        completed_at = None
        if is_fzr:
            comp_raw = row.get("completed_at") or (row.get("updated_at") if str(row.get("status") or "").lower() == "completed" else None)
            if comp_raw:
                completed_at = float(comp_raw)
        else:
            comp_raw = row.get("cup_payment_verified_at") or (row.get("updated_at") if int(row.get("order_status") or 0) == 2 else None)
            if comp_raw:
                completed_at = float(comp_raw)

        duration_seconds = None
        duration_formatted = None
        if completed_at and created_at and completed_at >= created_at:
            diff = completed_at - created_at
            duration_seconds = round(diff, 1)
            if diff < 60:
                duration_formatted = f"{int(diff)}s"
            elif diff < 3600:
                m = int(diff // 60)
                s = int(diff % 60)
                duration_formatted = f"{m}m {s}s" if s > 0 else f"{m}m"
            else:
                h = int(diff // 3600)
                m = int((diff % 3600) // 60)
                duration_formatted = f"{h}h {m}m"

        player_id = None
        raw_target = row.get("target")
        if raw_target:
            try:
                t_obj = json.loads(raw_target) if isinstance(raw_target, str) else raw_target
                if isinstance(t_obj, dict):
                    player_id = t_obj.get("player_id") or t_obj.get("userid") or t_obj.get("account_id") or t_obj.get("id")
                elif isinstance(t_obj, (str, int)):
                    player_id = str(t_obj)
            except Exception:
                player_id = str(raw_target)
        if not player_id and row.get("recharge_config"):
            try:
                r_obj = json.loads(row["recharge_config"]) if isinstance(row["recharge_config"], str) else row["recharge_config"]
                if isinstance(r_obj, dict):
                    fields = r_obj.get("fields", {})
                    player_id = fields.get("player_id") or fields.get("userid") or fields.get("id")
            except Exception:
                pass

        row["player_id"] = str(player_id) if player_id else None
        row["product_name"] = formatted_name
        row["product_name_formatted"] = formatted_name
        row["image_url"] = image_url
        row["icon_url"] = image_url
        row["created_at"] = created_at
        row["completed_at"] = completed_at
        row["duration_seconds"] = duration_seconds
        row["duration_formatted"] = duration_formatted
        return row

    items = []
    status_labels = {0: "pending", 1: "processing", 2: "completed", 3: "partial", 4: "failed"}
    seen_prov_ids = set()
    for row in normal:
        prov_id = str(row.get("provider_order_id") or "").strip()
        if prov_id:
            seen_prov_ids.add(prov_id)
        is_cup = row.get("payment_method") in {"cup_card_transfer", "cup_mobile_balance"}
        display_status = status_labels.get(int(row.get("order_status") or 0), "pending")
        if is_cup and str(row.get("payment_status") or "") in {"awaiting_proof", "pending_verification", "verifying", "rejected", "provider_failed"}:
            display_status = str(row["payment_status"])
        enriched = enrich_auto_order(row, is_fzr=False)
        items.append({**enriched, "source": "automatic", "id": row.get("merchant_order_id"), "display_status": display_status, "is_cup": is_cup})
    for row in fzr:
        prov_id = str(row.get("provider_order_id") or "").strip()
        if prov_id and prov_id in seen_prov_ids:
            continue
        display_status = str(row.get("status") or "pending").lower()
        if status and status not in {"", "pending"} and display_status != status:
            continue
        if query.strip():
            needle = query.strip().lower()
            haystack = " ".join(str(row.get(k) or "") for k in ("id", "provider_order_id", "product_name", "user_id", "customer_username", "customer_email")).lower()
            if needle not in haystack:
                continue
        if user_id and str(user_id).isdigit() and int(row.get("user_id") or 0) != int(user_id):
            continue
        if seller_id:
            continue
        enriched = enrich_auto_order(row, is_fzr=True)
        items.append({**enriched, "source": "fzr", "id": f"fzr-{row.get('id')}", "display_status": display_status, "is_cup": False})
    return sorted(items, key=lambda item: float(item.get("created_at") or 0), reverse=True)[:safe_limit]

async def search_audit(query="", actor_id=None, target_type="", category="", date_from=None, date_to=None, limit=50, offset=0):
    """Consulta paginada e inmutable del registro de auditoría."""
    groups={
      "accounts":("user.","profile.","seller.","account_seller.","reseller."),
      "orders":("manual_order.","game_account.","order."),
      "payments":("oxapay.","deposit.","seller.withdrawal"),
      "catalog":("manual_product.","product_override.","buffpin.","smm.","fzr."),
      "support":("manual_order.case","ai_chat.","email_campaign."),
      "system":("buffpin.callback","oxapay.","manual_order.auto","manual_order.digital")}
    where=["1=1"]; params=[]; clean=(query or "").strip()
    if clean:
      like=f"%{clean}%"; where.append("(a.action LIKE ? OR a.target_type LIKE ? OR a.target_id LIKE ? OR a.details LIKE ? OR CAST(a.admin_id AS TEXT) LIKE ? OR u.username LIKE ? OR u.first_name LIKE ? OR u.email LIKE ?)"); params.extend([like]*8)
    if actor_id is not None: where.append("a.admin_id=?"); params.append(int(actor_id))
    if target_type: where.append("a.target_type=?"); params.append(target_type)
    prefixes=groups.get(category)
    if prefixes: where.append("("+" OR ".join("a.action LIKE ?" for _ in prefixes)+")"); params.extend([x+"%" for x in prefixes])
    if date_from is not None: where.append("a.created_at>=?"); params.append(float(date_from))
    if date_to is not None: where.append("a.created_at<=?"); params.append(float(date_to))
    limit=max(1,min(int(limit or 50),500)); offset=max(0,int(offset or 0)); clause=" AND ".join(where)
    async with aiosqlite.connect(DB) as conn:
      conn.row_factory=aiosqlite.Row
      async with conn.execute(f"SELECT COUNT(*) FROM audit_log a LEFT JOIN users u ON u.user_id=a.admin_id WHERE {clause}",params) as c: total=int((await c.fetchone())[0] or 0)
      async with conn.execute(f"SELECT a.*,u.username actor_username,u.first_name actor_name,u.email actor_email,u.photo_url actor_photo FROM audit_log a LEFT JOIN users u ON u.user_id=a.admin_id WHERE {clause} ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?",[*params,limit,offset]) as c: items=[dict(x) for x in await c.fetchall()]
      async with conn.execute("SELECT a.admin_id,u.username,u.first_name,u.email,COUNT(*) event_count FROM audit_log a LEFT JOIN users u ON u.user_id=a.admin_id GROUP BY a.admin_id ORDER BY event_count DESC") as c: actors=[dict(x) for x in await c.fetchall()]
      async with conn.execute("SELECT COUNT(*) total,SUM(CASE WHEN created_at>=unixepoch('now','start of day') THEN 1 ELSE 0 END) today,SUM(CASE WHEN admin_id=0 THEN 1 ELSE 0 END) system_events,COUNT(DISTINCT CASE WHEN admin_id<>0 THEN admin_id END) actor_count FROM audit_log") as c: stats=dict(await c.fetchone())
      async with conn.execute("SELECT DISTINCT target_type FROM audit_log WHERE target_type IS NOT NULL AND trim(target_type)<>'' ORDER BY target_type") as c: types=[x[0] for x in await c.fetchall()]
    return {"items":items,"total":total,"limit":limit,"offset":offset,"actors":actors,"target_types":types,"stats":stats}


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: CAMPAÑAS DE CORREO (EMAIL MARKETING)
# ══════════════════════════════════════════════════════════════════════════════

def _email_audience_clause(audience: str = "all") -> tuple[str, list]:
    aud = str(audience or "all").lower()
    if aud == "users":
        return " AND role='user'", []
    elif aud == "resellers":
        return " AND role='reseller'", []
    elif aud == "sellers":
        return " AND (role='seller' OR role='account_seller')", []
    return "", []

async def count_email_campaign_recipients(audience: str = "all") -> int:
    role_sql, params = _email_audience_clause(audience)
    async with aiosqlite.connect(DB) as conn:
        sql = """
            SELECT COUNT(*) FROM users
            WHERE COALESCE(is_banned, 0)=0
              AND COALESCE(email_marketing_opt_out, 0)=0
              AND email IS NOT NULL AND trim(email)<>'' AND instr(email, '@')>1
        """ + role_sql
        async with conn.execute(sql, params) as cur:
            row = await cur.fetchone()
            return int(row[0]) if row else 0

async def create_email_campaign(admin_id: int, payload: dict) -> int:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        cur = await conn.execute("""
            INSERT INTO email_campaigns (
                admin_id, subject, title, body_text, image_url, button_text, button_url,
                audience, status, recipient_count, sent_count, failed_count, skipped_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, 0, 0, 0, ?)
        """, (
            admin_id, payload.get("subject", ""), payload.get("title", ""), payload.get("body_text", ""),
            payload.get("image_url", ""), payload.get("button_text", ""), payload.get("button_url", ""),
            payload.get("audience", "all"), now
        ))
        await conn.commit()
        return cur.lastrowid

async def list_email_campaigns(limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM email_campaigns ORDER BY id DESC LIMIT ?", (limit,)) as cur:
            return [dict(r) for r in await cur.fetchall()]

async def queue_email_campaign(campaign_id: int) -> int:
    import secrets
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM email_campaigns WHERE id=?", (campaign_id,)) as cur:
            campaign = await cur.fetchone()
        if not campaign or campaign["status"] not in ("draft", "paused"):
            raise ValueError("La campaña no está disponible para enviar")
        role_sql, params = _email_audience_clause(campaign["audience"])
        sql = """
            SELECT user_id, trim(email) AS email FROM users
            WHERE COALESCE(is_banned, 0)=0
              AND COALESCE(email_marketing_opt_out, 0)=0
              AND email IS NOT NULL AND trim(email)<>'' AND instr(email, '@')>1
        """ + role_sql
        async with conn.execute(sql, params) as cur:
            recipients = await cur.fetchall()
        if not recipients:
            raise ValueError("No hay destinatarios disponibles para esta audiencia")
        rows = [
            (campaign_id, r["user_id"], r["email"], secrets.token_urlsafe(24), "pending", 0, None, now, None)
            for r in recipients
        ]
        await conn.execute("DELETE FROM email_campaign_recipients WHERE campaign_id=? AND status='pending'", (campaign_id,))
        await conn.executemany("""
            INSERT INTO email_campaign_recipients (
                campaign_id, user_id, email, unsubscribe_token, status, attempts, last_error, created_at, sent_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)
        total = len(rows)
        await conn.execute("""
            UPDATE email_campaigns
            SET status='queued', recipient_count=?, queued_at=COALESCE(queued_at, unixepoch()), completed_at=NULL
            WHERE id=?
        """, (total, campaign_id))
        await conn.commit()
        return total

async def get_next_email_recipient() -> dict | None:
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("BEGIN IMMEDIATE")
        await conn.execute("""
            UPDATE email_campaigns AS c
            SET status=CASE WHEN NOT EXISTS (
                    SELECT 1 FROM email_campaign_recipients r
                    WHERE r.campaign_id=c.id AND r.status IN ('pending','sending')
                ) THEN 'completed' ELSE c.status END,
                completed_at=CASE WHEN NOT EXISTS (
                    SELECT 1 FROM email_campaign_recipients r
                    WHERE r.campaign_id=c.id AND r.status IN ('pending','sending')
                ) THEN unixepoch() ELSE c.completed_at END
            WHERE c.status IN ('queued','sending')
        """)
        async with conn.execute("""
            SELECT r.*, c.subject, c.title, c.body_text, c.image_url, c.button_text, c.button_url
            FROM email_campaign_recipients r
            JOIN email_campaigns c ON c.id=r.campaign_id
            JOIN users u ON u.user_id=r.user_id
            WHERE c.status IN ('queued','sending') AND r.status='pending'
              AND COALESCE(u.is_banned, 0)=0 AND COALESCE(u.email_marketing_opt_out, 0)=0
            ORDER BY c.queued_at ASC, r.id ASC LIMIT 1
        """) as cur:
            row = await cur.fetchone()
        if not row:
            await conn.commit()
            return None
        await conn.execute("UPDATE email_campaign_recipients SET status='sending', attempts=attempts+1 WHERE id=? AND status='pending'", (row["id"],))
        await conn.execute("UPDATE email_campaigns SET status='sending' WHERE id=? AND status='queued'", (row["campaign_id"],))
        await conn.commit()
        return dict(row)

async def finish_email_recipient(recipient_id: int, sent: bool, error: str = ""):
    async with aiosqlite.connect(DB) as conn:
        status = "sent" if sent else "failed"
        await conn.execute("""
            UPDATE email_campaign_recipients
            SET status=?, last_error=?, sent_at=CASE WHEN ? THEN unixepoch() ELSE sent_at END
            WHERE id=?
        """, (status, (error or "")[:500], 1 if sent else 0, recipient_id))
        await conn.commit()

async def refresh_email_campaign_stats(campaign_id: int):
    async with aiosqlite.connect(DB) as conn:
        async with conn.execute("""
            SELECT COUNT(*),
                   SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END),
                   SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END),
                   SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END),
                   SUM(CASE WHEN status IN ('pending','sending') THEN 1 ELSE 0 END)
            FROM email_campaign_recipients WHERE campaign_id=?
        """, (campaign_id,)) as cur:
            total, sent, failed, skipped, remaining = await cur.fetchone()
        async with conn.execute("SELECT status FROM email_campaigns WHERE id=?", (campaign_id,)) as cur:
            current = await cur.fetchone()
        next_status = current[0] if current else "completed"
        completed_at = None
        if not remaining and next_status not in {"paused", "canceled"}:
            next_status = "completed"
            completed_at = time.time()
        await conn.execute("""
            UPDATE email_campaigns SET recipient_count=?, sent_count=?, failed_count=?, skipped_count=?,
                status=?, completed_at=COALESCE(?, completed_at) WHERE id=?
        """, (int(total or 0), int(sent or 0), int(failed or 0), int(skipped or 0), next_status, completed_at, campaign_id))
        await conn.commit()

async def set_email_campaign_status(campaign_id: int, status: str):
    if status not in {"paused", "queued", "canceled"}:
        raise ValueError("Estado no permitido")
    async with aiosqlite.connect(DB) as conn:
        if status == "canceled":
            await conn.execute("UPDATE email_campaign_recipients SET status='skipped', last_error='Campaña cancelada' WHERE campaign_id=? AND status='pending'", (campaign_id,))
        await conn.execute("UPDATE email_campaigns SET status=? WHERE id=? AND status IN ('queued','sending','paused')", (status, campaign_id))
        await conn.commit()

async def reset_interrupted_email_recipients():
    async with aiosqlite.connect(DB) as conn:
        await conn.execute("UPDATE email_campaign_recipients SET status='pending' WHERE status='sending'")
        await conn.execute("UPDATE email_campaigns SET status='queued' WHERE status='sending'")
        await conn.commit()

async def unsubscribe_email_token(token: str) -> bool:
    async with aiosqlite.connect(DB) as conn:
        async with conn.execute("SELECT user_id FROM email_campaign_recipients WHERE unsubscribe_token=?", (token,)) as cur:
            row = await cur.fetchone()
        if not row:
            return False
        await conn.execute("UPDATE users SET email_marketing_opt_out=1 WHERE user_id=?", (row[0],))
        await conn.execute("UPDATE email_campaign_recipients SET status='skipped', last_error='Usuario canceló suscripción' WHERE user_id=? AND status='pending'", (row[0],))
        await conn.commit()
        return True


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN RESTAURADA: RANKING DE COMUNIDAD, SCORES & RELEASES
# ══════════════════════════════════════════════════════════════════════════════

async def get_seller_upcoming_releases(seller_id: int | None = None, limit: int = 15) -> list[dict]:
    now = time.time()
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q = """
            SELECT m.id, m.seller_id, m.order_id, m.movement_type, m.status,
                   m.amount, m.gross_amount, m.platform_fee, m.currency, m.note,
                   m.release_at, m.created_at,
                   COALESCE(mp.name, 'Pedido #' || m.order_id) AS product_name
            FROM seller_wallet_movements m
            LEFT JOIN manual_orders mo ON mo.id = m.order_id
            LEFT JOIN manual_products mp ON mp.id = mo.product_id
            WHERE m.status = 'held'
              AND COALESCE(m.release_at, 0) > 0
        """
        params = []
        if seller_id is not None:
            q += " AND m.seller_id = ?"
            params.append(seller_id)
        q += " ORDER BY m.release_at ASC LIMIT ?"
        params.append(limit)
        async with db.execute(q, params) as c:
            return [dict(r) for r in await c.fetchall()]

def get_cuba_period_bounds(period: str = None) -> tuple[str, float, float]:
    """Retorna (period_str, start_ts, end_ts) para un periodo 'YYYY-MM' en America/Havana."""
    from datetime import datetime, timedelta
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo("America/Havana")
    except Exception:
        tz = None

    if tz:
        now_cuba = datetime.now(tz)
    else:
        now_cuba = datetime.utcnow()

    if not period or not isinstance(period, str) or "-" not in period:
        period = now_cuba.strftime("%Y-%m")

    try:
        parts = period.split("-")
        year = int(parts[0])
        month = int(parts[1])
        if tz:
            start_dt = datetime(year, month, 1, 0, 0, 0, tzinfo=tz)
            if month == 12:
                next_month_dt = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=tz)
            else:
                next_month_dt = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=tz)
        else:
            start_dt = datetime(year, month, 1, 0, 0, 0)
            if month == 12:
                next_month_dt = datetime(year + 1, 1, 1, 0, 0, 0)
            else:
                next_month_dt = datetime(year, month + 1, 1, 0, 0, 0)
        end_dt = next_month_dt - timedelta(seconds=1)
        return period, start_dt.timestamp(), end_dt.timestamp()
    except Exception:
        now_ts = time.time()
        return period, now_ts - 2592000, now_ts

async def compute_seller_monthly_score(seller_id: int, period: str = None) -> dict:
    """Calcula y audita el puntaje mensual de un vendedor en base a SLA, reseñas, disputas y cancelaciones."""
    if not seller_id:
        return {}
    period, start_ts, end_ts = get_cuba_period_bounds(period)
    now = time.time()

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row

        # 1. Órdenes manuales del vendedor en este periodo
        q_orders = """
            SELECT mo.*, mp.name as product_name
            FROM manual_orders mo
            JOIN manual_products mp ON mp.id = mo.product_id
            WHERE COALESCE(mo.seller_id, mp.created_by) = ?
              AND (
                  (mo.completed_at IS NOT NULL AND mo.completed_at >= ? AND mo.completed_at <= ?)
                  OR (mo.completed_at IS NULL AND mo.created_at >= ? AND mo.created_at <= ?)
              )
        """
        async with db.execute(q_orders, (seller_id, start_ts, end_ts, start_ts, end_ts)) as cur:
            orders = [dict(r) for r in await cur.fetchall()]

        # 2. Reseñas / Valoraciones de clientes recibidas en este periodo
        q_reviews = """
            SELECT r.*
            FROM order_reviews r
            JOIN manual_orders mo ON mo.id = r.order_id AND r.order_type = 'manual'
            JOIN manual_products mp ON mp.id = mo.product_id
            WHERE COALESCE(mo.seller_id, mp.created_by) = ?
              AND r.created_at >= ? AND r.created_at <= ?
        """
        async with db.execute(q_reviews, (seller_id, start_ts, end_ts)) as cur:
            reviews = [dict(r) for r in await cur.fetchall()]

        # 3. Casos / Disputas abiertas en este periodo
        q_cases = """
            SELECT c.*
            FROM manual_order_cases c
            JOIN manual_orders mo ON mo.id = c.order_id
            JOIN manual_products mp ON mp.id = mo.product_id
            WHERE COALESCE(mo.seller_id, mp.created_by, c.seller_id) = ?
              AND c.created_at >= ? AND c.created_at <= ?
        """
        async with db.execute(q_cases, (seller_id, start_ts, end_ts)) as cur:
            cases = [dict(r) for r in await cur.fetchall()]

        points_earned = 0
        points_penalized = 0
        on_time_count = 0
        delayed_count = 0
        fast_delivery_count = 0
        refunds_count = 0
        disputes_count = len(cases)
        events = []

        # Procesar órdenes
        for o in orders:
            oid = o.get("id")
            p_name = o.get("product_name") or f"Pedido #{oid}"
            st = o.get("status")
            sla_st = o.get("sla_status")
            promised = int(o.get("sla_promised_seconds") or 0)
            actual = int(o.get("sla_actual_seconds") or 0)
            delay = int(o.get("sla_delay_seconds") or 0)

            if st == "completed":
                if sla_st == "on_time" or (promised > 0 and actual > 0 and actual <= promised):
                    on_time_count += 1
                    points_earned += 10
                    events.append({
                        "order_id": oid,
                        "event_type": "on_time_delivery",
                        "points": 10,
                        "description": f"Entrega a tiempo en {p_name} (#{oid})",
                        "created_at": o.get("completed_at") or now
                    })
                    if promised > 0 and actual > 0 and actual <= (promised * 0.5):
                        fast_delivery_count += 1
                        points_earned += 5
                        events.append({
                            "order_id": oid,
                            "event_type": "fast_delivery_bonus",
                            "points": 5,
                            "description": f"Bono de entrega rápida en {p_name} (#{oid})",
                            "created_at": o.get("completed_at") or now
                        })
                elif sla_st == "delayed" or (promised > 0 and actual > promised):
                    delayed_count += 1
                    pen = 10
                    if delay > 3600:
                        pen = 20
                    points_penalized += pen
                    events.append({
                        "order_id": oid,
                        "event_type": "delayed_delivery",
                        "points": -pen,
                        "description": f"Retraso de entrega en {p_name} (#{oid})",
                        "created_at": o.get("completed_at") or now
                    })
            elif st in ("cancelled", "canceled", "refunded"):
                refunds_count += 1
                points_penalized += 15
                events.append({
                    "order_id": oid,
                    "event_type": "order_refunded",
                    "points": -15,
                    "description": f"Cancelación o reembolso en {p_name} (#{oid})",
                    "created_at": o.get("updated_at") or now
                })

        # Procesar reseñas
        reviews_5_count = 0
        reviews_4_count = 0
        for r in reviews:
            oid = r.get("order_id")
            score = int(r.get("rating") or 5)
            if score == 5:
                reviews_5_count += 1
                points_earned += 5
                events.append({
                    "order_id": oid,
                    "event_type": "review_5_star",
                    "points": 5,
                    "description": f"Calificación de 5 estrellas en #{oid}",
                    "created_at": r.get("created_at") or now
                })
            elif score == 4:
                reviews_4_count += 1
                points_earned += 2
                events.append({
                    "order_id": oid,
                    "event_type": "review_4_star",
                    "points": 2,
                    "description": f"Calificación de 4 estrellas en #{oid}",
                    "created_at": r.get("created_at") or now
                })
            elif score in (1, 2):
                pen = 15 if score == 1 else 10
                points_penalized += pen
                events.append({
                    "order_id": oid,
                    "event_type": f"review_{score}_star",
                    "points": -pen,
                    "description": f"Calificación baja de {score} estrella(s) en #{oid}",
                    "created_at": r.get("created_at") or now
                })

        # Procesar disputas
        for c in cases:
            points_penalized += 10
            events.append({
                "order_id": c.get("order_id"),
                "event_type": "dispute_opened",
                "points": -10,
                "description": f"Disputa o caso abierto #{c.get('id')} en orden #{c.get('order_id')}",
                "created_at": c.get("created_at") or now
            })

        net_score = max(0, min(100, 100 + points_earned - points_penalized))

        await db.execute("""
            INSERT INTO seller_monthly_scores (
                seller_id, period, score, points_earned, points_penalized,
                on_time_orders_count, delayed_orders_count, fast_delivery_count,
                reviews_5_count, reviews_4_count, refunds_count, disputes_count,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(seller_id, period) DO UPDATE SET
                score = excluded.score,
                points_earned = excluded.points_earned,
                points_penalized = excluded.points_penalized,
                on_time_orders_count = excluded.on_time_orders_count,
                delayed_orders_count = excluded.delayed_orders_count,
                fast_delivery_count = excluded.fast_delivery_count,
                reviews_5_count = excluded.reviews_5_count,
                reviews_4_count = excluded.reviews_4_count,
                refunds_count = excluded.refunds_count,
                disputes_count = excluded.disputes_count,
                updated_at = excluded.updated_at
        """, (
            seller_id, period, net_score, points_earned, points_penalized,
            on_time_count, delayed_count, fast_delivery_count,
            reviews_5_count, reviews_4_count, refunds_count, disputes_count,
            now
        ))

        await db.execute("DELETE FROM seller_score_events WHERE seller_id=? AND period=?", (seller_id, period))
        if events:
            rows_ev = [
                (seller_id, period, ev.get("order_id"), ev["event_type"], ev["points"], ev["description"], ev["created_at"])
                for ev in events
            ]
            await db.executemany("""
                INSERT INTO seller_score_events (seller_id, period, order_id, event_type, points, description, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, rows_ev)

        await db.commit()

        return {
            "seller_id": seller_id,
            "period": period,
            "score": net_score,
            "points_earned": points_earned,
            "points_penalized": points_penalized,
            "on_time_orders_count": on_time_count,
            "delayed_orders_count": delayed_count,
            "fast_delivery_count": fast_delivery_count,
            "reviews_5_count": reviews_5_count,
            "reviews_4_count": reviews_4_count,
            "refunds_count": refunds_count,
            "disputes_count": disputes_count,
            "events_count": len(events)
        }

async def get_community_ranking(period: str = None) -> dict:
    """Calcula y devuelve el ranking mensual completo de todas las tiendas de la comunidad."""
    period, start_ts, end_ts = get_cuba_period_bounds(period)
    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT user_id FROM account_seller_profiles WHERE status='active'") as cur:
            active_sellers = [r["user_id"] for r in await cur.fetchall()]

    for sid in active_sellers:
        try:
            await compute_seller_monthly_score(sid, period)
        except Exception as e:
            log.warning("Error computing score for seller %s: %s", sid, e)

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        q_scores = """
            SELECT sms.*, asp.store_name, asp.store_slug, asp.store_image, asp.banner_image,
                   asp.rating as profile_rating, asp.total_orders as lifetime_orders,
                   asp.schedule_enabled, asp.schedule_days, asp.schedule_time_start,
                   asp.schedule_time_end, asp.schedule_timezone
            FROM seller_monthly_scores sms
            JOIN account_seller_profiles asp ON asp.user_id = sms.seller_id
            WHERE sms.period = ? AND asp.status = 'active'
            ORDER BY sms.score DESC, sms.on_time_orders_count DESC, sms.points_earned DESC, asp.total_orders DESC
        """
        async with db.execute(q_scores, (period,)) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

        leaderboard = []
        for idx, row in enumerate(rows, start=1):
            sid = row["seller_id"]
            await db.execute("UPDATE seller_monthly_scores SET rank_position=? WHERE seller_id=? AND period=?", (idx, sid, period))
            row["rank_position"] = idx

            if idx == 1:
                badge = {"type": "top1", "label": "Top 1 del Mes", "icon": "🥇", "medal": "gold", "border_class": "border-yellow-400/40 text-yellow-300 bg-yellow-400/10"}
            elif idx == 2:
                badge = {"type": "top2", "label": "Top 2 del Mes", "icon": "🥈", "medal": "silver", "border_class": "border-slate-300/40 text-slate-200 bg-slate-300/10"}
            elif idx == 3:
                badge = {"type": "top3", "label": "Top 3 del Mes", "icon": "🥉", "medal": "bronze", "border_class": "border-amber-600/40 text-amber-500 bg-amber-600/10"}
            else:
                badge = {"type": "rank", "label": f"Top #{idx}", "icon": "⭐", "medal": "standard", "border_class": "border-white/10 text-white/70 bg-white/5"}

            tot_eval = (row.get("on_time_orders_count") or 0) + (row.get("delayed_orders_count") or 0)
            on_time_rate = round(((row.get("on_time_orders_count") or 0) / tot_eval * 100), 1) if tot_eval > 0 else 100.0

            row["badge"] = badge
            row["on_time_rate"] = on_time_rate
            row["total_eval_orders"] = tot_eval
            leaderboard.append(row)

        await db.commit()

    return {
        "period": period,
        "total_sellers": len(leaderboard),
        "ranking": leaderboard
    }

async def get_seller_score_breakdown(seller_id: int, period: str = None) -> dict:
    """Devuelve el desglose detallado y auditable de puntos ganados y penalizados para un vendedor."""
    if not seller_id:
        return {}
    period, start_ts, end_ts = get_cuba_period_bounds(period)
    ranking_data = await get_community_ranking(period)
    seller_rank = next((s for s in ranking_data.get("ranking", []) if s["seller_id"] == seller_id), None)

    async with aiosqlite.connect(DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM seller_score_events
            WHERE seller_id=? AND period=?
            ORDER BY created_at DESC LIMIT 100
        """, (seller_id, period)) as cur:
            events = [dict(r) for r in await cur.fetchall()]

    return {
        "seller_id": seller_id,
        "period": period,
        "summary": seller_rank or {
            "score": 100,
            "rank_position": ranking_data.get("total_sellers", 1) or 1,
            "badge": {"type": "rank", "label": "Top Vendedor", "icon": "⭐", "medal": "standard", "border_class": "border-white/10 text-white/70 bg-white/5"},
            "points_earned": 0,
            "points_penalized": 0,
            "on_time_orders_count": 0,
            "delayed_orders_count": 0,
            "fast_delivery_count": 0,
            "reviews_5_count": 0,
            "reviews_4_count": 0,
            "refunds_count": 0,
            "disputes_count": 0,
        },
        "total_sellers": ranking_data.get("total_sellers", 1),
        "events": events
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SECCIÓN AUTOMATIZACIÓN TRANSFERMÓVIL & SALDO MÓVIL CUP
# ══════════════════════════════════════════════════════════════════════════════

async def record_cuba_bank_receipt(
    tx_id: str, provider: str, sender: str, amount_cup: float,
    destination_card: str = None, sender_phone: str = None,
    sms_date_epoch: int = None, sms_date_formatted: str = None,
    raw_body: str = '', auto_burn: bool = False, note: str = ''
) -> dict:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        used_val = 1 if auto_burn else 0
        used_at = now if auto_burn else None
        await conn.execute("""
            INSERT INTO cuba_bank_receipts 
            (transaction_id, provider, sender, amount_cup, destination_card, sender_phone, sms_date_epoch, sms_date_formatted, raw_body, used, used_at, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(transaction_id) DO UPDATE SET
                destination_card = COALESCE(destination_card, excluded.destination_card),
                sender_phone = COALESCE(sender_phone, excluded.sender_phone),
                sms_date_epoch = COALESCE(sms_date_epoch, excluded.sms_date_epoch)
        """, (
            tx_id.strip(), provider, sender, amount_cup, destination_card,
            sender_phone, sms_date_epoch, sms_date_formatted, raw_body,
            used_val, used_at, note, now
        ))
        await conn.commit()
        async with conn.execute('SELECT * FROM cuba_bank_receipts WHERE transaction_id = ?', (tx_id.strip(),)) as c:
            row = await c.fetchone()
            return dict(row) if row else {}

async def get_cuba_receipt_by_tx(tx_id: str) -> dict | None:
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        clean_tx = tx_id.strip().upper().replace('#', '')
        async with conn.execute("SELECT * FROM cuba_bank_receipts WHERE UPPER(TRIM(REPLACE(transaction_id, '#', ''))) = ?", (clean_tx,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

async def mark_cuba_receipt_used(tx_id: str, order_id: str, note: str = '') -> bool:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        cur = await conn.execute("""
            UPDATE cuba_bank_receipts
            SET used = 1, order_id = ?, used_at = ?, note = ?
            WHERE transaction_id = ? AND used = 0
        """, (order_id, now, note, tx_id.strip()))
        await conn.commit()
        return cur.rowcount > 0

async def find_unused_cuba_receipt_by_phone(phone: str, amount_cup: float) -> dict | None:
    clean_phone = re.sub(r'\D', '', str(phone))
    if len(clean_phone) >= 8:
        short_phone = clean_phone[-8:]
        async with aiosqlite.connect(DB) as conn:
            conn.row_factory = aiosqlite.Row
            query = """
                SELECT * FROM cuba_bank_receipts
                WHERE provider = 'saldomovil'
                  AND used = 0
                  AND sender_phone LIKE ?
                  AND amount_cup >= ? - 1.0 AND amount_cup <= ? + 1.0
                ORDER BY created_at DESC LIMIT 1
            """
            async with conn.execute(query, (f'%{short_phone}%', amount_cup, amount_cup)) as c:
                row = await c.fetchone()
                return dict(row) if row else None
    return None

async def find_matching_pending_order_for_receipt(tx_id: str, amount_cup: float, provider: str = 'transfermovil', sender_phone: str = None) -> dict | None:
    async with aiosqlite.connect(DB) as conn:
        conn.row_factory = aiosqlite.Row
        clean_tx = tx_id.strip().upper().replace('#', '')
        if clean_tx:
            query = """
                SELECT * FROM orders
                WHERE UPPER(TRIM(REPLACE(COALESCE(cup_payment_reference, ''), '#', ''))) = ?
                  AND payment_status IN ('awaiting_network_confirmation', 'awaiting_proof', 'pending_verification')
                  AND payment_method IN ('cup_card_transfer', 'cup_mobile_balance')
                ORDER BY created_at DESC LIMIT 1
            """
            async with conn.execute(query, (clean_tx,)) as c:
                row = await c.fetchone()
                if row:
                    return dict(row)

        if sender_phone:
            clean_phone = re.sub(r'\D', '', str(sender_phone))
            if len(clean_phone) >= 8:
                short_phone = clean_phone[-8:]
                query_phone = """
                    SELECT * FROM orders
                    WHERE cup_payment_reference LIKE ?
                      AND payment_status IN ('awaiting_network_confirmation', 'awaiting_proof', 'pending_verification')
                      AND payment_method = 'cup_mobile_balance'
                      AND cup_amount_snapshot >= ? - 1.0 AND cup_amount_snapshot <= ? + 1.0
                    ORDER BY created_at DESC LIMIT 1
                """
                async with conn.execute(query_phone, (f'%{short_phone}%', amount_cup, amount_cup)) as c:
                    row_phone = await c.fetchone()
                    if row_phone:
                        return dict(row_phone)

        # Fallback para Saldo Móvil: si el cliente no especificó su número en la referencia,
        # emparejar con el pedido pendiente de saldo móvil con el mismo monto en las últimas 24h
        if provider == 'saldomovil':
            query_amt = """
                SELECT * FROM orders
                WHERE payment_status IN ('awaiting_network_confirmation', 'awaiting_proof', 'pending_verification')
                  AND payment_method = 'cup_mobile_balance'
                  AND cup_amount_snapshot >= ? - 1.0 AND cup_amount_snapshot <= ? + 1.0
                  AND created_at >= ?
                ORDER BY created_at DESC LIMIT 1
            """
            recent_threshold = time.time() - (24 * 3600)
            async with conn.execute(query_amt, (amount_cup, amount_cup, recent_threshold)) as c:
                row_amt = await c.fetchone()
                if row_amt:
                    return dict(row_amt)

        return None

async def register_order_pending_tx(merchant_order_id: str, user_id: int, tx_id: str) -> bool:
    now = time.time()
    async with aiosqlite.connect(DB) as conn:
        cur = await conn.execute("""
            UPDATE orders
            SET cup_payment_reference = ?, payment_status = 'awaiting_network_confirmation', updated_at = ?
            WHERE merchant_order_id = ? AND user_id = ?
              AND payment_method IN ('cup_card_transfer', 'cup_mobile_balance')
              AND payment_status IN ('awaiting_proof', 'awaiting_network_confirmation', 'pending_verification')
        """, (tx_id.strip(), now, merchant_order_id, user_id))
        await conn.commit()
        return cur.rowcount > 0

async def has_used_vpn_free_trial(user_id: int) -> bool:
    """Verifica si el usuario ya consumió una prueba gratis de VPN (producto 33 o 34)."""
    async with aiosqlite.connect(DB) as db:
        cur = await db.execute("""
            SELECT id FROM manual_orders
            WHERE user_id = ? AND product_id IN (33, 34) AND price = 0
              AND status != 'cancelled'
            LIMIT 1
        """, (user_id,))
        row = await cur.fetchone()
        return bool(row)
