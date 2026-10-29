# Francho Shop B2B Reseller API v1

API oficial y marca blanca para que revendedores autorizados integren el catálogo de productos, recargas de juegos, tarjetas de regalo, suscripciones, números virtuales y entregas automáticas en su servidor, sitio web o bot.

## Documentación pública

- **Portal Web interactivo**: `https://franchoshop.com/api/docs`
- **Especificación OpenAPI 3.1**: `https://franchoshop.com/api/docs/openapi.json`
- **Guía Markdown**: `https://franchoshop.com/api/docs/guide.md`

## Dirección base (Base URL)

```text
https://franchoshop.com/v1
```

*(También disponible bajo `https://franchoshop.com/api/v1`)*

---

## Autenticación

Todas las solicitudes deben autenticarse enviando una API Key autorizada en los encabezados HTTP. Puedes generarla en tu panel de revendedor en [Francho Shop](https://franchoshop.com/?mode=panel).

Envía la clave mediante cualquiera de estos dos encabezados:

```http
Authorization: Bearer fs_live_TU_CLAVE
```

O bien:

```http
X-API-Key: fs_live_TU_CLAVE
```

> **Seguridad**: La clave completa se muestra una sola vez al generarla. Debe almacenarse en las variables de entorno de tu servidor (`.env`). Nunca la expongas en clientes frontend, JavaScript de navegador, aplicaciones móviles públicas ni repositorios de código.

---

## Idempotencia

Para evitar compras duplicadas ante fallos de conexión o caídas temporales de red, puedes enviar el encabezado:

```http
Idempotency-Key: TU_ID_UNICO_DE_PEDIDO
```

- **Comportamiento**: Si una solicitud se interrumpe y la reintentas con el mismo `Idempotency-Key`, la API devolverá la orden original previamente procesada sin volver a debitar saldo.
- **Opcional con fallback automático**: Si tu sistema no envía `Idempotency-Key`, el sistema asigna un identificador único seguro automáticamente.

---

## Resumen de Endpoints

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/v1` | Información general de la API, moneda base y capacidades. |
| `GET` | `/v1/wallet` | Consulta de saldo disponible en USDT y estado de la cuenta. |
| `GET` | `/v1/wallet/movements` | Historial de transacciones y movimientos de saldo. |
| `GET` | `/v1/catalog/products` | Catálogo de productos, juegos y servicios disponibles con sus códigos técnicos. |
| `GET` | `/v1/catalog/products/{product_id}/offers` | Paquetes y ofertas activas de un producto específico con precios mayoristas. |
| `GET` | `/v1/catalog/products/{product_id}/image` | Carátula oficial del producto servida en alta definición de forma marca blanca. |
| `POST` | `/v1/orders` | Crear y procesar una compra/recarga en tiempo real debitando del saldo USDT. |
| `GET` | `/v1/orders/{order_id}` | Consultar el estado en vivo y detalles de entrega de un pedido. |
| `GET` | `/v1/orders` | Historial paginado de pedidos realizados. |
| `GET` | `/api/v1/reseller/sms/countries` | Lista de países soportados para recepción de códigos SMS temporales. |
| `GET` | `/api/v1/reseller/sms/services` | Servicios y aplicaciones disponibles (WhatsApp, Telegram, etc.) con precios mayoristas. |
| `POST` | `/api/v1/reseller/sms/orders` | Adquirir un número virtual temporal para verificación. |
| `GET` | `/api/v1/reseller/sms/orders/{order_id}` | Consultar el código SMS recibido en tiempo real. |

---

## 1. Cuenta y Billetera

### Consultar Saldo

```bash
curl -X GET "https://franchoshop.com/v1/wallet" \
  -H "Authorization: Bearer fs_live_TU_CLAVE"
```

**Respuesta (HTTP 200 OK):**
```json
{
  "data": {
    "currency": "USDT",
    "balance": "85.4500",
    "reserved": "0.0000",
    "available": "85.4500",
    "plan": "reseller"
  }
}
```

---

## 2. Catálogo de Productos

Permite obtener todos los juegos, plataformas y servicios disponibles.

```bash
curl -X GET "https://franchoshop.com/v1/catalog/products?limit=100" \
  -H "Authorization: Bearer fs_live_TU_CLAVE"
```

Parámetros opcionales:
- `search`: Filtrar por nombre (ej: `?search=Free+Fire`).
- `group`: Filtrar por grupo (ej: `?group=games`, `?group=service_topup`, `?group=giftcards`).
- `limit`: Cantidad por página (1 a 100, default 100).
- `cursor`: Cursor para paginación continua.

**Respuesta (HTTP 200 OK):**
```json
{
  "data": [
    {
      "id": "free_fire_latam",
      "category_id": "free_fire_latam",
      "public_id": "prd_RBynh3P7Ux7ECLEbKpIEpsYW",
      "name": "Free Fire (LATAM)",
      "group": "games",
      "type": "topup",
      "provider_type": "topup",
      "available": true,
      "image_url": "https://franchoshop.com/v1/catalog/products/free_fire_latam/image"
    },
    {
      "id": "telegram_premium",
      "category_id": "telegram_premium",
      "public_id": "prd_tlg_prem_2026",
      "name": "Telegram Premium",
      "group": "service_topup",
      "type": "telegram",
      "provider_type": "telegram",
      "available": true,
      "image_url": "https://franchoshop.com/v1/catalog/products/telegram_premium/image"
    }
  ],
  "meta": {
    "limit": 100,
    "has_more": false,
    "next_cursor": null,
    "total": 42
  }
}
```

> **Nota sobre IDs**: Utiliza el campo `"id"` (ej: `free_fire_latam`, `telegram_premium`, `mobile_legends`) para consultar las ofertas o generar órdenes. La API también mantiene compatibilidad si envías el identificador público `prd_...`.

---

## 3. Ofertas de un Producto

Devuelve los paquetes o denominaciones disponibles para el producto indicado, junto con los precios mayoristas aplicados a tu cuenta y los campos que debes solicitar a tu cliente final.

```bash
curl -X GET "https://franchoshop.com/v1/catalog/products/free_fire_latam/offers" \
  -H "Authorization: Bearer fs_live_TU_CLAVE"
```

**Respuesta (HTTP 200 OK):**
```json
{
  "data": [
    {
      "id": "110_diamonds",
      "offer_id": "110_diamonds",
      "public_id": "off_V91l3G...",
      "name": "110 Diamantes",
      "price": "0.7700",
      "price_usdt": "0.7700",
      "currency": "USDT",
      "min_quantity": 1,
      "max_quantity": 1,
      "available": true,
      "required_fields": [
        {
          "key": "player_id",
          "label": "ID de Jugador",
          "required": true,
          "type": "text"
        }
      ]
    },
    {
      "id": "341_diamonds",
      "offer_id": "341_diamonds",
      "public_id": "off_K48xP1...",
      "name": "341 Diamantes",
      "price": "2.3500",
      "price_usdt": "2.3500",
      "currency": "USDT",
      "min_quantity": 1,
      "max_quantity": 1,
      "available": true,
      "required_fields": [
        {
          "key": "player_id",
          "label": "ID de Jugador",
          "required": true,
          "type": "text"
        }
      ]
    }
  ],
  "product": {
    "id": "free_fire_latam",
    "category_id": "free_fire_latam",
    "name": "Free Fire (LATAM)",
    "image_url": "https://franchoshop.com/v1/catalog/products/free_fire_latam/image"
  }
}
```

---

## 4. Crear un Pedido / Recarga Directa

Crea una orden de recarga o compra directa. El costo total se descuenta de tu saldo de revendedor y la entrega se procesa al instante.

### Ejemplo: Recarga de Free Fire

```bash
curl -X POST "https://franchoshop.com/v1/orders" \
  -H "Authorization: Bearer fs_live_TU_CLAVE" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-miweb-20261013-001" \
  -d '{
    "product_id": "free_fire_latam",
    "offer_id": "110_diamonds",
    "quantity": 1,
    "fields": {
      "player_id": "123456789"
    }
  }'
