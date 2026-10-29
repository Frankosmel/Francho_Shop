# Migracion de Francho Shop Principal a FZR Cards

## Objetivo

Usar FZR Cards como proveedor de recargas y productos automaticos de la tienda principal de Francho Shop, conservando la web actual, los pedidos historicos, los productos manuales, los pagos CUP y el sistema B2B.

Esta migracion no debe ser un reemplazo ciego de Bufpin: cada oferta visible debe tener un proveedor, costo, disponibilidad, datos requeridos y flujo de entrega comprobados.

## Estado actual

- El catalogo principal se construye desde productos cacheados con logica historica de Bufpin.
- FZR ya esta conectado para Telegram Stars, Telegram Premium y CapCut mediante `FzrCardsClient`.
- Existen tablas y endpoints separados para `fzr_orders`.
- Los productos manuales, SMM, numeros virtuales y Airalo no deben migrarse a FZR por defecto.
- La tienda principal usa precios, catalogo, pedidos, saldo USDT y pagos CUP que no pueden romperse durante el cambio.

## Riesgos que se deben evitar

1. Publicar una oferta FZR sin confirmar que el endpoint de compra y los campos requeridos funcionan.
2. Cobrar saldo antes de crear una orden idempotente del proveedor.
3. Perder la relacion entre un pedido y el proveedor que lo entrego.
4. Aplicar precios CUP usando un costo de proveedor inexistente o desactualizado.
5. Cambiar pedidos historicos de Bufpin a FZR.
6. Dejar productos duplicados o que el mismo producto se muestre dos veces con proveedores distintos.

## Arquitectura objetivo

Cada producto/oferta automatica debe guardar o resolver:

- `provider`: `fzr`, `bufpin_legacy`, `manual`, `smm`, `5sim`, etc.
- `provider_product_type`: topup, gift_card, game_key, steam, manual_service, telegram_stars, telegram_premium.
- `provider_offer_id` o identificador equivalente.
- `provider_product_id` cuando FZR lo entregue.
- `provider_cost_usdt` como texto decimal o valor normalizado de forma segura.
- campos requeridos para compra: `player_id`, `server_id`, `username`, `email`, `quantity`, etc.
- region real y region visible.
- disponibilidad, stock y ultima sincronizacion.
- configuracion de margen global, por categoria y por oferta.

Los pedidos nuevos deben registrar un snapshot inmutable de proveedor, oferta, costo, precio vendido, payload enviado, respuesta, estado y datos de entrega. Los pedidos anteriores conservan su proveedor original.

## Fase A: Inventario y compatibilidad (sin cambiar compras)

1. Consultar el catalogo FZR y guardar un snapshot de categorias, productos, ofertas, costos, stock y campos requeridos.
2. Exportar el catalogo automatico actual y clasificar cada oferta por juego, region, denominacion y proveedor actual.
3. Crear una tabla/informe de mapeo:
   - producto actual;
   - oferta FZR equivalente;
   - proveedor anterior;
   - costo anterior y costo FZR;
   - campos requeridos;
   - compatibilidad confirmada;
   - decision: migrar, conservar legado, ocultar o revisar manualmente.
4. No exponer ofertas FZR nuevas al publico en esta fase.

Entregable: `FZR_CATALOG_COMPATIBILITY_REPORT.md` y datos de mapeo auditables.

## Fase B: Modelo unificado y sincronizacion FZR

1. Crear tablas o migraciones para catalogo de proveedores y mapeos de ofertas; no reutilizar campos de Bufpin con significado ambiguo.
2. Crear un adaptador FZR por tipo de producto con metodos separados para catalogo, cotizacion, compra, consulta de pedido y entrega.
3. Implementar sincronizacion manual desde admin primero; programacion automatica solo despues de validarla.
4. Marcar como no disponible cualquier oferta cuyo proveedor no tenga saldo, stock o respuesta valida.
5. Añadir auditoria para cada sincronizacion y cambio de mapeo.

## Fase C: Catalogo principal y precios

1. El catalogo principal debe leer productos con `provider=fzr` sin mencionar al proveedor al cliente.
2. Reutilizar las imagenes, descripciones, nombres, instrucciones y orden configurables desde admin.
3. Aplicar margenes existentes: global, categoria y oferta; no hardcodear porcentajes FZR.
4. Precios CUP y saldo movil se calculan desde el costo FZR snapshot usando la logica CUP existente en backend.
5. Mantener productos manuales y no compatibles en sus flujos actuales.
6. Evitar duplicados: una oferta publica debe tener una fuente activa definida.

## Fase D: Compra real y estados

1. Crear un servicio de orden FZR con `Idempotency-Key` obligatorio.
2. Validar usuario, saldo, campos requeridos, disponibilidad y precio nuevamente en backend.
3. Crear/reservar el pedido local antes de llamar al proveedor.
4. Enviar la compra a FZR y registrar respuesta completa filtrando secretos.
5. Descontar saldo una sola vez de forma transaccional; si la secuencia no puede garantizarse, dejar el pedido en revision y no duplicar cargos.
6. Consultar estados y recibir webhooks FZR cuando esten disponibles.
7. Mapear estados FZR a `processing`, `completed`, `failed` y `refunded`.
8. Entregar codigo, PIN, serial o confirmacion de recarga mediante el mismo historial de pedidos de Francho Shop.
9. Reembolsar saldo solo con una regla comprobada: fallo/reembolso confirmado por FZR, nunca por una respuesta temporal de red.

## Fase E: Panel administrativo

1. Vista de catalogo FZR con filtros por categoria, producto, region, estado, stock y mapeo.
2. Editar nombre publico, imagen, descripcion, instrucciones, orden, estado y margenes sin editar datos del proveedor.
3. Vista de costos FZR y precio final para admin, nunca para clientes.
4. Gestionar equivalencias entre catalogo anterior y FZR.
5. Ver pedidos FZR, payload sanitizado, costo, precio, estado, entrega, reintentos y reembolsos.
6. Interruptor de activacion por oferta/categoria y modo de prueba interno.

## Orden recomendado de migracion

1. Telegram Premium, Telegram Stars y CapCut: ya integrados; consolidar sus pedidos en la vista comun.
2. Free Fire y Blood Strike: migrar solamente despues de confirmar regiones, campos de ID, precios y compra de prueba por cada region.
3. Gift Cards, Game Keys y Steam: migrar por tipo de entrega, verificando payload de codigo/PIN y stock.
4. Resto de recargas automaticas: una categoria a la vez con pruebas controladas.
5. Productos sin equivalente FZR: mantenerlos con proveedor legado o manual hasta una decision explicita.

## Criterios de aceptacion por oferta

Una oferta no puede activarse para clientes hasta que se confirme:

1. Oferta FZR y region correctas.
2. Campos requeridos y validaciones correctos.
3. Costo y margen visibles para admin.
4. Precio USDT/CUP/saldo movil calculado por backend.
5. Compra de prueba realizada correctamente.
6. Pedido visible en historial con estado y entrega.
7. Fallo/reembolso probado sin doble cargo.
8. Auditoria y soporte pueden identificar el proveedor y la orden externa.

## Regla de despliegue

No desactivar Bufpin globalmente. Se desactiva por oferta o categoria solo cuando la equivalencia FZR este aprobada. Mantener una copia de configuraciones y habilitar rollback por mapeo.
