# 🛍 Francho Shop — Mini App

Mini app web integrada con el bot de Telegram. Comparte la misma DB,
mismo cliente BuffPin y misma lógica de precios.

## 🏗 Arquitectura

```
┌──────────────────────────────────┐
│   TELEGRAM (Bot existente)       │
│   Botón "🛍 Francho Shop"         │
└──────────┬───────────────────────┘
           │ WebApp + initData
           ▼
┌──────────────────────────────────┐
│   shop.tudominio.com (Nginx)     │
├──────────────────────────────────┤
│  /          → React SPA estático │
│  /api/      → FastAPI :8000      │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│   gamestore.db (compartida)      │
└──────────────────────────────────┘
           ▲
           │
   bot.py también lee/escribe
```

## 📂 Estructura

```
webapp/
├── api/                          # Backend FastAPI
│   ├── main.py                   # 470 líneas — todos los endpoints
│   ├── auth.py                   # Verificación initData Telegram
│   └── requirements.txt
├── frontend/                     # Frontend React + Vite
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx              # Entry point
│       ├── App.jsx               # 320 líneas — toda la UI
│       ├── index.css             # Tailwind + estilos
│       └── api/client.js         # Cliente HTTP
└── deploy/
    ├── franchoshop-api.service   # systemd
    ├── nginx-franchoshop.conf    # Nginx
    └── BOT_PATCH.py              # Instrucciones para añadir botón al bot
```

## 🚀 Instalación paso a paso

### 1. Preparar el subdominio

Apunta `shop.tudominio.com` a la IP del VPS desde tu DNS.

### 2. Instalar dependencias del backend

```bash
cd /root/gamestore/webapp/api
pip3 install -r requirements.txt --break-system-packages
```

### 2.1 Conectar la API de números

Añade estas variables al mismo `.env` que carga Francho Shop:

```bash
NUMBERS_API_BASE=http://127.0.0.1:8095
NUMBERS_WEB_API_KEY=una-clave-larga-igual-en-ambos-servicios
NUMBERS_API_TIMEOUT=20
```

La web no llama a la API de números desde el navegador. Hace la petición al backend de Francho Shop y ese backend la proxyfía hacia `BOT_VENTA_NUMEROS`.

### 3. Probar el backend manualmente

```bash
cd /root/gamestore/webapp/api
# Carga el .env del bot (donde está BOT_TOKEN, etc.)
set -a; source /root/gamestore/.env; set +a
python3 -m uvicorn webapp.api.main:app --host 127.0.0.1 --port 8001 --app-dir /root/gamestore
```

Verifica:
```bash
curl http://127.0.0.1:8001/api/health
# {"ok":true,"service":"Francho Shop"}
```

### 4. Instalar como servicio systemd

```bash
cp /root/gamestore/webapp/deploy/franchoshop-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now franchoshop-api
journalctl -u franchoshop-api -f
```

### 5. Compilar el frontend

Necesitas Node.js 18+ en el VPS:

```bash
# Si no tienes Node:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Compilar:
cd /root/gamestore/webapp/frontend
npm install
npm run build
# Esto crea ./dist/ con los archivos estáticos
```

### 6. Configurar Nginx

```bash
# Editar el archivo y reemplazar 'shop.tudominio.com' por tu dominio real
nano /root/gamestore/webapp/deploy/nginx-franchoshop.conf

# Instalar
cp /root/gamestore/webapp/deploy/nginx-franchoshop.conf /etc/nginx/sites-available/franchoshop
ln -s /etc/nginx/sites-available/franchoshop /etc/nginx/sites-enabled/

# SSL con certbot
certbot --nginx -d shop.tudominio.com

# Verificar y recargar
nginx -t && systemctl reload nginx
```

### 7. Añadir el botón al bot

Lee las instrucciones en `deploy/BOT_PATCH.py` y aplica los 5 pasos:

