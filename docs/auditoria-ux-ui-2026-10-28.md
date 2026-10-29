# 🔍 Auditoría UX/UI — Francho Shop / GameStore

**Fecha:** 28 de octubre de 2026
**Alcance:** Frontend (`webapp/frontend/`) — React 18 + Tailwind v3 + Capacitor
**Método:** 4 auditorías en paralelo (funnel de compra, navegación/layout, auth/formularios, design system/accesibilidad) + verificación manual de los hallazgos críticos contra el código actual.

---

## Contexto del código

| Métrica | Valor |
|---|---|
| `App.jsx` | **27.907 líneas** (1,5 MB) — ~130 componentes |
| Total JSX/CSS en `src/` | 59.946 líneas |
| Botones | 1.093 (solo 72 con `aria-label`) |
| Estados de navegación | ~51 (`screen` + `authScreen`) |
| Tokens de color en `tailwind.config` | **7** (3 sin un solo uso) vs **218 hex sueltos** en el código |
| `autoComplete` en toda la app | **0** |
| `focus-visible` en toda la app | **0** |

### Mapa del funnel de compra

| Ruta | Taps | Notas |
|---|---|---|
| Top-up/FZR (la mayoría de juegos) | 3 | Home → ficha → paquete → `Continuar a pagar` → `Pagar $X` |
| Regiones legacy | 4 | Home → juego → región → denominación → `Comprar` |
| Cuentas manuales | 3 | Home → tarjeta → paquete → `Comprar` |
| Streaming | **4** | Home → tarjeta → página intermedia → `Comprar` → modal → `Comprar` |
| Deep-link `?product=` | 2 | `ProductDetailScreen` |

---

## 🔴 CRÍTICO — Rompe la conversión o el pago

### 1. El detalle de producto puede quedar en spinner infinito (sin error ni reintento)
**Ref:** `App.jsx:11022-11023` *(verificado)*

```jsx
if (loading || !detail) return <CoolLoading label="Cargando detalles del producto..." />
if (err) return <ErrorView msg={err} />   // ← código muerto: !detail ya retornó antes
```

Si la API falla, `detail` nunca se setea → el usuario ve un spinner verde para siempre. **Nunca ve el error ni "Reintentar".** Ídem si la API devuelve `null`.

**Fix:** `if (loading) → skeleton; if (err) → ErrorView con retry; if (!detail) → "Producto no encontrado"`.

### 2. Reintentar un pago CUP crea pedidos duplicados
**Ref:** `App.jsx:10487-10509` (igual en `11078`, `14685`, `6913`) *(verificado)*

```jsx
const cupOrder = await api.createCupOrder({...})        // ← pedido YA creado
await api.uploadCupPaymentProof(cupOrder.order_id, ...) // ← si falla (red móvil cubana)...
catch (e) { setOrderError(e.message); setSubmitting(false) } // ← botón se reactiva
```

El segundo toque vuelve a ejecutar `createCupOrder` → **segundo pedido pendiente**.

**Fix:** persistir `cupOrder.order_id` en estado; al reintentar, solo repetir la subida del comprobante ("Reintentar envío del comprobante del pedido #X"), nunca recrear el pedido.

### 3. Si falla la carga de métodos de pago CUP, desaparecen en silencio
**Ref:** `App.jsx:6613-6617` → `.catch(() => {})` *(verificado)* + `App.jsx:9864` → `if (!hasCupMethods) return null`

Un fallo transitorio borra Transfermóvil/EnZona de toda la UI **sin aviso** — la mayoría de usuarios cubanos se queda sin forma de pagar. Además las tasas caen a constantes hardcodeadas (`|| 1190.90909091`, líneas `6794`, `10451`, `11031`, `14635`): si la tasa real cambió, el monto mostrado no coincide con el que exige el admin.

**Fix:** estado `cupSettingsError` → bloque "No pudimos cargar los métodos de pago en CUP · Reintentar"; nunca renderizar monto CUP derivado de una tasa hardcodeada.

### 4. `streaming-product` no está en la lista de pantallas válidas
**Ref:** `App.jsx:2367` (render) vs `App.jsx:2865-2872` (lista de fallback) *(verificado)*

La pantalla se renderiza, pero la lista de fallback **no la incluye** → en cada ficha de Streaming aparece, debajo, `Estado no reconocido: streaming-product` + botón "Volver al inicio".

Además: **doble header** (la condición de `2182` no la excluye y `StreamingProductPage.jsx:17` trae el suyo) y **ningún tab activo** en BottomNav (`2928` no la contempla).

**Fix:** añadir `'streaming-product'` a la lista de `2865` y a `SAFE_NAV_SCREENS` (`126`); excluir el Header global en `2182`; añadirla al highlight de "Tienda". Mejor: derivar el fallback de un `Set` único compartido por render, sidebar y BottomNav.

### 5. Cero `autoComplete` en todo el flujo de auth
**Ref:** `grep autoComplete App.jsx` → **0** *(verificado)*; inputs en `12190`, `11691`, `12423-12462`, `12660`, `12835`