```

*(También se acepta enviar `"player_id": "123456789"` en la raíz del JSON)*.

### Ejemplo: Telegram Premium

```bash
curl -X POST "https://franchoshop.com/v1/orders" \
  -H "Authorization: Bearer fs_live_TU_CLAVE" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-tg-20261013-002" \
  -d '{
    "product_id": "telegram_premium",
    "offer_id": "3m",
    "quantity": 1,
    "fields": {
      "username": "usuario_telegram"
    }
  }'
```

**Respuesta Exitosa (HTTP 201 Created):**
```json
{
  "data": {
    "id": "FSB2B-3F4A7C9B10D2E58A",
    "status": "completed",
    "product": {
      "id": "free_fire_latam",
      "name": "Free Fire (LATAM)"
    },
    "offer": {
      "id": "110_diamonds",
      "name": "110 Diamantes"
    },
    "quantity": 1,
    "unit_price": "0.7700",
    "total": "0.7700",
    "currency": "USDT",
    "delivery": {
      "type": "topup",
      "status": "completed",
      "destination": {
        "player_id": "123456789"
      }
    }
  }
}
```

---

## 5. Consultar un Pedido por ID

Consulta el estado en vivo y detalles de entrega de una orden.

```bash
curl -X GET "https://franchoshop.com/v1/orders/FSB2B-3F4A7C9B10D2E58A" \
  -H "Authorization: Bearer fs_live_TU_CLAVE"
