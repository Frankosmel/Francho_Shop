# Guia para vendedores: como crear y entregar productos

Esta guia explica como vender dentro del sistema y que significa cada tipo de entrega. Los clientes ven los productos como parte de la tienda, no como tiendas externas.

## Roles rapidos

- Admin: controla todo, vendedores, usuarios, pedidos, entregas y auditoria.
- Vendedor: crea productos, ve sus ventas y entrega pedidos de sus propios productos.
- Revendedor: compra con precio especial, pero no crea productos ni entrega pedidos.

## Antes de crear un producto

Define estas 4 cosas:

1. Que va a recibir el cliente.
2. Si se puede entregar automaticamente o necesita revision manual.
3. Si hay stock limitado.
4. Si el cliente debe llenar algun dato para completar la compra.

Ejemplos:

- Curso PDF: entrega automatica por archivo.
- Licencia Windows: stock digital unico.
- Cuenta Netflix: stock digital unico tipo cuenta.
- Servicio de configuracion: entrega manual.
- Link privado de curso: automatica por texto o stock digital si cada link es diferente.

## Campos del producto

### Nombre

El titulo visible para el cliente.

Ejemplos:

- Curso de Trading Basico PDF
- Canva Pro 30 dias
- Licencia Office 2021
- Pack de Recursos Photoshop

### Descripcion

Explica que incluye el producto, condiciones y tiempo de entrega.

Buena descripcion:

> Incluye acceso por 30 dias. Entrega automatica despues del pago. No incluye renovacion.

Evita prometer cosas que no se puedan entregar.

### Precio

Precio en USDT que paga el cliente.

Si el producto tiene opciones, el precio principal se ajusta al menor precio de las opciones.

### Stock

- `-1`: ilimitado.
- `0`: sin stock.
- numero positivo: unidades disponibles.

Para `Stock digital unico`, lo importante es el contador de items disponibles en el bloque de stock digital.

### Categoria

Sirve para organizar el producto.

- Servicio
- Cuenta
- Codigo
- Suscripcion
- Otro

### Imagen del producto

Imagen visible en catalogo. Usa imagen clara y relacionada con lo que vendes.

## Opciones de compra

Usa opciones cuando un mismo producto tiene variantes.

Ejemplos:

Producto: Canva Pro

- 7 dias - $2
- 30 dias - $5
- 90 dias - $12

Producto: Curso

- Basico - $10
- Premium - $25

Cada opcion puede tener precio y stock propio.

## Campos que debe llenar el cliente

Usa esto cuando necesitas datos del cliente.

Ejemplos:

- Email
- Usuario de Telegram
- Numero de telefono
- ID de jugador
- Pais
- Nombre de cuenta

Si el producto es descargable y no necesitas nada del cliente, no agregues campos.

## Tipos de entrega

### 1. Manual

Usala cuando una persona debe revisar, crear o preparar algo antes de entregarlo.

Ejemplos:

- Configurar una cuenta.
- Revisar datos del cliente.
- Hacer una recarga externa.
- Crear un acceso personalizado.

Flujo:

1. Cliente compra.
2. Pedido queda pendiente.
3. Vendedor/admin entra a Pedidos.
4. Toca Entregar.
5. Escribe datos o adjunta archivo.
6. Cliente recibe la entrega.

Ventaja: control total.

Desventaja: requiere tiempo manual.

### 2. Automatica: texto

Usala cuando todos los clientes reciben el mismo texto.

Ejemplos:

- Link a un curso.
- Instrucciones de descarga.
- Clave general de acceso.
- Link a grupo privado.

Flujo:

1. Cliente compra.
2. Sistema completa el pedido automaticamente.
3. Cliente recibe el texto.
4. Tambien queda en Mis pedidos.

No usar si cada cliente debe recibir un codigo diferente.

### 3. Automatica: archivo

Usala cuando todos los clientes reciben el mismo archivo.

Formatos permitidos:

- TXT
- PDF
- Imagen
- ZIP
- RAR

Ejemplos:

- PDF de curso.
- ZIP de recursos.
- Plantillas.
- Imagen o comprobante.
- Archivo TXT con instrucciones.

Flujo:

1. Subes el archivo al crear/editar producto.
2. Cliente compra.
3. Sistema completa el pedido.
4. Cliente recibe el archivo o link de descarga.
5. Queda visible en Mis pedidos.

No usar si cada cliente debe recibir un archivo diferente.

### 4. Stock digital unico

Usalo cuando cada cliente debe recibir un item diferente.

Ejemplos:

- Licencias.
- Codigos de regalo.
- Cuentas usuario:clave.
- Links privados diferentes.
- Cupones unicos.

Como cargar stock:

Una linea por item:

```text
ABC-123-XYZ
DEF-456-ZZZ
GHI-789-AAA
```

Formato con etiqueta opcional:

```text
Cuenta 1 | usuario1:clave1
Cuenta 2 | usuario2:clave2
Licencia Pro | XXXX-YYYY-ZZZZ
```

