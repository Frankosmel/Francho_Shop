# Plan rapido: numeros virtuales 5sim en Francho Shop

Documento para AGY. Objetivo: implementar la venta de numeros virtuales directo en la web de `gamestore`/Francho Shop, conectando el backend a 5sim sin depender del bot viejo. `BOT_VENTA_NUMEROS` queda solo como referencia y canal de aviso/migracion.

## Decision tecnica

Implementar 5sim directo dentro de Francho Shop.

No usar `BOT_VENTA_NUMEROS` como dependencia runtime. Ese bot queda solo como referencia de logica ya probada: endpoints de 5sim, calculo de precios, estados, cancelacion y textos legales. La compra real desde la web debe usar:

- saldo de Francho Shop (`gamestore.db`, tabla `users.balance`)
- ordenes propias de Francho Shop
- configuracion propia desde admin
- API directa de 5sim desde el backend de Francho Shop

Motivo: evita doble saldo, evita depender de otro bot/DB, permite mostrar historial en la web y deja todo listo para que Francho Shop sea el canal principal.

## Arquitectura final

1. Usuario entra a Francho Shop con Telegram o login web.
2. Abre `Numeros virtuales`.
3. Backend de Francho Shop consulta paises, servicios, operadores y precios en 5sim.
4. Usuario confirma compra.
5. Francho Shop valida saldo interno.
6. Francho Shop compra el numero en 5sim.
7. Francho Shop descuenta saldo y guarda la orden local.
8. La web muestra numero, estado, codigo SMS y boton de cancelar si aplica.
9. Si llega codigo, Francho Shop marca completado y llama `finish` en 5sim.
10. Si se cancela o expira, Francho Shop reembolsa su propio saldo y marca la orden.

`BOT_VENTA_NUMEROS` no participa en el flujo. Mas adelante se agrega un aviso en ese bot explicando que las compras nuevas se haran desde Francho Shop.

## Obstaculos y decisiones

1. Migracion de saldos del bot de numeros.

   No hacerla antes de tener la venta 5sim funcionando en Francho Shop. Primero se implementa y prueba con saldo de Francho Shop. Luego se define una migracion puntual desde `BOT_VENTA_NUMEROS/tienda_bot.db` hacia `gamestore.db`.

2. Doble saldo durante la transicion.

   Durante pruebas puede existir saldo en el bot viejo y saldo en Francho Shop. No mezclar. Cuando se decida migrar, se congela o se anuncia fecha de corte en el bot viejo.

3. Reembolsos.

   Como la compra nueva descuenta saldo de Francho Shop, el reembolso tambien debe ir a Francho Shop. No llamar funciones de reembolso del bot viejo.

4. API key 5sim.

   No hardcodear en `config.py`. Usar `.env`:

   ```bash
   FIVESIM_API_KEY=...
   FIVESIM_BASE_URL=https://5sim.net/v1
   FIVESIM_TIMEOUT=25
   SMS_DEFAULT_MARKUP=1.50
   SMS_MIN_PRICE_USD=0.50
   ```

5. Seguridad.

   La API de 5sim solo se llama desde `webapp/api/main.py` o un modulo backend. Nunca desde el navegador.

6. Historial.

   Las ordenes SMS deben quedar en `gamestore.db`, no en la DB del bot viejo.

7. Bot viejo.

   Cuando Francho Shop este probado, agregar aviso y boton en `BOT_VENTA_NUMEROS`: `Ahora compra desde Francho Shop`.

## Estado actual encontrado

- `webapp/frontend/src/api/client.js` ya tiene metodos preparados para `/api/sms/...`.
- `webapp/api/main.py` ya tiene rutas `/api/sms/...`, pero ahora deben dejar de proxyfiar y pasar a usar 5sim directo.
- `BOT_VENTA_NUMEROS/sms_engine.py` contiene logica util de referencia:
  - `guest/countries`
  - `guest/products/{country}/any`
  - `guest/prices?country=...&product=...`
  - `user/buy/activation/{country}/{operator}/{product}`
  - `user/check/{order_id}`
  - `user/finish/{order_id}`
  - `user/ban/{order_id}`
- `BOT_VENTA_NUMEROS/config.py` tiene credenciales en claro. No copiar eso. Mover la key real a `.env` de Francho Shop.

## Fase 1: modulo backend 5sim

Crear archivo:

```text
webapp/api/fivesim_client.py
```

Responsabilidades:

- leer `FIVESIM_API_KEY`, `FIVESIM_BASE_URL`, `FIVESIM_TIMEOUT`
- consultar paises
- consultar servicios por pais
- consultar operadores por pais/servicio
- comprar numero
- consultar orden
- finalizar orden
- cancelar/banear orden

