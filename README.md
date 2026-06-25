# 🎮 GameStore Bot — Edición CEO

Bot de Telegram completo para venta de recargas de juegos con:
- ✅ **Sistema dual de precios** (retail vs revendedor)
- ✅ **Pagos con OxaPay USDT**
- ✅ **Sistema de roles** (user / reseller / admin)
- ✅ **Solicitudes de revendedor** con aprobación manual
- ✅ **Panel admin completo** con configuración en caliente
- ✅ **Audit log + notificaciones** a admins en cada evento
- ✅ **Modo mantenimiento**
- ✅ **Broadcast segmentado**
- ✅ **Anti-abuso** (rate limiting)
- ✅ **Alerta automática** de saldo BuffPin bajo

## 📂 Estructura

```
gamestore/
├── bot.py                 # Bot principal (2,492 líneas, monolítico)
├── config.py              # Bootstrap config
├── database.py            # SQLite schema + CRUD
├── buffpin_client.py      # Cliente API BuffPin
├── oxapay_client.py       # Cliente API OxaPay
├── modules/
│   ├── __init__.py
│   ├── settings.py        # Settings dinámicos (hot reload)
│   └── pricing.py         # Sistema dual de precios
├── requirements.txt
├── .env.example
├── run.sh
└── gamestore.service
```

## 🚀 Instalación

```bash
# 1. Subir archivos
cd /root
mkdir gamestore && cd gamestore
# copia todos los archivos aquí

# 2. Instalar dependencias
pip3 install -r requirements.txt --break-system-packages

# 3. Configurar
cp .env.example .env
nano .env
# Llena: BOT_TOKEN, ADMIN_IDS, BUFFPIN_*, OXAPAY_MERCHANT_KEY, WEBHOOK_HOST

# 4. Probar
python3 bot.py

# 5. Instalar como servicio
cp gamestore.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable gamestore
systemctl start gamestore
journalctl -u gamestore -f
```

## 💰 Sistema dual de precios

Cada usuario tiene un **rol** que determina qué precio ve:

| Rol | Markup por defecto | Cómo se asigna |
|-----|-------------------|----------------|
| 🛒 `user` (cliente) | **+20%** (retail) | Rol inicial automático |
| 💼 `reseller` | **+8%** (descuento) | Admin aprueba solicitud |
| 👑 `admin` | Ve precio retail | En `ADMIN_IDS` del `.env` |

**Ejemplo real:**
```
Costo BuffPin: $1.00

Ve el usuario normal: $1.20  (+20%)
Ve el revendedor:     $1.08  (+8%)

Tu ganancia: ~$0.20 con retail, ~$0.08 con reseller
```

Los dos markups se configuran desde `/admin → ⚙️ Config`, **en caliente sin reiniciar**. Los valores se guardan en la tabla `settings` con caché de 60s.

## 🔄 Flujo del revendedor

```
1. Usuario normal usa el bot unos días
2. /become_reseller o botón en menú
3. Bot le pide descripción de su negocio (min 50 chars)
4. Admin recibe notificación con botones ✅/❌
5. Admin aprueba o rechaza con razón
6. Usuario es notificado automáticamente
7. Si aprobado → su rol cambia a 'reseller'
8. A partir de ahora ve precios con descuento
9. Recarga saldo con OxaPay normalmente
10. Compra productos (con el precio especial)
```

## 👑 Panel de administración

Accede con `/admin` (si estás en `ADMIN_IDS`).

### 📊 Dashboard
- Ingresos por periodo (hoy / 7d / 30d / total)
- Ganancia (profit) por periodo
- Desglose por tipo de cliente (retail vs reseller)
- Top 5 productos más vendidos

### ⚙️ Configuración (en caliente)
- Retail markup %
- Reseller markup %
- Mínimo depósito / retiro
- Mensaje de bienvenida
- Handle de soporte
- Toggle modo mantenimiento
- Toggle solicitudes de revendedor abiertas/cerradas

