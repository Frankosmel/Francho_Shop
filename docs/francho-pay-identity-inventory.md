# Inventario de Identidad: Francho Pay

Fecha: 2026-10-29

## Estado actual

La tabla `users` usa `user_id` como llave primaria. Ese valor es interno y no debe seguir apareciendo en la interfaz pública. Las cuentas creadas por Telegram usan el ID de Telegram; las cuentas web usan IDs negativos sintéticos. Por tanto, no es apto como código público ni como base de una URL compartible.

El campo `users.username` corresponde al usuario recibido desde Telegram. Actualmente también se usa para inicio de sesión y búsqueda de destinatarios. No debe convertirse en el handle de Francho Shop ni ser sobrescrito al vincular Telegram.

## Puntos existentes que deben preservarse

| Área | Archivo/ruta | Uso actual |
| --- | --- | --- |
| Esquema y migraciones | `database.py:init_db` | Crea `users` y ejecuta migraciones idempotentes por columnas. |
| Cuentas Telegram | `database.py:upsert_user` | Actualiza `username`, `first_name` y actividad desde Telegram. |
| Cuentas web | `database.py:create_web_user` | Crea IDs negativos para evitar colisión con Telegram. |
| Login web | `webapp/api/web_auth.py:login_with_email` | Permite email o `users.username`. |
| Perfil propio | `GET/PUT /api/profile` | Alimenta cabecera, perfil y edición de datos personales. |
| Autenticación | `webapp/api/auth.py:get_current_user` | Expone `username` de Telegram y `user_id` interno a rutas privadas. |
| Transferencia FC | `GET /api/wallet/recipient`, `POST /api/wallet/transfer` | Busca por ID, email o `username`; debe extenderse, no reemplazarse. |
| Depósitos OxaPay | tabla `deposits` | Guarda el receptor actual en `user_id`. |
| Administración | `/api/admin/users/*` | Puede conservar IDs internos para operadores autorizados. |

## Exposición actual a corregir gradualmente

- Vistas de cliente muestran valores como `#45` o `ID 45` en varios componentes.
- El perfil usa `referral_code` y, como respaldo, `user_id` en enlaces de referido.
- El buscador de FC permite usar el ID numérico interno.
- El panel administrativo utiliza los IDs internos, lo cual puede mantenerse solo para administradores.

## Modelo nuevo propuesto

No se modifica ni se reutiliza `users.username`.

Columnas nuevas de `users`:

```text
public_code                 TEXT UNIQUE NULL
payment_handle              TEXT UNIQUE NULL
payment_profile_enabled     INTEGER NOT NULL DEFAULT 0
payment_handle_changed_at   REAL NULL
payment_profile_updated_at  REAL NULL
```

Significado:

- `public_code`: identificador inmutable visible. Formato `FS-323-XXXXXX` para usuario; el sufijo debe ser aleatorio y único. El código no concede permisos.
- `payment_handle`: handle de Francho Shop, normalizado en minúsculas y sin `@` al guardar. Ejemplo: `darielusdt`.
- `payment_profile_enabled`: controla si la URL pública y el QR aceptan solicitudes de cobro.
- `payment_handle_changed_at`: permite aplicar enfriamiento entre cambios.

La asignación inicial será retrocompatible: se crea `public_code` para cada cuenta existente y se deja `payment_handle` vacío hasta que el usuario lo reclame. Esto evita apropiarse de handles basándose en nombres de Telegram.

## Formatos de referencia

| Tipo | Prefijo | Ejemplo |
| --- | --- | --- |
| Usuario | `323` | `FS-323-482103` |
| Transferencia FC | `123` | `FS-123-901742` |
| Depósito/recarga | `149` | `FS-149-286451` |
| Solicitud de pago | `241` | `FS-241-638105` |

El código visible es una referencia humana. Las relaciones, autorizaciones y webhooks continúan usando claves internas y tokens aleatorios no expuestos.

## Rutas nuevas previstas, sin sustituir rutas existentes

```text
GET  /api/pay/handle-availability?handle=
PUT  /api/profile/payment-handle
GET  /api/public/profiles/{handle}
GET  /api/public/profiles/{handle}/qr
```

Más adelante se añadirán solicitudes de pago. Ninguna ruta pública devolverá correo, teléfono, balance, ID interno, roles administrativos ni datos de KYC.

## Reglas de seguridad para la siguiente fase

1. Validar handle entre 4 y 24 caracteres: `a-z`, `0-9`, `_`, `-`.
2. Reservar rutas y palabras: `admin`, `api`, `support`, `soporte`, `wallet`, `pay`, `profile`, `login`, `registro`, `b2b` y variantes de marca.
3. Índice único con comparación sin distinguir mayúsculas/minúsculas.
4. Límite de consultas públicas y de comprobación de disponibilidad.
5. Auditoría al reclamar o cambiar handle.
6. No acreditar saldos ni abrir pagos durante esta fase.
7. Mantener `user_id` únicamente en APIs administrativas autenticadas.

## Resultado del inventario

La estructura actual permite añadir esta identidad sin migrar cuentas ni modificar el flujo de login, Telegram, compras, saldo, CUP, OxaPay existente o B2B. La siguiente implementación debe limitarse a la migración idempotente, generación de `public_code`, APIs de perfil privado y la base de perfil público detrás de una bandera desactivada.
