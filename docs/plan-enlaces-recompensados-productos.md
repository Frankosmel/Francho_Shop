# Plan: enlaces recompensados por producto

Objetivo: permitir que admin y vendedores configuren recompensas por compartir productos. No se paga por copiar ni por click; solo se crea y paga una comision cuando una compra real queda completada.

## Estado actual relevante

- Ya existe un referido global simple en `database.py` (`referrals`, `apply_referral`, `get_referral_stats`) y endpoint `/api/referrals/apply`.
- Ese sistema no sirve para recompensas por producto porque no guarda producto, pedido, campana, pagador ni estado de comision.
- Las compras manuales se crean en `webapp/api/main.py` cerca de `admin_buy_manual_product`.
- Los pedidos manuales se completan con `database.complete_manual_order(...)` y endpoints admin de completar/cancelar/reembolsar.
- El balance se mueve con `database.add_balance(...)` y queda auditado en `balance_log`.

No reemplazar el referido global viejo en fase 1. Implementar el nuevo sistema como modulo independiente.

## Reglas de negocio

- No pagar por click.
- No pagar por copiar enlace.
- Solo pagar cuando el pedido quede `completed`.
- Si el pedido queda `canceled`, `refunded` o falla por falta de stock, cancelar la comision.
- No permitir auto-referido: `referrer_user_id != buyer_user_id`.
- Un `order_id` solo puede generar una comision.
- La comision nace en `pending`.
- La comision se paga una sola vez y genera movimiento de saldo `referral_reward`.
- Registrar auditoria en cambios de campana, creacion, pago, cancelacion y reversion.

## Tablas nuevas

Agregar en `database.init_db()` o donde se crean tablas del sistema:

```sql
CREATE TABLE IF NOT EXISTS referral_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  seller_id INTEGER,
  reward_amount_usdt REAL NOT NULL DEFAULT 0,
  payer_type TEXT NOT NULL DEFAULT 'platform',
  status TEXT NOT NULL DEFAULT 'disabled',
  min_order_amount_usdt REAL DEFAULT 0,
  created_at REAL DEFAULT (strftime('%s','now')),
  updated_at REAL DEFAULT (strftime('%s','now')),
  UNIQUE(product_id)
);

CREATE TABLE IF NOT EXISTS referral_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  created_at REAL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS referral_attributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_code TEXT NOT NULL,
  referrer_user_id INTEGER NOT NULL,
  visitor_user_id INTEGER,
  product_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  clicked_at REAL DEFAULT (strftime('%s','now')),
  expires_at REAL,
  ip_hash TEXT,
  user_agent_hash TEXT
);

CREATE TABLE IF NOT EXISTS referral_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE,
  product_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  referrer_user_id INTEGER NOT NULL,
  buyer_user_id INTEGER NOT NULL,
  seller_id INTEGER,
  reward_amount_usdt REAL NOT NULL,
  payer_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at REAL DEFAULT (strftime('%s','now')),
  approved_at REAL,
  paid_at REAL,
  canceled_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_referral_campaigns_product ON referral_campaigns(product_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_user_product ON referral_links(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_referral_attr_code ON referral_attributions(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_comm_referrer ON referral_commissions(referrer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_comm_seller ON referral_commissions(seller_id, status);
```

## Backend: funciones recomendadas en `database.py`

Crear helpers:

- `get_active_referral_campaign(product_id)`
- `upsert_referral_campaign(product_id, seller_id, reward_amount, payer_type, status, min_order_amount)`
- `get_or_create_referral_link(user_id, product_id, campaign_id)`
- `create_referral_attribution(referral_code, visitor_user_id, request_meta)`
- `resolve_referral_for_order(product_id, buyer_user_id, referral_code)`
- `create_pending_referral_commission(order_id, product_id, campaign_id, referrer_user_id, buyer_user_id, seller_id, reward_amount, payer_type)`
- `pay_referral_commission(order_id)`
- `cancel_referral_commission(order_id, reason)`
- `reverse_referral_commission(commission_id, reason)`
- `list_referral_commissions(...)`
- `get_user_referral_dashboard(user_id)`
- `get_seller_referral_dashboard(seller_id)`

`pay_referral_commission(order_id)` debe:

1. Buscar comision `pending` o `approved`.
2. Validar que no este pagada.
3. Si `payer_type = seller`, validar que el vendedor puede cubrir el monto segun el balance/ganancia disponible que se decida usar.
4. Llamar `add_balance(referrer_user_id, reward_amount, "referral_reward", str(order_id), "Recompensa por compartir producto")`.
5. Actualizar comision a `paid`, poner `approved_at` y `paid_at`.
6. Auditar.

## Backend: endpoints publicos/usuario

Agregar endpoints:

- `POST /api/referral/product-link`
  - Body: `{ product_id }`
  - Requiere login.
  - Verifica campana activa.
  - Genera o devuelve enlace:
    `https://dominio/?product=ID&ref=CODIGO`