Ni `username`, ni `current-password`, ni `new-password`, ni `one-time-code`. → Los gerenciadores de contraseñas no funcionan y **el código OTP del correo no se autocompleta con un toque** (iOS/Android solo lo hacen con `autocomplete="one-time-code"`).

**Fix:** `autoComplete="username"` (login email), `"current-password"` (login pw), `"email"`/`"name"` (registro), `"new-password"` (registro/reset), `"one-time-code"` (OTP). Extender `PasswordInput` con prop `autoComplete`.

### 6. Tras registrarse, hay que re-teclear el correo; sin "Reenviar código"
**Ref:** `App.jsx:1953` (`onSuccess={(email) => { setAuthScreen('verify') }}` — el email se descarta), `12354`, `12624-12658`

En el punto de mayor abandono del embudo se añade trabajo evitable. Y **no existe botón "Reenviar código" en ningún flujo OTP** (ni VerifyScreen `12624-12693`, ni ResetScreen `12694-12872`): si el correo llega tarde o cae en spam, no hay salida.

**Fix:** `useState(initialEmail)` en VerifyScreen + pasarle el email; enlaces "¿No llegó el código? Reenviar" con cooldown de 60 s invocando `api.forgotPassword(email)`.

### 7. No se puede copiar nada en toda la app
**Ref:** `App.jsx:2134`: `select-none` en la raíz, con **0** `select-text` *(verificado)*

Imposible copiar IDs de pedido, códigos de referido, direcciones USDT/TRX, claves WireGuard o números de soporte — operaciones esenciales del producto.

**Fix:** quitar `select-none` del raíz (o aplicarlo solo a botones/labels) y añadir `select-text` explícito en datos copiables.

### 8. Spinner full-screen de checkout bloquea todo sin salida
**Ref:** `App.jsx:10575-10582`

```jsx
<div className="fixed inset-0 z-[80] ... bg-black/75 ...">
  <Loader2 className="... animate-spin ..." />
  <p>Procesando compra</p>
  <p>No cierres esta pantalla.</p>
```

Cubre Header, Back y BottomNav (`z-80 > z-60`) durante `createOrder` **y** la subida del comprobante — sin progreso, sin timeout, sin cancelar. Coincide con el punto más lento del flujo.

**Fix:** spinner inline en el botón (ya existe en `10797-10801`) + fases ("Creando pedido…"/"Subiendo comprobante…") + desbloquear con `onCancel` a los 30-45 s ofreciendo "Ver mis pedidos".

### 9. `ResultScreen` miente a quien paga en CUP
**Ref:** `App.jsx:11470-11560`

Hace polling de `api.myOrders()` cada 3 s hasta 40 intentos mostrando *"Pedido creado, esperando confirmación"* — pero el pedido CUP entra como `payment_status: 'pending_verification'` (`10504`) → **2 minutos de spinner de "recarga en curso"** cuando en realidad está esperando a un admin.

Contrasta con `CupOrderSuccessView` (`10294-10338`), que sí lo explica bien y solo se usa en Manual/FZR. Y el único CTA es "Volver al inicio" (`11557`) — sin "Ver mis pedidos" ni "Contactar soporte", justo cuando el propio texto del flujo dice *"Revisa el pedido o contacta soporte"* (`11527`).

**Fix:** detectar `pending_verification` y renderizar `CupOrderSuccessView`; CTA secundario "Ver mis pedidos" y, en estado fallido, "Abrir caso / Soporte".

---

## 🟠 FUNNEL DE COMPRA — Fricción adicional

### 10. Campos: todos obligatorios, sin marca de cuáles lo son
**Ref:** `App.jsx:10443-10448`, `11026-11029`, label `10537`, aviso `10814`

`detailFields.every(...)` no filtra `is_required` (que sí se usa en `ManualBuyModal:14664` y FZR `8191`). Si el proveedor devuelve un campo opcional, **el CTA queda bloqueado para siempre** con un aviso genérico que no dice *qué* campo falta.

**Fix:** validar solo `f.is_required !== false`, pintar `*` en las etiquetas, aviso `Falta: {nombre}` + `scrollIntoView` al input.

### 11. Validación de ID de jugador inexistente / desigual entre pantallas
- `ProductsScreen` (`10534-10558`): detecta el campo → `inputMode="numeric"`, pero no valida formato, no recorta espacios, no tiene "Pegar" (que FZR sí tiene, `7445`) ni error inline.
- `ProductDetailScreen` (`11168-11173`): ni siquiera aplica `inputMode` → **teclado alfanumérico completo** para un ID numérico.
- `ManualBuyModal` (`14925-14935`): marca `*`, pero el error solo llega al tocar Comprar.

**Fix:** componente `<DeliveryField>` compartido con `inputMode` según tipo, `trim()` + validación al blur, error inline en español, botón **Pegar** y auto-formateo de zona (`1234 5678`).

### 12. El "Nro. de Transacción" obligatorio no se valida
**Ref:** label `10058-10059` con `*`, pero el CTA (`10780`) solo exige `proofFile`; `handleBuy` (`10485-10490`) tampoco comprueba `cupReference` → se envía vacío. La UI promete *"tu pedido se verifica y entrega automáticamente en segundos"* (`10074`), promesa que sin ese número se rompe.