Flujo:

1. Guardas el producto.
2. Seleccionas `Stock digital unico`.
3. Pegas los items.
4. Importas stock.
5. Cliente compra.
6. Sistema entrega un item disponible.
7. Ese item queda marcado como usado.

Ventaja: automatico y seguro para codigos/cuentas.

Desventaja: si se acaba el stock, no se puede entregar hasta cargar mas.

## Stock por opcion

Si un producto tiene opciones, puedes cargar stock para una opcion especifica.

Ejemplo:

Producto: Netflix

- 1 pantalla
- 2 pantallas
- 4 pantallas

Puedes cargar cuentas diferentes para cada opcion.

Si no eliges opcion al cargar stock, el stock sirve para cualquier opcion del producto.

## Gestion de pedidos

En el panel de pedidos puedes:

- Ver pendientes.
- Ver completados.
- Ver revocados.
- Buscar por cliente, producto o ID.
- Filtrar por vendedor.
- Ver detalle.
- Entregar manualmente.
- Gestionar entrega.
- Reenviar entrega.
- Cambiar entrega.
- Revocar entrega.
- Reembolsar.
- Cancelar.
- Exportar CSV.

## Gestionar entrega

### Reenviar

Sirve cuando el cliente dice que no recibio el mensaje o lo borro.

### Cambiar

Sirve para corregir una entrega.

Ejemplo:

- Se entrego una clave incorrecta.
- Se cambio un link.
- Se actualizo una cuenta.

### Revocar

Sirve cuando la entrega ya no debe ser valida.

Ejemplos:

- Fraude.
- Reembolso.
- Error grave.

La revocacion queda auditada.

## Reembolso y cancelacion

### Cancelar

Usalo en pedidos pendientes que no se van a entregar.

Resultado:

- Pedido pasa a `canceled`.
- Se devuelve saldo al cliente.

### Reembolsar

Usalo cuando un pedido ya fue procesado pero corresponde devolver el dinero.

Resultado:

- Pedido pasa a `refunded`.
- Se devuelve saldo al cliente.
- Queda en auditoria.

## Buenas practicas para vendedores

- Usa nombres claros.
- Explica condiciones en la descripcion.
- No uses entrega manual si puede ser automatica.
- Usa stock digital para codigos/cuentas unicas.
- Revisa que haya stock disponible.
- Prueba el producto con una compra pequeña antes de vender mucho.
- No pongas datos sensibles en la descripcion publica.
- No prometas tiempos imposibles.
- Si cambias una entrega, deja nota.
- Si revocas, escribe motivo claro.

## Que tipo de entrega usar

| Caso | Tipo recomendado |
| --- | --- |
| Todos reciben el mismo link | Automatica: texto |
| Todos reciben el mismo PDF/ZIP | Automatica: archivo |
| Cada cliente recibe una licencia distinta | Stock digital unico |
| Cada cliente recibe una cuenta distinta | Stock digital unico |
| Hay que revisar datos antes de entregar | Manual |
| Hay varias versiones del producto | Opciones de compra |
| Cada opcion tiene codigos distintos | Stock digital por opcion |

## Ejemplos completos

### Ejemplo 1: curso en PDF

- Nombre: Curso Basico de Marketing PDF
- Categoria: Curso/Otro
- Precio: 10
- Tipo entrega: Automatica: archivo
- Archivo: curso-marketing.pdf
- Campos cliente: ninguno

### Ejemplo 2: licencia unica

- Nombre: Licencia Office 2021
- Categoria: Codigo
- Precio: 15
- Tipo entrega: Stock digital unico
- Stock:

```text
Office 1 | XXXX-1111-AAAA
Office 2 | XXXX-2222-BBBB
Office 3 | XXXX-3333-CCCC
```

### Ejemplo 3: cuenta

- Nombre: Cuenta Canva Pro 30 dias
- Categoria: Cuenta
- Precio: 5
- Tipo entrega: Stock digital unico
- Stock:

```text
Cuenta 1 | correo1@example.com:clave123
Cuenta 2 | correo2@example.com:clave456
```

### Ejemplo 4: servicio manual

- Nombre: Configuracion de Bot Telegram
- Categoria: Servicio
- Precio: 30
- Tipo entrega: Manual
- Campos cliente:
  - Usuario Telegram
  - Descripcion del trabajo

## Errores comunes

### El cliente compro pero no recibio nada

Revisa:

- Si el pedido esta pendiente.
- Si el producto era manual.
- Si Telegram fallo.
- Usa `Gestionar -> Reenviar`.

### Producto sin stock digital

Carga mas items en el bloque de stock digital.

### Vendedor no puede crear productos

Revisa en Panel Admin -> Vendedores:

- Activo.
- Puede crear.
- Limite de productos.

### El vendedor no aparece

Debe existir como vendedor interno. Si se cambia el rol a Vendedor desde usuarios, el sistema ya crea el perfil interno automaticamente.
