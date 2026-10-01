# PARKINLOCK — Backend

API REST del sistema de parqueadero PARKINLOCK.

- Node.js 20+ y Express 5
- MySQL 8 con `mysql2`
- Contraseñas con `bcrypt` y sesiones con JWT
- Roles: **ADMINISTRADOR** y **TRABAJADOR**. Los permisos se verifican en el backend.

## Estructura

```
backend-Parkinlock/
├── database/parkinlock_db.sql   Script de la base de datos (se puede ejecutar varias veces)
├── scripts/                     Asignar contraseñas y revisar sintaxis
├── src/
│   ├── config/                  Variables de entorno y pool de MySQL
│   ├── controllers/             Capa HTTP
│   ├── middleware/              Autenticación, roles y manejo de errores
│   ├── routes/                  Endpoints por módulo
│   ├── services/                Lógica de negocio y consultas SQL
│   ├── utils/                   Reglas puras (cobro, cambio, mensualidad, placa) y validaciones
│   ├── app.js                   Aplicación Express
│   └── server.js                Arranque del servidor
└── test/                        Pruebas unitarias y de integración
```

## Puesta en marcha

1. Instalar las dependencias:

   ```bash
   npm install
   ```

2. Crear la base de datos:

   ```bash
   mysql -u root -p < database/parkinlock_db.sql
   ```

   Se recomienda usar un usuario de MySQL propio de la aplicación, con permisos solo sobre `parkinlock_db`.

3. Copiar `.env.example` como `.env` y completar los valores. El archivo `.env` no se sube a Git.

4. Asignar contraseñas a los usuarios de prueba que crea el script (`admin` y `trabajador`). El script los crea con `contrasena_hash = '<hash>'`, por lo que no pueden iniciar sesión hasta este paso:

   ```bash
   npm run usuarios:contrasena -- admin "UnaClaveSegura"
   npm run usuarios:contrasena -- trabajador "OtraClaveSegura"
   ```

5. Iniciar el servidor:

   ```bash
   npm run dev     # con recarga automática
   npm start       # sin recarga automática
   ```

   El API queda en `http://localhost:3000/api`. Puede comprobarlo con `GET /api/salud`.

## Autenticación

`POST /api/auth/login` con `{ "usuario": "admin", "contrasena": "...", "rol": "ADMINISTRADOR" }`. El campo `usuario` acepta el usuario o el correo, y `rol` es opcional.

La respuesta trae un `token` (JWT, 8 h por defecto). Envíelo en cada petición con:

```
Authorization: Bearer <token>
```

Para cerrar sesión, el frontend descarta el token. En cada petición el backend vuelve a consultar el usuario, así que un cambio de rol o una desactivación se aplica de inmediato.

## Endpoints