**Fix:** añadir `&& cupReference.trim()` al `disabled`, longitud mínima, `value.toUpperCase()` en `onChange`, y reflejar el requisito en la label del botón (como hace FZR, `7643`).

### 13. Seis implementaciones de checkout con comportamientos contradictorios
- `ProductsScreen` barra sticky (`10728`) — X = `clearSelection` (se queda).
- `ProductDetailScreen` (`10960`) — X = `onCancel` = `goBack` (`11274`): **mismo botón rojo, otro significado**.
- `ConfirmScreen` (`11389`) — inalcanzable salvo `?screen=confirm` (`1177`): código muerto.
- `ManualBuyModal` (`14550`), `StreamingBuyModal` (`7917`), `FzrFullCatalogScreen` (`6539`).

`ProductDetailScreen` duplica íntegro el checkout de `ProductsScreen` **con diferencias reales**: allí hay tarjeta de saldo y CTA de recarga (`11247-11268`) y aquí no; allí detecta `isIdField` y aquí no.

**Fix:** unificar en `<CheckoutSheet>` + `<PostPurchaseState>`; eliminar o reconectar `ConfirmScreen`; el botón destructivo debe ser un ícono `X` neutro con `aria-label`.

### 14. "Saldo insuficiente": cinco comportamientos distintos
- `ProductsScreen:10466` / `ManualBuyModal:14670`: error en texto *después* del toque; botón sigue habilitado.
- `ProductDetailScreen:11056` + tarjeta amarilla con 2 CTA de recarga (`11252-11266`) ✅ mejor.
- `FZR:7638-7641`: botón deshabilitado con el desglose en la label.
- `StreamingBuyModal:7952/8300`: botón cambia a "Recargar Saldo" que hace `onClose()` → **pierde la selección**.

**Fix:** patrón único: saldo visible + "Te faltan $X" en el resumen siempre, y CTA que abra `TopUpModal` **sin cerrar** el checkout.

### 15. El CTA no muestra el precio total en 3 de 6 flujos
`ProductsScreen:10806`, `ProductDetailScreen:11309`, `ManualBuyModal:15058` muestran solo `<span>Comprar</span>`; FZR sí (`Pagar $${totalPrice} USDT`, `7641`). Con pago CUP la label `Enviar comprobante (1.190 CUP)` comparte fila con dos botones de 48px en un `flex-1` → en 360 px salta a 3 líneas.

**Fix:** label siempre con monto; mover "Compartir" fuera de la fila CTA; `text-sm` + `whitespace-nowrap`.

### 16. Estados de carga inconsistentes; skeleton que no coincide con el layout
- `CatalogSkeleton` (`7838-7848`) dibuja `grid-cols-2` pero Home renderiza **rieles horizontales** (`9469`) → salto visual al montar.
- `ProductDetailScreen` usa `CoolLoading` centrado (`4767`) que sustituye toda la pantalla y pierde el header.
- `PublicReviewsPanel` (`4869`): `.catch(() => setReviews(null))` → el panel **desaparece sin skeleton ni error**.

**Fix:** `SkeletonList/SkeletonRail` compartidos; estados `loading` + `error` con "Reintentar" en reseñas.

### 17. Estados vacíos y de error sin salida útil
- `8491-8494`: `Catálogo vacío` / `Avisa al admin` — **sin reintentar**.
- `8811`: `Sin resultados para "..."` solo texto (en cambio `CatalogGridView` sí tiene botón, `9426-9437`).
- `ErrorView` sin `onRetry` cae a `location.reload()` (`12918`) → recarga total perdiendo estado.
- `8479`: si hay caché, un fallo posterior se traga y se sirve catálogo viejo sin aviso.

**Fix:** reintentos en línea, botón "Limpiar búsqueda" en el empty, banner "Mostrando catálogo guardado" cuando falla el refresh.

### 18. Dos barras fijas inferiores compitiendo
`BottomNav` en `z-20` (`2921`) se renderiza en products/detail/regions/result (`2861-2863`), mientras la barra de compra está en `z-[60]` (`10728`, `11273`) → **queda tapada** justo cuando el usuario podría querer ir a Pedidos/Soporte. La hoja inner usa `max-h-[42vh]` (`10729`) con el contenedor en `pb-80` fijo (`10566`).

**Fix:** ocultar BottomNav con checkout activo, padding dinámico y `onFocus={e => e.target.scrollIntoView({block:'center'})}` en los inputs.

### 19. Targets táctiles <44px en el camino de conversión
- `9368-9376`: limpiar búsqueda = icono `h-3.5 w-3.5` sin padding ni `aria-label` (~14 px).
- `9463-9465`: "Ver más" es texto plano `text-xs` sin padding.
- `9421`: chips de filtro ~24 px. `8204-8216`: steppers `h-8 w-8`. `5137`: botón atrás `w-9 h-9`.
- `GameCard`/`ManualCatalogCard` sin `aria-label`.