Estructura sugerida:

```python
import os
import aiohttp

FIVESIM_BASE_URL = os.getenv("FIVESIM_BASE_URL", "https://5sim.net/v1").rstrip("/")
FIVESIM_API_KEY = os.getenv("FIVESIM_API_KEY", "").strip()
FIVESIM_TIMEOUT = float(os.getenv("FIVESIM_TIMEOUT", "25"))

class FiveSimError(Exception):
    pass

class FiveSimClient:
    def __init__(self):
        self.public_headers = {"Accept": "application/json"}
        self.auth_headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {FIVESIM_API_KEY}",
        }

    async def _request(self, method, path, auth=False, params=None):
        headers = self.auth_headers if auth else self.public_headers
        async with aiohttp.ClientSession() as session:
            async with session.request(
                method,
                f"{FIVESIM_BASE_URL}{path}",
                headers=headers,
                params=params,
                timeout=aiohttp.ClientTimeout(total=FIVESIM_TIMEOUT),
            ) as resp:
                text = await resp.text()
                try:
                    data = await resp.json(content_type=None)
                except Exception:
                    data = {"raw": text}
                if resp.status >= 400:
                    raise FiveSimError(str(data)[:300])
                return data

    async def countries(self):
        return await self._request("GET", "/guest/countries")

    async def products(self, country, operator="any"):
        return await self._request("GET", f"/guest/products/{country}/{operator}")

    async def prices(self, country, product):
        return await self._request("GET", "/guest/prices", params={"country": country, "product": product})

    async def buy_activation(self, country, operator, product):
        if not FIVESIM_API_KEY:
            raise FiveSimError("FIVESIM_API_KEY no configurada")
        return await self._request("GET", f"/user/buy/activation/{country}/{operator}/{product}", auth=True)

    async def check(self, order_id):
        return await self._request("GET", f"/user/check/{order_id}", auth=True)

    async def finish(self, order_id):
        return await self._request("GET", f"/user/finish/{order_id}", auth=True)

    async def cancel(self, order_id):
        return await self._request("GET", f"/user/ban/{order_id}", auth=True)
```

## Fase 2: tablas nuevas en `gamestore.db`

Agregar migracion en `database.py` o en el lifespan de `webapp/api/main.py`.

```sql
CREATE TABLE IF NOT EXISTS sms_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    fivesim_order_id TEXT UNIQUE,
    phone TEXT,
    country TEXT NOT NULL,
    service TEXT NOT NULL,
    operator TEXT DEFAULT 'any',
    cost_price REAL DEFAULT 0,
    sell_price REAL NOT NULL,
    code TEXT,
    status TEXT DEFAULT 'pending', -- pending, completed, canceled, expired, failed
    raw_response TEXT,
    error_message TEXT,
    created_at REAL DEFAULT (unixepoch()),
    updated_at REAL DEFAULT (unixepoch()),
    completed_at REAL,
    canceled_at REAL,
    refunded_at REAL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_sms_orders_user ON sms_orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_orders_status ON sms_orders(status);

CREATE TABLE IF NOT EXISTS sms_catalog_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL, -- country, service, operator, home
    item_key TEXT NOT NULL,
    display_name TEXT,
    icon_url TEXT,
    banner_url TEXT,
    is_featured INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 100,
    custom_markup REAL,
    min_price REAL,
    created_at REAL DEFAULT (unixepoch()),
    updated_at REAL DEFAULT (unixepoch()),
    UNIQUE(item_type, item_key)
);
```

## Fase 3: endpoints publicos/usuario

Reemplazar los proxies actuales `/api/sms/...` en `webapp/api/main.py` por llamadas directas a `FiveSimClient`.

Endpoints:

- `GET /api/sms/health`
  - valida que `FIVESIM_API_KEY` existe
  - opcional: consulta perfil 5sim o una llamada liviana

- `GET /api/sms/countries`
  - llama `guest/countries`
  - devuelve lista normalizada
  - aplica `sms_catalog_overrides` para iconos, nombres, ocultos y destacados

- `GET /api/sms/services?country=...`
  - llama `guest/products/{country}/any`
  - calcula precio desde con markup
  - aplica overrides de servicio

- `GET /api/sms/operators?country=...&service=...`
  - llama `guest/prices`
  - devuelve operadores con stock, costo y precio final

- `POST /api/sms/order/create`
  - valida usuario autenticado
  - valida saldo de Francho Shop
  - compra numero en 5sim
  - calcula precio real con respuesta de 5sim
  - descuenta saldo en `users.balance`
  - inserta `sms_orders`
  - devuelve numero y orden