Todos los endpoints, salvo `/salud` y `/auth/login`, requieren token. **Admin** significa que solo el ADMINISTRADOR puede usarlo. Si un Trabajador lo intenta, el backend responde `403`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/salud` | Público | Estado del API y de la base de datos |
| POST | `/api/auth/login` | Público | Inicio de sesión |
| GET | `/api/auth/me` | Ambos | Usuario autenticado, permisos y turno abierto |
| GET | `/api/usuarios` | Admin | Listar usuarios |
| GET | `/api/usuarios/:id` | Admin | Consultar usuario |
| POST | `/api/usuarios` | Admin | Crear usuario |
| PUT | `/api/usuarios/:id` | Admin | Actualizar datos, rol o contraseña |
| PATCH | `/api/usuarios/:id/estado` | Admin | Activar o desactivar |
| GET | `/api/clientes` | Ambos | Listar o buscar (`?buscar=`) |
| GET | `/api/clientes/:id` | Ambos | Consultar cliente |
| POST | `/api/clientes` | Ambos | Crear cliente |
| PUT | `/api/clientes/:id` | Ambos | Actualizar cliente |
| GET | `/api/vehiculos/tipos` | Ambos | Tipos de vehículo |
| GET | `/api/vehiculos` | Ambos | Listar vehículos |
| GET | `/api/vehiculos/placa/:placa` | Ambos | Buscar por placa (estado, movimiento abierto y mensualidad) |
| POST | `/api/vehiculos` | Ambos | Registrar vehículo |
| PUT | `/api/vehiculos/:id` | Ambos | Actualizar vehículo |
| GET | `/api/espacios` | Ambos | Mapa de espacios con resumen |
| POST | `/api/espacios/:id/ocupar` | Ambos | Registrar una entrada en ese espacio |
| POST | `/api/espacios/:id/liberar` | Ambos | Liberar un espacio sin vehículo dentro |
| POST | `/api/movimientos/entrada` | Ambos | Registrar entrada |
| GET | `/api/movimientos/activo?placa=` | Ambos | Vehículo dentro y cobro calculado |
| GET | `/api/movimientos/en-operacion` | Ambos | Vehículos dentro del parqueadero |
| GET | `/api/movimientos/historial` | Ambos* | Historial (`?placa=&fecha=`) |
| GET | `/api/movimientos/:id/cobro` | Ambos | Cobro calculado a la hora actual |
| POST | `/api/movimientos/:id/salida` | Ambos | Registrar salida, pago y liberación del espacio |
| GET | `/api/tarifas/vigentes` | Admin | Tarifas vigentes (`?fecha=`) |
| GET | `/api/tarifas/historial` | Admin | Historial de tarifas |
| PUT | `/api/tarifas` | Admin | Configurar tarifas desde una fecha (hoy o futura) |
| POST | `/api/pagos/calcular-cambio` | Ambos | Calcular cambio o faltante |
| GET | `/api/pagos` | Admin | Listar pagos (`?fecha=`) |
| GET | `/api/pagos/:id` | Ambos* | Consultar pago |
| GET | `/api/reservas` | Ambos | Reservas del día (`?fecha=`) |
| POST | `/api/reservas` | Ambos | Crear reserva (PENDIENTE) |
| POST | `/api/reservas/:id/confirmar` | Admin | Confirmar y cobrar la tarifa Reserva |
| POST | `/api/reservas/:id/cancelar` | Admin | Cancelar una reserva pendiente |
| GET | `/api/mensualidades` | Ambos | Listar con estado y resumen (`?placa=&estado=`) |
| GET | `/api/mensualidades/calcular-fin?fecha_inicio=` | Ambos | Fecha de fin según RC-07 |
| POST | `/api/mensualidades` | Admin | Crear mensualidad y registrar su pago |
| GET | `/api/alertas` | Ambos | Alertas activas |
| PATCH | `/api/alertas/:id/atender` | Ambos | Marcar alerta como atendida |
| GET | `/api/turnos/activo` | Ambos | Turno abierto del usuario |
| POST | `/api/turnos` | Ambos | Abrir turno (el Administrador puede abrirlo para otro usuario) |
| POST | `/api/turnos/:id/cerrar` | Ambos* | Cerrar turno con el total recaudado |
| GET | `/api/turnos` | Admin | Listar turnos |
| GET | `/api/panel` | Ambos | Indicadores del panel |

\* El Trabajador solo ve el historial y los pagos de sus propios turnos, y solo puede cerrar su propio turno.

Las entradas, salidas y pagos exigen un **turno abierto**, porque cada pago queda asociado al turno de quien lo cobra.

Los errores se responden como `{ "error": "mensaje", "detalles": {...} }`, con códigos 400 (validación), 401 (sesión), 403 (rol), 404 (no existe) y 409 (conflicto de estado).

## Reglas de negocio

| Regla | Implementación |
|---|---|
| RC-01 y RC-02: Hora y Fracción (≤ 30 min: Fracción; > 30 min: una Hora más) | `src/utils/cobro.js` |
| RC-03: tope Día por cada bloque de 12 horas | `src/utils/cobro.js` |
| RC-04: tope Noche (estadía dentro de 18:00–06:00) | `src/utils/cobro.js` |
| RC-05: vehículo con mensualidad vigente, sin cobro por horas | `src/services/movimientos.service.js` |
| RC-06: la tarifa Reserva se cobra al confirmar | `src/services/reservas.service.js` |
| RC-07: vigencia de un mes desde la fecha de inicio | `src/utils/mensualidad.js` |
| RC-08: cambio = efectivo − valor, sin aceptar efectivo insuficiente | `src/utils/pago.js` |
| RC-09: tarifa vigente del día de la operación | `src/services/tarifas.service.js` |
| RC-10: ACTIVA / POR VENCER (≤ 5 días) / VENCIDA | `src/utils/mensualidad.js` |

Las placas se normalizan a mayúsculas, sin espacios ni guiones (`abc 123` → `ABC123`). Los valores de las tarifas salen de la tabla `tarifas`; el código no tiene valores monetarios fijos.

## Pruebas

```bash
npm test          # unitarias + integración
npm run test:unit # solo reglas puras
npm run check     # revisión de sintaxis de todos los archivos
```

Las pruebas de integración levantan un MySQL 8.4 temporal con `mysql-memory-server`, cargan `database/parkinlock_db.sql` y prueban la API completa. La primera ejecución descarga MySQL (unos 100 MB). Si MySQL no puede iniciarse, esas pruebas se marcan como omitidas.
