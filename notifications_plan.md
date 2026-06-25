# Plan de Implementación de Notificaciones para Francho Shop

Este documento detalla el plan para la **Fase 1 (Notificaciones Internas)** y la preparación del esquema para la **Fase 3 (Push Notifications)** en el proyecto.

## Archivos que vamos a modificar (Touch List)

1. **`database.py`** ([database.py](file:///home/ubuntu/gamestore/database.py))
   - Modificar `init_db()` para agregar las tablas `notifications` y `push_subscriptions`.
   - Implementar funciones auxiliares asíncronas para interactuar con las notificaciones:
     - `create_notification(...)`
     - `list_notifications(...)`
     - `mark_notification_read(...)`
     - `mark_all_notifications_read(...)`
     - `count_unread_notifications(...)`

2. **`webapp/api/main.py`** ([main.py](file:///home/ubuntu/gamestore/webapp/api/main.py))
   - Registrar la importación de `BackgroundTasks` si no está.
   - Definir los nuevos endpoints:
     - `GET /api/notifications`
     - `POST /api/notifications/{notification_id}/read`
     - `POST /api/notifications/read-all`
     - `GET /api/notifications/unread-count`
   - Integrar llamadas a `db.create_notification` en los eventos correspondientes (creación de pedidos, mensajes del chat, disputas, saldo acreditado, confirmaciones de entrega, reembolsos/cancelaciones).

3. **`webapp/frontend/src/App.jsx`** ([App.jsx](file:///home/ubuntu/gamestore/webapp/frontend/src/App.jsx))
   - Agregar el icono de la campana en el header con el contador dinámico de no leídos.
   - Implementar polling de consulta al endpoint de conteo cada 12 segundos.
   - Crear el menú desplegable/vista de notificaciones con formato premium.
   - Configurar acciones al hacer clic para marcar como leída y navegar a la pantalla correspondiente (pedido, caso, etc.).

---

## Detalle Técnico de la Fase 1

### 1. Base de Datos (`database.py`)

#### Tablas
```sql
CREATE TABLE IF NOT EXISTS notifications (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER,
    type                TEXT,                -- e.g., 'new_message', 'new_order', 'order_status', 'balance'
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
```

### 2. Eventos a notificar en el Backend (`webapp/api/main.py`)

| Evento | Quién Recibe | Contenido sugerido |
| :--- | :--- | :--- |
| **Nuevo mensaje de chat** | Admin/Vendedor (si envía cliente) <br> Cliente (si envía admin/vendedor) | "Nuevo mensaje en tu caso del pedido #X" |
| **Nuevo pedido manual** | Vendedor dueño del producto <br> Admin | "Nuevo pedido recibido: #X" |
| **Pedido asignado** | Vendedor asignado | "Se te ha asignado el pedido #X" |
| **Entrega enviada** | Cliente | "Tu pedido #X ha sido entregado. Revisa los datos de entrega." |
| **Cliente confirmó recibido** | Vendedor / Admin | "El cliente del pedido #X confirmó recibido." |
| **Caso en disputa o reporte** | Vendedor / Admin | "Caso en disputa para el pedido #X." |
| **Admin intervino en caso** | Cliente <br> Vendedor | "Un administrador ha intervenido en el caso del pedido #X." |
| **Saldo acreditado** | Cliente (depósito) <br> Vendedor (liberación) | "Se han acreditado $X de saldo en tu cuenta." |
| **Pedido completado** | Vendedor / Cliente | "Pedido #X completado con éxito." |
| **Pedido cancelado/reembolsado** | Cliente <br> Vendedor | "El pedido #X ha sido cancelado. Tu saldo ha sido devuelto." |