**Fix:** `min-h-11 min-w-11` + `aria-label` en limpiar búsqueda, "Ver más", chips, steppers y tarjetas.

### 20. Bugs de microcopy en `StreamingBuyModal`
`7926` define `maxStock = Math.min(10, ...)`, pero `8196` dice *"Máximo 5 por pedido"* y `8210` limita con `Math.min(5, maxStock)`. Y `8184` imprime **"undefined disponibles"** cuando `in_stock=true` y `stock_available` no existe.

**Fix:** una sola constante `MAX_PER_ORDER`; render condicional del stock.

### 21. Búsqueda y contadores del catálogo engañan
- `8509`: `|| 'vpn wireguard normal gaming bbr'.includes(q)` → buscar `"a"`, `"or"` o `"mal"` muestra la tarjeta VPN sin relación.
- `8468`: `+2` inventados en los badges del sidebar (`8768`) y en `totalProducts` (`8476`).
- `8499-8503`: cambiar de filtro **borra la búsqueda** que el usuario acababa de escribir.

**Fix:** keywords desde `CATEGORY_FILTER_PRESETS`, contadores reales, preservar `search` al cambiar de filtro.

### 22. Modales sin accesibilidad; el de compartir reescribe la URL
- `ManualBuyModal:14713` es `fixed inset-0 z-50` **sin backdrop ni Escape**; `StreamingBuyModal:7973` tampoco. Solo hay **un** `role="dialog"` en todo el archivo (`20708`).
- `ShareProductModal:10835` hace `window.history.replaceState(...)` al montar → **rompe el back** del usuario.
- `PaymentMethodSection:10084/10175` dice `JPG, PNG o WEBP` pero `10111/10202` acepta PDF; sin validación de tamaño.

**Fix:** `role="dialog" aria-modal` + Escape + backdrop; no tocar `history` desde el modal; corregir formatos y validar `file.size`.

---

## 🟠 NAVEGACIÓN Y LAYOUT

### 23. Nunca se restaura el scroll
**Ref:** `App.jsx:1832-1835` y render condicional `2243`

El único mecanismo es `window.scrollTo({top: 0})`, pero las pantallas scrollean en contenedores internos: Home (`8616`), Profile (`20613`), Orders (`22731`), Panel (`26195`). Además `HomeScreen` se **desmonta** al entrar a regions/products/detail → la posición se pierde siempre.

**Fix:** guardar `scrollTop` por `screen` (o mantener Home montada con `hidden`) y restaurarlo en `popstate` (flag `isPopStateNavigation` ya existe en `1729`).

### 24. `fs-screen-transition` definida pero nunca aplicada
**Ref:** `index.css:466-472` (definición) vs **0 usos** en JSX *(verificado)*

Solo existe `fs-auth-route-transition` (`App.jsx:1936`). Los cambios de screen son saltos secos.

**Fix:** aplicar la clase con `key={screen}` en el contenedor de contenido, o eliminarla.

### 25. Chrome de cabecera incoherente: 3 sistemas distintos
- Header global `2182-2185` con condición negativa de **21 pantallas**; muestra siempre la marca, no el título de sección.
- `5117-5183` (Header), `8513-8614` (header propio de Home), `20613`, `22731`, `26163`, `VpnStoreScreen.jsx:104`.
- En regions/products/detail conviven hamburguesa (`md:hidden`) y botón Atrás.
- El botón atrás cambia de forma: `rounded-xl` (Header `5128`) vs `rounded-full` (Orders `22737`).

**Fix:** un `AppHeader` con slots `{leading, title: sección, actions}` para todas las pantallas.

### 26. Drawer móvil sin accesibilidad
**Ref:** `AppSidebar.jsx:686-698` — sin `role="dialog"`, `aria-modal`, focus-trap ni `Escape`.

**Fix:** añadir los tres y devolver el foco al botón hamburguesa (`5124`).

### 27. Escritorio: anchos inconsistentes por pantalla
Home `max-w-lg md:max-w-4xl lg:max-w-5xl` (`8516`), Profile `max-w-lg` fijo (`20613`), Orders `max-w-2xl` (`22732`), Panel sin max (`26195`), VPN `max-w-3xl`. En desktop con sidebar de 288px, el 80% queda en columna de 512px con vacío alrededor y el ancho cambia por pantalla.

**Fix:** shell `md:max-w-5xl` común + layouts de 2 columnas (como hace `StreamingProductPage`).

### 28. BottomNav desaparece en VPN + altura mágica
`2861` excluye `vpn`; `VpnStoreScreen.jsx:112` usa `h-[calc(100dvh-8.8rem)]` sin contemplar `env(safe-area-inset-bottom)`.

**Fix:** mantener BottomNav (resaltando "Tienda") y usar `flex-1` dentro del shell.

### 29. `pb-24` fijo no contempla safe-area de iOS
`2134`: BottomNav real ocupa ≈98 px con safe-area de 34 px (`2921-2925`) → últimos 2-10 px tapados en Términos/FAQ.