### 👥 Usuarios
- Buscar por ID / username / nombre
- Ver detalles (saldo, órdenes, historial)
- Ajustar saldo manualmente (con motivo)
- Promover a revendedor / quitar rol
- Banear / desbanear con motivo

### 💼 Solicitudes de revendedor
- Lista de pendientes
- Ver descripción + stats del usuario (depósitos, gastos)
- Aprobar (automáticamente promueve)
- Rechazar con motivo (notifica al usuario)

### 🛒 Productos
- Total / visibles / ocultos
- Refrescar catálogo desde BuffPin
- Buscar producto
- Para cada producto: ocultar, destacar, precio custom

### 📦 Órdenes
- Últimas 15 órdenes con badge de rol
- Vista completa con estado y PINs

### 💰 Depósitos
- Últimos 15 depósitos OxaPay con estado

### 📢 Broadcast
- Segmentado: todos / solo clientes / solo revendedores
- Soporta HTML
- Reporte de enviados/fallidos
- Rate limit automático (20 msg/s)

### 📋 Audit log
- Todas las acciones admin quedan registradas
- Quién, cuándo, qué, detalles

## 🔔 Notificaciones automáticas a admins

Los admins reciben DM automáticamente para:
- 💰 Cada nuevo depósito (con username, monto, nuevo balance)
- 🛒 Cada nueva compra (con badge de tipo de cliente y profit)
- 💼 Cada nueva solicitud de revendedor (con botones de aprobar/rechazar)
- ⚠️ Alerta de saldo BuffPin bajo (cada 1h máximo, umbral configurable)

## 🛡 Seguridad y control

- **Rate limiting**: máximo 20 compras por hora por usuario (configurable)
- **Modo mantenimiento**: pausa todas las ventas con mensaje custom
- **Ban system**: usuarios baneados no pueden usar el bot
- **Verificación HMAC**: webhooks de OxaPay verificados con SHA512
- **Verificación firma**: webhooks de BuffPin verificados con MD5
- **Auto-refund**: si una orden falla, el saldo se devuelve automáticamente
- **Audit log**: toda acción admin queda registrada

## 📋 Comandos

| Comando | Descripción | Acceso |
|---------|-------------|--------|
| `/start` | Menú principal | Todos |
| `/become_reseller` | Solicitar ser revendedor | Usuarios normales |
| `/admin` | Panel de administración | Admins |

## ⚡ Funciones destacadas

### 🌐 Regiones visibles en detalle de producto
Cuando un producto tiene múltiples servidores/regiones (ej: PUBG tiene Asia/América/Europa), el detalle los muestra TODOS listados antes de comprar:

```
🎮 PUBG MOBILE UC 60
━━━━━━━━━━━━━━━━━━
💰 Precio: $1.19 USDT
📂 Categoría: Recarga directa

📋 Datos requeridos:

  ✏️ Player ID: Please fill in the player ID

  🌐 Server Info:
     1. Asia
     2. TW, HK, MO
     3. Europe
     4. America

💳 Tu saldo: $5.00
```

### 🔄 Verificación automática de órdenes pendientes
Cada 60 segundos, el bot consulta BuffPin para actualizar el estado de órdenes pendientes (backup al webhook).

### 💳 Pago con USDT elegante
Creación de invoice OxaPay con un click, link directo al pago, botón de "verificar pago" manual, y callback automático que acredita el saldo.

### 📊 Settings en caliente
Todos los settings importantes (markups, mínimos, mensajes) viven en una tabla `settings` con caché. Los cambias desde `/admin` y se aplican inmediatamente sin reiniciar.

## 🔧 Próximas fases

- **Fase 2**: Panel de gestión de bots para revendedores + cupones + carrito + favoritos + referidos
- **Fase 3**: API REST con FastAPI para web futura + dashboard con gráficas