- `GET /api/sms/order/status?id=...`
  - valida que la orden pertenezca al usuario
  - llama `user/check/{fivesim_order_id}` si sigue pendiente
  - si llega codigo: guarda `code`, marca `completed`, llama `finish`
  - si 5sim devuelve cancelado/timeout: marca y reembolsa si corresponde

- `POST /api/sms/order/cancel`
  - valida usuario y orden pendiente
  - llama `user/ban/{fivesim_order_id}`
  - si 5sim acepta: reembolsa saldo en Francho Shop y marca cancelada

- `GET /api/sms/my-orders`
  - devuelve historial del usuario

## Fase 4: funciones de base de datos

Agregar en `database.py` funciones claras:

- `create_sms_order(...)`
- `get_sms_order(order_id)`
- `get_sms_order_by_fivesim_id(fivesim_order_id)`
- `get_user_sms_orders(user_id, limit=50)`
- `update_sms_order_status(...)`
- `refund_sms_order(order_id, reason)`
- `spend_balance(user_id, amount, ref_id, note)` ya existe; reutilizar si sirve
- `add_balance(...)` ya existe; reutilizar para reembolso si sirve

Regla importante: compra y descuento deben ser lo mas atomicos posible.

Flujo seguro recomendado:

1. Validar saldo.
2. Comprar en 5sim.
3. Si 5sim responde numero, descontar saldo y guardar orden.
4. Si falla el guardado/descuento despues de comprar, guardar orden en `failed_needs_review` o notificar admin para resolver manualmente.

Opcion mas segura pero mas compleja:

1. Retener saldo local.
2. Comprar 5sim.
3. Confirmar descuento final.

Para salir rapido, usar la primera con auditoria y logs.

## Fase 5: admin de numeros virtuales

Agregar pestaña en admin: `Numeros virtuales`.

Debe permitir:

- ver estado de 5sim
- ver saldo/configuracion 5sim si se implementa endpoint de perfil
- configurar markup global
- configurar precio minimo
- ocultar paises
- destacar paises
- subir imagen para paises
- subir imagen para servicios
- renombrar servicios visibles
- ocultar servicios
- configurar markup por servicio/pais
- ver ordenes SMS recientes
- filtrar por estado: pending, completed, canceled, failed
- forzar refresh de orden pendiente
- cancelar/reembolsar manualmente si hace falta

Reutilizar `api.uploadIcon()` y el mismo estilo del panel de productos manuales.

## Fase 6: frontend profesional

Crear pantalla `SmsNumbersScreen` en `webapp/frontend/src/App.jsx` o separar componente si AGY prefiere.

Entrada desde home:

- card `Numeros virtuales`
- imagen/icono configurable desde admin
- texto corto: `Recibe codigos SMS para WhatsApp, Telegram, Google y mas`

Flujo:

1. Paises
   - buscador
   - destacados arriba
   - imagen/bandera

2. Servicios
   - buscador
   - populares: WhatsApp, Telegram, Google, Facebook, Instagram, TikTok
   - precio desde
   - stock

3. Operadores
   - recomendar `any`
   - mostrar precio y stock

4. Confirmacion
   - saldo Francho Shop
   - precio final
   - pais/servicio/operador
   - aviso legal corto

5. Orden activa
   - numero grande
   - boton copiar numero
   - estado esperando SMS
   - auto refresh cada 5-8 segundos
   - codigo grande cuando llegue
   - boton copiar codigo
   - boton cancelar mientras este pendiente

Estados obligatorios:

- sin stock
- saldo insuficiente
- proveedor caido
- compra fallida
- orden pendiente
- codigo recibido
- cancelada/reembolsada
- timeout


## Ajuste de UX pedido por Frank

Los numeros virtuales no deben sentirse como una tienda separada ni como un modulo aislado. Deben aparecer como una opcion normal del catalogo de Francho Shop y sus compras deben salir en `Mis pedidos` junto con recargas automaticas y productos manuales.

Reglas de UX:

- Mantener una entrada normal en el catalogo: `Numeros virtuales`.
- Dentro de esa entrada organizar paises, servicios y operadores.
- No mostrar un historial SMS separado como experiencia principal.
- Integrar `api.smsMyOrders()` dentro de `OrdersScreen` junto con `api.myOrders()` y `api.myManualOrders()`.
- Cada orden SMS debe mapearse como `type: 'sms'`.
- En `Mis pedidos`, mostrar:
  - producto: `Numero virtual - WhatsApp`, `Numero virtual - Telegram`, etc.
  - precio
  - pais
  - operador
  - numero recibido
  - codigo SMS si llego
  - estado: pendiente, completado, cancelado/reembolsado, fallido