**Fix:** `pb-[calc(env(safe-area-inset-bottom)+7rem)]` o constante `--fs-bottom-nav-space`.

### 30. Lógica de "activo" duplicada y divergente en 3 listas
BottomNav (`2928`), Sidebar (`AppSidebar.jsx:430, 480`) y fallback (`2865`) usan listas distintas → en `sms/smm/telegram/capcut/streaming-product` **ningún item queda resaltado**. Los `<button>` del sidebar no llevan `aria-current` (BottomNav sí, `2931`).

**Fix:** `NAV_ACTIVE_SCREENS` compartido (map screen→item) + `aria-current="page"`.

### 31. "Atrás" del catálogo filtrado no hace back real
`8818` `onBack` solo resetea filtro, mientras cambiar de filtro **sí** hace `pushState` (`2210-2214`) y el botón se etiqueta "Atrás" (`9324-9331`) → desincroniza historial y UI.

**Fix:** si el filtro empujó historial, llamar `history.back()`; o usar solo `replaceState` para filtros.

### 32. Experiencia de carga bloqueante inicial
`1901`: `if (loading) return <LoadingScreen />` — splash a pantalla completa hasta que `api.me()` resuelve, sin skeleton ni fallback offline (aunque el sí se cachea en `localStorage`, `8360-8400`).

**Fix:** persistir el perfil y arrancar con él (revalidar en background); splash solo en la primera visita nativa.

### 33. Sidebar sobrecargado y prop fantasma
`AppSidebar.jsx:43-160`: en modo crypto son 15 entradas con label + sublabel + badge `text-[9px]` dentro de un drawer de `w-[85%]`. `unreadNotifsCount` se recibe como prop (`21`) pero **nunca se usa** → sin indicador de notificaciones en el menú.

**Fix:** badges solo en 2-3 items con estado real, secciones colapsables, renderizar el contador.

### 34. Clase muerta `xs:`
`26174`: `hidden xs:inline` — `tailwind.config.js` **no define breakpoints** → la etiqueta nunca se muestra y el botón queda como flecha muda.

