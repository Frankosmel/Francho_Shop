# Vendedores internos y auditoria

Los vendedores internos se manejan como operadores del mismo sistema. Sus productos manuales se muestran al cliente igual que cualquier producto de Francho Shop; no aparece una tienda externa ni un vendedor alterno en el catalogo.

## Roles

- `admin`: puede ver y gestionar todos los productos manuales, pedidos, vendedores, clientes, ganancias y auditoria.
- `seller`: puede crear productos manuales propios, editar/eliminar solo sus productos, ver sus ventas pendientes y completar entregas.

## Limites

El admin autoriza vendedores desde `Panel Admin -> Vendedores` indicando el `user_id` y el maximo de productos. El limite queda guardado en `internal_sellers.max_products`.

Si un vendedor llega a su limite, la API rechaza nuevos productos con `403 Limite de productos alcanzado`.

## Auditoria

Las acciones relevantes quedan en `audit_log`:

- `seller.grant`: admin autoriza o reactiva vendedor.
- `seller.revoke`: admin quita permisos de vendedor.
- `manual_product.create`: admin/vendedor crea producto manual.
- `manual_product.update`: admin/vendedor edita producto manual.
- `manual_product.delete`: admin/vendedor elimina producto manual.
- `manual_order.create`: cliente compra producto manual.
- `manual_order.complete`: admin/vendedor completa una venta.

Las ventas manuales guardan:

- `manual_products.created_by`: quien creo el producto.
- `manual_orders.seller_id`: vendedor responsable de la venta al momento de comprar.
- `manual_orders.completed_by`: admin/vendedor que completo la entrega.


## Entrega automática descargable

Los productos manuales pueden entregar contenido automáticamente al pagar:

- `Automática: texto`: guarda un texto de entrega, por ejemplo link privado, instrucciones, licencia o acceso a curso.
- `Automática: archivo`: sube TXT, PDF, imagen, ZIP o RAR hasta 25 MB. El archivo queda en `data/delivery_files/` con nombre aleatorio.

Cuando el cliente compra un producto automático:

- Se descuenta el saldo.
- Se crea la orden manual.
- La orden se marca `completed` automáticamente.
- Se guarda la entrega en `manual_orders.delivery_data`.
- Se intenta enviar el texto o archivo por Telegram.
- El cliente también puede verlo desde `Mis pedidos`.

Las subidas quedan registradas en auditoría con `delivery_file.upload` y las entregas automáticas con `manual_order.auto_complete`.

## HTTP 413 en capturas

La API acepta imagenes de iconos hasta 10 MB y archivos de entrega hasta 10 MB. Si Nginx devuelve HTTP 413 antes de llegar a la API, agregar dentro del bloque `server` real:

```nginx
client_max_body_size 25m;
```

Luego validar y recargar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Mejoras de panel admin implementadas

Panel de vendedores:

- resumen de vendedores, activos e ingresos completados;
- detalle por vendedor con productos, ventas recientes, pendientes e ingresos;
- edición de máximo de productos;
- edición de comisión interna;
- activar/desactivar vendedor;
- pausar permiso para crear productos sin quitar el vendedor;
- notas internas del vendedor;
- auditoría `seller.update`.

Panel de usuarios:

- ficha completa por usuario;
- historial de balance;
- pedidos manuales y automáticos recientes;
- depósitos recientes;
- cambio de rol;
- suspensión/desbloqueo con motivo;
- notas internas;
- marca `VIP`, `RIESGO` o `REVISAR`;
- auditoría de ajustes, rol, suspensión y notas.

## Stock digital único

La fase de stock digital permite vender códigos, licencias, cuentas, links o textos únicos.

Uso:

1. Crea o edita un producto manual.
2. Cambia `Tipo entrega` a `Stock digital único`.
3. Guarda el producto si es nuevo.
4. En el bloque de stock digital, pega una línea por item.
5. Opcionalmente usa el formato `Etiqueta | contenido`.
6. Si el producto tiene opciones, puedes asociar el stock a una opción específica.

Cuando el cliente compra:

- se descuenta el saldo;
- se crea el pedido;
- se consume el primer item disponible;
- el item queda marcado como `used`;
- la orden queda `completed`;
- el contenido se guarda en `manual_orders.delivery_data`;
- se intenta enviar por Telegram;
- el cliente lo puede ver en `Mis pedidos`.

Auditoría nueva:

- `digital_stock.import`: carga de stock;
- `manual_order.digital_stock_complete`: consumo y entrega automática de un item.

## Fase 3: gestion avanzada de entregas

Se agrego historial de eventos de entrega en `delivery_events`.

Acciones disponibles desde pedidos del panel admin:

- `Reenviar`: reenvia al cliente la entrega guardada.
- `Cambiar`: cambia la entrega guardada y notifica al cliente.
- `Revocar`: marca la entrega/pedido como revocado y deja auditoria.
- `Historial de entrega`: muestra eventos registrados para el pedido.

Eventos registrados:

- `manual_completed`;
- `manual_completed_file`;
- `auto_completed`;
- `digital_stock_completed`;
- `resent`;
- `changed`;
- `revoked`;
- eventos de fallo de notificacion si Telegram no responde.

Auditoria nueva:

- `manual_order.delivery_resend`;
- `manual_order.delivery_change`;
- `manual_order.delivery_revoke`.

## Fase 4: gestion de pedidos

Se amplio la gestion de pedidos manuales en el panel admin.

Funciones nuevas:

- filtros por estado;
- busqueda por pedido, cliente, producto, nombre, username o email;
- filtro por ID de cliente;
- filtro por ID de vendedor;
- detalle completo del pedido;
- exportacion CSV con autenticacion;
- reembolso de pedido con devolucion de saldo;
- cancelacion de pedido pendiente con devolucion de saldo;
- integracion con gestion de entrega de la fase 3.

Estados usados:

- `pending`;
- `completed`;
- `revoked`;
- `refunded`;
- `canceled`.

Auditoria nueva:

- `manual_order.refund`;
- `manual_order.cancel`.