1. Añadir `WEBAPP_URL` al `.env` del bot
2. Añadir `WEBAPP_URL` a `config.py`
3. Importar `WebAppInfo` en `bot.py` y `keyboards.py`
4. Modificar `kb_main()` en `keyboards.py` para incluir el botón
5. Modificar `main_reply_kb()` en `bot.py` para pasar el `webapp_url`

Reinicia el bot:
```bash
systemctl restart gamestore
```

### 8. Configurar el bot en BotFather

Para que Telegram permita el WebApp, necesitas registrarlo en @BotFather:

```
/mybots → tu_bot → Bot Settings → Configure Mini App
URL: https://shop.tudominio.com
```

## 🧪 Probar

1. Abre el bot en Telegram
2. Verás el botón "🛍 Francho Shop" en el menú
3. Tócalo → se abre la mini app dentro de Telegram
4. Tu balance y rol se cargan automáticamente
5. Navega: Juego → Región → Producto → Comprar

## 🔒 Seguridad

**El backend NUNCA confía en el frontend.** Cada request lleva el `initData`
firmado por Telegram con HMAC-SHA256 usando tu `BOT_TOKEN` como secreto.
El backend lo verifica antes de cualquier acción.

Si alguien intenta hacer una request manual sin initData válido → 401.
Si intenta falsificar el `user_id` → la firma no coincide → 401.

## 🔄 Actualizar el frontend

```bash
cd /root/gamestore/webapp/frontend
npm run build
# Nginx ya sirve los nuevos archivos automáticamente
```

## 🐛 Debug

```bash
# Logs API
journalctl -u franchoshop-api -f

# Logs Nginx
tail -f /var/log/nginx/franchoshop-error.log

# Probar API directamente (sin auth)
curl https://shop.tudominio.com/api/health
```

## ⚙️ Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check (sin auth) |
| GET | `/api/me` | Balance, rol, nombre |
| GET | `/api/games` | Lista de juegos |
| GET | `/api/games/{game}/regions` | Regiones del juego |
| GET | `/api/games/{game}/regions/{region}/products` | Productos |
| GET | `/api/products/{id}` | Detalle + campos |
| POST | `/api/order` | Crear orden |
| GET | `/api/orders` | Mis últimos pedidos |
| GET | `/api/sms/countries` | Países disponibles para números virtuales |
| GET | `/api/sms/services?country=...` | Servicios disponibles por país |
| GET | `/api/sms/operators?country=...&service=...` | Operadores disponibles |
| POST | `/api/sms/order/create` | Crear orden de número virtual |
| GET | `/api/sms/order/status?id=...` | Consultar estado de orden |
| POST | `/api/sms/order/cancel` | Cancelar orden |

Todos requieren header `X-Telegram-Init-Data` (lo añade automáticamente
el frontend desde `Telegram.WebApp.initData`).

## 🎯 Lo que reusa del bot existente

- ✅ `database.py` (todas las funciones CRUD)
- ✅ `modules/pricing.py` (precios duales retail/reseller)
- ✅ `modules/settings.py` (markups dinámicos)
- ✅ `buffpin_client.py` (submit orders, validate user)
- ✅ Proxy HTTP hacia `BOT_VENTA_NUMEROS` para venta automática de números virtuales
- ✅ Mismo `gamestore.db`
- ✅ Mismos roles, mismos precios, mismo flujo de orden

**Cero duplicación de lógica.** Si cambias el markup desde `/admin` en el
bot, la web lo refleja inmediatamente (mismo settings cache).

## 🚧 Próximas fases

Esta es la **Fase 1 (MVP)**. En siguientes fases se puede añadir:
- 📋 Historial de pedidos completo con filtros
- 💼 Panel del revendedor en la web
- 🎟 Cupones aplicables al checkout
- ⭐ Productos favoritos
- 🌐 Multi-idioma
- 👑 Panel admin web (admin sigue por bot)