### 35. Raíz con 3 modos de layout según listas hardcodeadas
`2134`: tres clases según listas de pantallas a mano — causa raíz de los problemas de scroll (#23) y padding (#29).

**Fix:** un solo shell `h-dvh flex flex-col` (header + `flex-1 overflow-y-auto` + BottomNav).

### 36. Doble identidad del header en Home
`8513-8614` (hamburguesa + notificaciones + pill de saldo **absoluto centrado** de 304px + perfil) vs `5117-5183` (marca + card de saldo + campana + avatar). El usuario aprende dos layouts para la misma barra; en 320px el dropdown desborda.

### 37. Toast de salida con estilos inline y `zIndex: 9999`
`2881-2900`: `whiteSpace:'nowrap'` puede desbordar en 320px, tapa el BottomNav y el mensaje asume back físico también en desktop.

**Fix:** clases Tailwind (`fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw]`), copy "Toca de nuevo para salir".

---

## 🟠 AUTH Y FORMULARIOS

### 38. OTP sin teclado numérico ni soporte nativo de autofill
`12661-12665` (Verify) y `12835-12840` (Reset): `type="text"` + `maxLength={6}` → teclado **alfanumérico con autocorrección** para 6 dígitos. Falta `inputMode="numeric"` (que sí se usa bien en el campo de referido, `12470` — inconsistencia interna).

**Fix:** `inputMode="numeric"`, `autoComplete="one-time-code"`, `pattern="[0-9]*"`.

### 39. Errores API en banner genérico, duplicado 4 veces, sin semántica
`12150-12155`, `12395-12400`, `12632-12637`, `12812-12818`. `setErr(e.message)` vuelca el texto crudo del backend (`client.js:68`), así que un 401 puede mostrarse como **"Error HTTP 401"**. Sin `role="alert"`, sin `aria-live`, sin mover el foco.

**Fix:** componente único `<AuthErrorBanner>` con foco al montar + mapeo de códigos a mensajes accionables en español.

### 40. Al fallar el login no se sugiere recuperar la contraseña
`12145-12155` (banner) está visualmente separado del enlace `12225-12232`. El usuario que falla 3 veces no tiene CTA de recuperación junto al error.

**Fix:** dentro del banner, "¿No recuerdas tu contraseña? Restablecerla →".

### 41. Botón mostrar/contraseña invisible para lectores de pantalla
`11702-11707`: sin `aria-label`, sin `aria-pressed`, icono sin `aria-hidden`.

### 42. Botones deshabilitados sin explicación; sin guard anti-doble-submit
`12246`, `12508`, `12676`, `12855`: `disabled` sin comunicar la causa. Y `handleLogin` (`12133`) no empieza con `if (loading) return` → dos `Enter` rápidos pueden disparar dos `api.login`.

**Fix:** guard en los 4 handlers + pista inline tenue cuando esté deshabilitado.

### 43. Registro: un paso largo, sin medidor de fuerza
`12318-12539`: 6 elementos en scroll continuo sin progreso. La única regla de seguridad está en el placeholder (`12452`, desaparece al escribir) y se valida solo al enviar (`12347`). El referido opcional empuja el checkbox y el CTA fuera de la primera pantalla.

**Fix:** barra de fuerza en vivo, validación en `onChange` persistente, referido en acordeón tras el CTA.

### 44. `lockViewport` inconsistente: registro puede quedar inaccesible
`AuthWrapper` (`11567-11583`) con `justify-center` (`11575`); solo Login lo activa (`12141`). En Registro (~640 px) con teclado iOS abierto **el top queda recortado y sin scroll posible**. En Login, `h-[100dvh] overflow-hidden` no descuenta el teclado.

**Fix:** estandarizar `lockViewport`, `overflow-y-auto` + `py`, y `interactive-widget=resizes-content` en el meta viewport.

### 45. Botón Google como "caja fantasma" si scripts no cargan
`11855-11897`: si `accounts.google.com` está bloqueado (frecuente en Cuba), el div de 44px queda vacío tras 7.5 s de polling **sin mensaje de fallback**. El polling de Telegram (`11991-12000`) hace 120 peticiones × 1.5 s sin cuenta regresiva visible.

**Fix:** tras N intentos, ocultar la sección y mostrar "Google no está disponible ahora. Usa correo o Telegram"; contador `mm:ss` en el modal de Telegram.

### 46. Detección de rutas de auth TRIPLICADA y divergente *(verificado)*
Bloques `1038-1047`, `1265-1272`, `1395-1402` con sufijos `2`/`3`. **Las copias 2 y 3 no reconocen los alias en español** (`/registro`, `/crear-cuenta`) que sí contempla la copia 1 → `/registro` funciona según la rama de guest/logueado por la que pase el usuario.

**Fix:** una única función pura `detectAuthRoute(params, pathname)` usada en los 3 puntos.

### 47. Sin etiquetas visibles asociadas
8 de 9 campos usan solo `placeholder` (`12191`, `12424`, `12440`, `12653`, `12662`, `12706`, `12836`); el único `<label>` real (`12831`) **no tiene `htmlFor`**. El placeholder no es label: desaparece al escribir y su contraste (`placeholder-white/30` sobre `#141b2d` ≈ 2:1) está muy por debajo de 4.5:1.

**Fix:** `id` + `htmlFor` por campo y `placeholder-white/50` como mínimo. Pestañas sin `role="tablist"` (`11602-11624`).

### 48. Sin "Recuérdame": sesión eterna en `localStorage`
`client.js:8` — en dispositivos compartidos (frecuente en Cuba) no hay forma de no mantener la sesión.

**Fix:** toggle "Mantener sesión iniciada" que condicione `setToken` vs `sessionStorage`.

### 49. `ErrorView` decide "expiró sesión" por substring frágil
`12874-12876`: `msg.includes('token') || includes('401')` → un error de pasarela sobre "token de la tarjeta" dispara la pantalla de sesión expirada.

**Fix:** propagar `code` estructurado desde `client.js` y discriminar por código.

### 50. Detalle menor: `title` de RegisterScreen nunca se renderiza
`12393` vs `11626` — prop muerto, trampa de mantenimiento.

---

## 🔴 DESIGN SYSTEM Y ACCESIBILIDAD

**La métrica que resume todo: 218 colores hex sueltos contra 7 tokens definidos (3 de ellos sin un solo uso).**

### 51. Paleta 100% ad-hoc: 218 hex distintos vs 7 tokens
`tailwind.config.js` define `bg, card, cardHover, accent, accentPurple, accentEmerald, accent2` — pero `cardHover`, `accentPurple` y `accentEmerald` tienen **0 usos**. El código usa **853 literales hex en 218 colores distintos** (108 solo en `App.jsx`).

Top: `#ffff00`×116, `#16181f`×79, `#121824`×34, `#0d121f`×24, `#121829`×21, `#07110f`×20.

**Fix:** escala `surface` (5-6 niveles), `brand`, `success`, `warning`, `info`, `neutral`. Eliminar los 3 tokens huérfanos. Objetivo: <30 hex residuales.

### 52. Segunda identidad de marca amarilla paralela al azul `accent`
`#ffff00` ×116 (90 en `App.jsx`) como CTA/borde/hover, sin tokenizar, mientras el token oficial `accent` es `#3b82f6`. Verdes sin token: `#00c26f`×9, `#22c55e`×7, `#16a34a`×9, `#00f5a0`×12; `btn-primary` usa `#00c26f` hardcodeado (`index.css:61`).

Ej.: `App.jsx:5721`, `5729` (copy-paste idéntico en `6123`).

**Fix:** decidir si el amarillo es alegítimo → `brand.yellow` (el puro además falla en light theme y sobre fondos claros).

### 53. Cero visibilidad de foco de teclado
`grep focus-visible` → **0** en los 27 archivos *(verificado)*; solo 2 de 1.093 botones (0,18%) tienen cualquier `focus:`. Los 40 `focus:ring` están casi solo en inputs.

**Fix (1 línea, arregla 1.093 botones):** en `index.css`,
```css
.btn:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

### 54. ~182 botones (16,8%) sin nombre accesible
72 `aria-label` para 1.093 botones (5,1%) *(verificado)*. Archivos con **0** `aria-label`: `ResellerB2B.jsx` (67 botones), `MasterCatalog.jsx` (39), `HelpCenter.jsx` (12), `SellerFeatures.jsx` (13), `AdminAiConfigPanel.jsx` (7).

**Fix:** regla de reviewer — todo botón con solo icono/emoji lleva `aria-label`. Priorizar `ResellerB2B.jsx` y `MasterCatalog.jsx`.

### 55. Cinco+ sistemas de "botón primario" compitiendo
Fondos de los 1.093 botones: `bg-white/10`×211, `bg-accent`×136, `bg-white/5`×110, `bg-gradient-to-r`×37, `bg-emerald-500`×23, `bg-green-500`×14, `btn-primary`×10, `fs-wallet-button-*`×5. **El design system cubre <2%.**

Receta CTA copy-pasteada en 3 archivos (`px-5 py-2.5 rounded-xl font-black text-xs ... bg-emerald-400`): `AdminGmailSettingsPanel.jsx:430`, `ResellerWhiteLabelStore.jsx`, `App.jsx`. Muertos: `btn-ghost` (0 usos), `fs-screen-transition` (0).

**Fix:** `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">` migrando por archivo desde los CTA de compra.

### 56. 4,4 MB de código muerto y duplicado en `src/`
`App.jsx.before-streaming-route-repair` (2,88 MB), `App.jsx.recovered` (777 KB), `App.jsx.bak` (453 KB), `ResellerB2B.jsx.bak_pre_docs_iframe` (208 KB), `VpnStoreScreen.jsx.bak`, `app_history.txt` + **11 scripts Python de parcheo** (`apply_fullscreen_purchase.py`, `upgrade_purchase_modal.py`, `inject_reseller.py`…) — "cirugía con sed" sobre el monolito, síntoma del proceso que causó la duplicación medida en #46.

**Fix:** mover fuera de `src/` (o borrar); archivar los `.py`.

### 57. Neutros inventados a mano: ~5.485 usos
2.580 `text-white/XX` en ~20 opacidades (`/40`×565, `/50`×553, `/60`×364…) + `bg-white/XX`×1.056 + `border-white/XX`×1.849.

**Fix:** `colors.text = { muted, subtle, faint, inverse }`; migrar los 8 más frecuentes (84% de los usos).

### 58. 15 superficies casi-idénticas → light theme roto
`bg-[#16181f]`×64, `#121824`×31, `#121829`×18, `#0d121f`×16… vs tokens `bg #070a0f` y `card #0e1422`. Al ser literales, **`html.light-theme` (`index.css:19`) no los puede sobreescribir** → el modo claro queda roto en ~190 tarjetas.

**Fix:** colapsar a `surface-1/2/3` tokenizados; en light theme se redefine el token.

### 59. Microtexto extremo: 1.465 elementos <12px
`text-[10px]`×790, `[11px]`×481, `[9px]`×167, `[8px]`×27. **405 de 1.093 botones (37%)** con etiqueta ≤11px. Viola WCAG 1.4.4 (resize 200%).

**Fix:** escala mínima de 12px (token `text-2xs`), eliminar `[8px]/[9px]/[10px]`.

### 60. Targets táctiles <44px
10 botones `h-8` (32px), 1 `h-7` (**28 px**, `App.jsx:4968`), botones cuadrados `grid h-8/h-9` (`VpnStoreScreen.jsx`×6), `p-1`×266, `px-2 py-1`×45.

**Fix:** `min-h-[44px] min-w-[44px]` + `touch-manipulation`.

### 61. Iconografía híbrida: 1.250 lucide + 11 SVG inline + 494 emoji como iconos
185 emoji en `App.jsx`, 76 en `ResellerWhiteLabelStore.jsx`, 40 en `SellerFeatures.jsx`. 12 botones con emoji como único icono (`🎉`, `🌐`, `✕` manual en `12910`, `14767` en vez de `<X/>`).

**Fix:** mapa `icon → componente lucide`; los emoji en texto corrido (Telegram) son aceptables, los de UI no.

### 62. ~1.197 iconos decorativos sin `aria-hidden`
1.250 iconos lucide (que no añaden `aria-hidden` por defecto) vs solo 53 en el proyecto. `grep aria-hidden` = 0 en `ResellerB2B.jsx`, `MasterCatalog.jsx`, `HelpCenter.jsx`, `EcosystemScreens.jsx`.

**Fix:** wrapper `<Icon/>` global con `aria-hidden="true" focusable="false"`; los informativos con `role="img"` + `aria-label`.

### 63. 609 valores arbitrarios de Tailwind
`App.jsx` 303 `[#...]`, `ResellerWhiteLabelStore.jsx` 87, `EcosystemScreens.jsx` 52, `VpnStoreScreen.jsx` 46. Tras #51 la mayoría desaparece solo; mantener `calc()`/`env()` legítimos.

### 64. Seis escalas de radio; 5 radios distintos dentro de los mismos botones
Global: `rounded-xl`×1.244, `rounded-lg`×731, `rounded-2xl`×491, `rounded-full`×485. Solo botones: `rounded-xl`×324, `rounded-lg`×205, `rounded-full`×47, `rounded-2xl`×28, `rounded`×28. `AdminGmailSettingsPanel.jsx:394` usa `xl` y `:483` usa `2xl` en el mismo panel.

**Fix:** radios semánticos (`rounded-button: lg`, `rounded-card: xl`, `rounded-pill: full`) delegados en componentes.

### 65. Estados dinámicos no anunciados
`aria-live` = **0**, `aria-expanded` = 2, `aria-busy`/`aria-disabled` = 0. Cuando el botón de pago cambia a "Comprando...", un lector de pantalla no lo anuncia. `HelpCenter.jsx` (12 botones FAQ) sin `aria-expanded`.

### 66. Contraste borderline en CTA
`bg-accent` (#3b82f6, 136 usos) con `text-white` → **~3,7:1, falla WCAG AA**. Mezcla de recetas: `6473` usa `text-bg` (ok, 5,7:1), `8750` usa `text-black` (ok), pero otras usan `text-white`.

**Fix:** token `onAccent: '#0B1220'` aplicado vía `<Button>` para garantizar AA en ambos temas.

---

## ✅ Lo que NO hay que romper

- **Sistema de back**: exit-sentinel + `popstate` + `localStorage` (`fs_last_nav_v1`) + `tg.BackButton` de Telegram (`1880-1898`) → robusto, cubre deep-links (`?product=`, `/panel`, subdominios de tienda, `1056-1501`).
- **Anti-enumeración** en ForgotScreen (`catch { setSent(true) }`, `12548`) — patrón de seguridad correcto.
- **Skeletons** en OrdersScreen (`22697`) y ProductsScreen (`10641`); `RegionsSkeleton` coherente (`9677`).
- `prefers-reduced-motion` respetado en `index.css:485-493` y en la transición de ruta (`355-359`).
- Sanitizado del código de referido (`12338-12345`) y prellenado desde `?ref=`.
- Spinner + label contextual ("Entrando…", "Creando cuenta…") y `disabled` con `loading` en todos los submits.
- `aria-current` en BottomNav (`2931`); safe-area en BottomNav y barras fijas de compra.
- SEO/Schema.org en `index.html` (muy completo: WebSite, Organization, ItemList, FAQPage).
- ResetScreen prellena email y código desde la URL (`12695-12713`).

---

## 🗺️ Roadmap priorizado

### Fase 1 — Parar la hemorragia (alto impacto / bajo riesgo)
1. Fix del spinner infinito en `ProductDetailScreen` (#1)
2. Fix de pedidos CUP duplicados al reintentar (#2)
3. Fallback visible cuando falla `cupPaymentSettings` (#3)
4. Añadir `streaming-product` a la lista de pantallas + unificar Header/BottomNav (#4)
5. `ResultScreen`: detectar `pending_verification` + CTA "Ver mis pedidos" (#9)

### Fase 2 — Fricción de conversión y auth
- `autoComplete` en todos los inputs de auth (#5)
- OTP con `inputMode="numeric"` + `one-time-code` + reenvío con cooldown (#38, #6)
- Email persistido en VerifyScreen (#6)
- `select-text` en datos copiables (#7)
- Spinner inline en vez de bloqueo total en checkout (#8)
- `<DeliveryField>` con validación inline, `Pegar` e `inputMode` (#10, #11)
- Validar `Nro. de Transacción` (#12)

### Fase 3 — Foundations (desbloquea todo lo demás)
- `tailwind.config.js` con escala completa (`surface-1/2/3`, `brand`, `text.muted/subtle`, radios semánticos) → colapsa 218 hex, arregla light theme (#51, #58) y contraste (#66)
- Regla global `:focus-visible` en CSS (**1 línea → 1.093 botones**, #53)
- Componente `<Button>` con variantes (#55)
- Mover 4,4 MB de muertos fuera de `src/` (#56)
- Escala tipográfica mínima 12px (#59)

### Fase 4 — Shell de navegación y accesibilidad
- Un solo `AppHeader` + un solo shell `h-dvh` con `flex-1 overflow-y-auto` → resuelve #23, #25, #29, #35 de golpe
- Restauración de scroll por pantalla (#23)
- Listas de "activo" unificadas (#30)
- Focus-trap + Escape + `role="dialog"` en modales y drawer (#22, #26)
- Barrido `aria-label` empezando por `ResellerB2B.jsx` y `MasterCatalog.jsx` (#54)
- `aria-hidden` en iconos (#62), `aria-live` en estados de compra (#65)

---

## Auditoría visual previa

Existe una auditoría con capturas del **2 de octubre de 2026** en `audit_screenshots_android/` (27 pantallas: auth, home, catálogos, checkout, tiendas de vendedor, perfil, pedidos). Convendría contrastar este informe contra esas capturas para identificar qué se corrigió desde entonces.