```

**Respuesta (HTTP 200 OK):**
```json
{
  "data": {
    "id": "FSB2B-3F4A7C9B10D2E58A",
    "status": "completed",
    "product": {
      "name": "Free Fire (LATAM) · 110 Diamantes"
    },
    "offer": {
      "name": "110_diamonds"
    },
    "quantity": 1,
    "total": "0.7700",
    "currency": "USDT",
    "delivery": {
      "type": "topup",
      "status": "completed",
      "destination": {
        "player_id": "123456789"
      }
    }
  }
}
```

### Estados Posibles de un Pedido:
- `completed`: Pedido entregado y procesado exitosamente.
- `processing`: Pedido en proceso de entrega con la red de telecomunicaciones / servidor del juego.
- `refunded`: Pedido rechazado o cancelado; el importe fue reintegrado al 100% de inmediato a tu saldo USDT.

---

## 6. Números Virtuales Temporales (SMS)

Adquiere números virtuales para recibir códigos de activación en WhatsApp, Telegram, Google, TikTok, Discord y cientos de plataformas.

### Comprar Número Virtual

```bash
curl -X POST "https://franchoshop.com/api/v1/reseller/sms/orders" \
  -H "Authorization: Bearer fs_live_TU_CLAVE" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sms-wa-20261013-001" \
  -d '{
    "country": "usa",
    "service": "whatsapp",
    "operator": "any"
  }'
```

**Respuesta:**
```json
{
  "ok": true,
  "order_id": "sms_89",
  "phone": "+12025550198",
  "service": "whatsapp",
  "price": "0.75",
  "currency": "USDT",
  "status": "pending",
  "can_cancel_after_seconds": 120,
  "expires_in_seconds": 1200
}
```

### Consultar Código SMS Recibido

```bash
curl -X GET "https://franchoshop.com/api/v1/reseller/sms/orders/sms_89" \
  -H "Authorization: Bearer fs_live_TU_CLAVE"
```

Cuando el mensaje llega:
```json
{
  "ok": true,
  "order_id": "sms_89",
  "phone": "+12025550198",
  "status": "completed",
  "sms_code": "849201",
  "sms_text": "Tu código de WhatsApp es 849-201",
  "price": "0.75",
  "currency": "USDT"
}
```

> **Reglas de Reembolso Automático**:
> 1. Si no llega ningún SMS y transcurren 20 minutos, la orden expira y **se reembolsa el 100% automáticamente**.
> 2. Si transcurren 2 minutos (120 s) sin recibir código, puedes cancelarla manualmente mediante `POST /api/v1/reseller/sms/orders/{order_id}/cancel` con reembolso inmediato.

---

## Códigos de Error HTTP

| Código | Descripción | Causa / Solución |
| :--- | :--- | :--- |
| `400 Bad Request` | Parámetros inválidos | Falta un campo obligatorio en `fields` o datos mal formados. |
| `401 Unauthorized` | Autenticación fallida | API Key ausente, revocada o incorrecta. |
| `404 Not Found` | No encontrado | El `product_id`, `offer_id` u `order_id` especificado no existe. |
| `422 Unprocessable` | Error de formato | `Idempotency-Key` inválido (debe tener entre 8 y 128 caracteres). |
| `502 Bad Gateway` | Rechazo de entrega | La compra no pudo completarse en la red central; el saldo se reembolsa al instante. |

---

## Soporte y Asistencia

Para consultas técnicas adicionales o soporte sobre integraciones, contacta a nuestro equipo mediante el [Panel Oficial de Francho Shop](https://franchoshop.com/?mode=panel).