- Permitir cancelar solo si el estado esta `pending`.
- Dar reembolso solo si el SMS no llega o 5sim permite cancelar/expirar la orden.
- Si el codigo llego y se mostro al usuario, la venta queda completada y no corresponde reembolso automatico.

Mapeo recomendado para `OrdersScreen`:

```js
const sms = (smsList?.items || smsList || []).map(o => ({
  ...o,
  type: 'sms',
  id: o.id || o.fivesim_order_id,
  product: `Numero virtual - ${(o.service || '').toUpperCase()}`,
  price: o.sell_price || o.price || 0,
  status: o.status === 'completed' ? 'completed' : o.status === 'pending' ? 'pending' : o.refunded_at ? 'failed' : o.status,
  icon_url: o.icon_url || '',
  recharge_details: [
    { label: 'Pais', value: o.country },
    { label: 'Operador', value: o.operator },
    { label: 'Numero', value: o.phone },
    ...(o.code ? [{ label: 'Codigo SMS', value: o.code }] : []),
  ],
}))
```

En la tarjeta de pedido, para `type === 'sms'` usar icono de telefono y mostrar bloque especial:

```text
Numero: +123456789
Codigo SMS: 123456
```

con boton copiar para numero y codigo.

Correcciones ya detectadas:

- `Missing initData o token` al cargar paises ocurre porque `GET /api/sms/countries`, `services` y `operators` estaban protegidos por `get_current_user`. Esos endpoints son catalogo publico y no necesitan login. Solo comprar, cancelar, consultar orden propia e historial deben requerir login.
- `Estado no reconocido: sms` ocurre porque la pantalla `sms` existe, pero el fallback de `App.jsx` no incluia `sms` en la lista de estados validos.

## Fase 7: migracion de saldos del bot viejo

Hacer esto despues de que Francho Shop compre directo en 5sim y este probado.

Plan de migracion:

1. Exportar usuarios con saldo positivo de `BOT_VENTA_NUMEROS/tienda_bot.db`.
2. Generar CSV:

   ```text
   user_id,username,balance
   ```

3. En Francho Shop, importar sumando ese saldo a `users.balance`.
4. Registrar cada movimiento en `balance_log` con nota:

   ```text
   Migracion saldo BOT_VENTA_NUMEROS
   ```

5. Guardar backup antes y despues.
6. Avisar en el bot viejo que el saldo fue migrado.
7. Desactivar compras nuevas en el bot viejo o cambiar botones hacia Francho Shop.

No hacer migracion automatica sin revisar CSV antes.

## Fase 8: aviso en BOT_VENTA_NUMEROS

Cuando la web ya este funcionando:

- agregar mensaje en `/start`
- agregar boton `Comprar en Francho Shop`
- opcional: bloquear compras nuevas en el bot viejo despues de fecha de corte

Texto recomendado:

```text
Las compras de numeros virtuales se estan moviendo a Francho Shop.
Tu saldo sera migrado y podras comprar desde una web mas rapida y organizada.
Usa el boton de abajo para entrar.
```

Boton:

```text
🌐 Comprar en Francho Shop
```

URL sugerida:

```text
https://franchoshop.reenvioplusbot.xyz/#/numeros
```

## Fase 9: pruebas obligatorias

Backend:

```bash
cd /home/ubuntu/gamestore
python3 -m py_compile webapp/api/main.py webapp/api/fivesim_client.py database.py
```

Frontend:

```bash
cd /home/ubuntu/gamestore/webapp/frontend
npm run build
```

Pruebas funcionales:

1. Entrar a Francho Shop.
2. Ver saldo Francho Shop.
3. Abrir numeros virtuales.
4. Cargar paises.
5. Cargar servicios.
6. Cargar operadores.
7. Intentar compra sin saldo suficiente.
8. Comprar numero con saldo suficiente.
9. Ver que se descuenta saldo.
10. Cancelar orden pendiente y confirmar reembolso.
11. Comprar una orden real pequena y esperar codigo.
12. Ver historial en `Mis numeros`.
13. Revisar admin de ordenes SMS.

## Resultado esperado

Francho Shop debe tener su propio sistema de venta de numeros virtuales conectado directo a 5sim, usando saldo interno de Francho Shop, con historial, cancelacion, reembolso, imagenes configurables desde admin y una experiencia visual profesional. El bot viejo queda solo como canal de aviso/migracion, no como motor de compra.