- `POST /api/referral/track`
  - Body: `{ ref, product_id }`
  - Guarda atribucion.
  - Si el visitante esta logueado, guardar `visitor_user_id`.
  - Si es auto-referido, no crear atribucion valida.

- `GET /api/referral/my-earnings`
  - Devuelve enlaces, productos, clicks/atribuciones, compras generadas, pendientes, pagadas y total ganado.

## Backend: integracion al flujo de compra

En compras de productos manuales:

1. Aceptar `referral_code` opcional en el request de compra.
2. Sanitizarlo: solo letras, numeros, `_`, `-`, max 64 caracteres.
3. Al crear el pedido, resolver si el `referral_code` aplica al `product_id`.
4. Evitar auto-referido.
5. Crear comision `pending` ligada al `order_id`.

En completado de pedido:

- Despues de `complete_manual_order(...)`, llamar `pay_referral_commission(order_id)`.
- Aplica en:
  - entrega manual normal,
  - entrega con archivo,
  - entrega automatica por stock digital,
  - cualquier otro camino que marque `completed`.

En cancelacion/reembolso/fallo:

- Llamar `cancel_referral_commission(order_id, reason)`.
- Aplica en:
  - refund manual,
  - cancel manual,
  - sin stock digital,
  - errores que devuelvan saldo.

## Admin

Configuracion global en settings:

- `referral_product_rewards_enabled`: `0/1`
- `referral_default_reward_usdt`: ejemplo `0.25`
- `referral_attribution_ttl_days`: ejemplo `7`

Panel admin:

- Ver campanas por producto.
- Crear/editar recompensa de producto.
- Activar/pausar/desactivar.
- Ver comisiones `pending`, `paid`, `canceled`, `reversed`.
- Filtros por producto, vendedor, comprador, usuario que comparte, estado.
- Revertir/cancelar comision con razon.
- Ver gasto total de plataforma en promociones.

Endpoints admin sugeridos:

- `GET /api/admin/referral-campaigns`
- `POST /api/admin/referral-campaigns`
- `PUT /api/admin/referral-campaigns/{id}`
- `GET /api/admin/referral-commissions`
- `POST /api/admin/referral-commissions/{id}/cancel`
- `POST /api/admin/referral-commissions/{id}/reverse`

## Vendedor

Panel vendedor:

- Solo listar sus productos.
- Activar recompensa por producto propio.
- Configurar monto.
- Ver comisiones pendientes/pagadas.
- Ver gasto total en promociones.
- No puede editar campanas de productos ajenos.
- Si no tiene saldo/ganancia disponible suficiente, impedir activar o pausar automaticamente.

Endpoints vendedor sugeridos:

- `GET /api/seller/referral-campaigns`
- `POST /api/seller/referral-campaigns`
- `PUT /api/seller/referral-campaigns/{id}`
- `GET /api/seller/referral-commissions`

## Frontend usuario

En detalle de producto con campana activa:

- Boton: `Compartir y ganar`
- Texto: `Comparte este producto. Si alguien compra desde tu enlace, ganas una recompensa cuando el pedido sea completado.`
- Al tocar:
  - pedir/generar link por API,
  - copiar al portapapeles,
  - mostrar recompensa.

Crear seccion en perfil:

`Mis ganancias por compartir`

Mostrar:

- enlaces compartidos,
- producto,
- recompensa,
- compras generadas,
- comisiones pendientes,
- comisiones pagadas,
- saldo ganado.

## Frontend tracking

En `App.jsx` o cliente principal:

- Leer `ref` y `product` del query string.
- Guardar temporalmente en `localStorage` por producto.
- Llamar `/api/referral/track` si hay `ref` y `product`.
- Cuando se compra ese producto, enviar `referral_code` en el request.

No bloquear compra si falla tracking.

## Fases

### Fase 1

- Crear tablas.
- Crear endpoints basicos de campana/link/tracking.
- Generar enlaces con `?product=ID&ref=CODIGO`.
- En compra, crear comision `pending`.

### Fase 2

- Pagar al completar pedido.
- Cancelar al reembolsar/cancelar.
- Integrar `balance_log` con `type = referral_reward`.
- Evitar auto-referido y duplicados por `order_id`.

### Fase 3

- Panel admin.
- Panel vendedor.
- Validaciones de saldo/ganancia para vendedor.

### Fase 4

- Vista usuario `Mis ganancias por compartir`.
- Boton `Compartir y ganar` en productos.
- Mejorar reportes y filtros.

## Criterios de aceptacion

- Copiar link no genera saldo.
- Click no genera saldo.
- Compra pendiente crea comision pendiente.
- Pedido completado paga exactamente una vez.
- Pedido cancelado/reembolsado no paga.
- Auto-compra con el propio link no paga.
- Reintentar completar el mismo pedido no duplica comision.
- Admin ve auditoria y puede cancelar/revertir.
- Vendedor solo gestiona campanas de sus productos.
- Productos sin campana activa no muestran `Compartir y ganar`.

