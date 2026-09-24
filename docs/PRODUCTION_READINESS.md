# Revisión de preparación para producción

Fecha de revisión: **2026-09-23**

Objetivo: revisar el proyecto por **funcionamiento completo de procesos**, no por acabado estético.

Esta revisión toma como fuente principal el código vigente de `main`, `prisma/schema.prisma` y la documentación canónica.

## Criterio

Estados usados:

- **LISTO**: el proceso principal existe de extremo a extremo para el alcance actual;
- **LISTO CON VALIDACIÓN**: está implementado, pero necesita prueba operativa en producción antes del go-live;
- **PENDIENTE CONTROLADO**: falta una capacidad conocida, pero el sistema tiene una restricción segura para no corromper datos;
- **NO ES NÚCLEO**: extensión exclusiva de Alentó, no bloquea el producto base.

---

## Matriz funcional

| Proceso | Estado | Cobertura actual |
| --- | --- | --- |
| Menú / catálogo | LISTO | administración, orden, destacados, productos, pizzas, combos y catálogo compartido |
| POS interno | LISTO CON VALIDACIÓN | carrito estructurado → modalidad → cliente/dirección → descuento → intención de pago → creación real de Order |
| Domicilio POS | LISTO CON VALIDACIÓN | dirección Google → Routes server-side → cobertura → tarifa automática; también al editar |
| Cobertura / tarifas de domicilio | LISTO CON VALIDACIÓN | editor ADMIN de zonas por distancia, tarifa, activar/desactivar, agregar/eliminar, cobertura máxima y mapa visual por radios; el cobro real sigue usando Google Routes |
| Pedidos | LISTO CON VALIDACIÓN | detalle, edición, cliente, corrección de dirección desde Editar cliente con recálculo server-side, pagos, estados, cancelación controlada, impresión, driver, mapa de entregas |
| Cocina | LISTO CON VALIDACIÓN | PREPARING → preparación por cantidades → PREPARED/Horneando → READY desde operación |
| Recoger / Local | LISTO CON VALIDACIÓN | PREPARING → PREPARED → READY → COMPLETED; COMPLETED exige saldo pagado |
| Domicilio / Repartidor | LISTO CON VALIDACIÓN | asignación → checklist al estar READY → EN CAMINO → LLEGÓ → ENTREGADO → cierre operativo; mapa ADMIN con repartidores y pedidos interactivos, detalle de carga y asignación directa desde pin antes de iniciar ruta |
| Reparto múltiple | LISTO CON VALIDACIÓN | límite configurable, orden de paradas, mapa, rutas encadenadas, colores por tramo y agrupación de pedidos superpuestos con expansión individual |
| Geocerca de aceptación | LISTO CON VALIDACIÓN | radio configurable alrededor de Alentó; autoasignación requiere ubicación reciente y estar dentro de zona |
| Seguimiento cliente | LISTO CON VALIDACIÓN | estado firmado, mapa/ETA/moto hasta ARRIVED; GPS continúa hasta DELIVERED, luego se cierra el seguimiento activo y queda historial |
| Checkout WEB | LISTO CON VALIDACIÓN | invitado o sesión → dirección/cobertura → pago previsto → WEB-xxxx → seguimiento |
| Pagos | LISTO CON VALIDACIÓN | intención PENDING, múltiples ingresos PAID, pagos parciales/mixtos, saldo |
| Caja básica | LISTO CON VALIDACIÓN | total diario y desglose por medios usando únicamente PAID |
| Devoluciones / refunds | PENDIENTE CONTROLADO | no existe flujo contable de devolución; se bloquea cancelar un pedido que ya tenga dinero PAID |
| Club Alentó | PARCIAL | acumulación, saldo e historial funcionan; canje transaccional dentro del checkout sigue pendiente |
| Clientes | LISTO CON VALIDACIÓN | CRM, clasificación, historial, dirección Google con ajuste manual del pin, importación/exportación y permisos |
| Cupones | LISTO CON VALIDACIÓN | administración y aplicación server-side en POS según elegibilidad |
| Usuarios / roles | LISTO CON VALIDACIÓN | login, roles, permisos sensibles y protección de rutas principales |
| Recuperación de contraseña / revocación central | PENDIENTE CONTROLADO | no implementado; las sesiones internas siguen siendo stateless |
| WhatsApp / notifier | NO ES NÚCLEO | extensión externa de Alentó; operación principal no debe depender de ella |
| Chatwoot | NO ES NÚCLEO | integración exclusiva de la infraestructura Alentó |
| Preparación de masa | NO ES NÚCLEO | receta y proceso exclusivos de Alentó |

---

## Flujo POS: cobertura real

El POS cubre su responsabilidad completa:

```text
Catálogo
→ carrito
→ configuración estructurada
→ modalidad
→ cliente/dirección
→ descuento
→ medio previsto
→ POST /api/orders
→ Order + OrderItem + Payment PENDING
→ PREPARING o READY
```

El POS **no** marca dinero como recibido. Esa es una decisión correcta del modelo actual: la recepción real se registra después en Pedidos.

La orden creada entra automáticamente en las superficies operativas correspondientes.

---

## Flujo operativo completo de un pedido

### Con Cocina

```text
POS o WEB
→ PREPARING
→ Cocina completa cantidades
→ PREPARED (Horneando)
→ operación marca READY
```

### Recoger / Local

```text
READY
→ cobro real en Pedidos
→ COMPLETED
```

El backend impide `COMPLETED` si existe saldo pendiente.

### Domicilio

```text
READY
→ repartidor asignado
→ checklist de productos
→ OUT_FOR_DELIVERY
→ ARRIVED
→ DELIVERED
→ operación financiera/final
→ COMPLETED
```

El repartidor no puede salir antes de READY ni verificar productos antes de READY.

---

## Correcciones de endurecimiento realizadas durante esta revisión

Se corrigieron antes de declarar esta revisión:

1. `/masa`, `/notificaciones` y `/club-alento` ahora tienen protección explícita por rol en middleware.
2. `PUT /api/club-settings` exige `ADMIN`.
3. Un invitado WEB que conoce el teléfono de un cliente ya no puede reemplazar su dirección privada guardada sin una sesión verificada.
4. La edición de un domicilio ya no permite elegir manualmente una tarifa: vuelve a calcular Google Routes y la banda en servidor.
5. El endpoint legacy de edición usa la misma regla de tarifa automática.
6. Mientras no exista un flujo de refund, se bloquea cancelar pedidos con pagos `PAID` para no borrar trazabilidad financiera.
7. La respuesta de este bloqueo se muestra en un modal visual propio de Alentó; no se usa `window.alert` para esta restricción financiera.

---

## Riesgos que deben resolverse o aceptarse antes del go-live

### 1. Prisma en cada arranque — prioridad alta

Hoy `npm run start` ejecuta:

```bash
prisma db push && next start -p 3000
```

Por lo tanto un redeploy/restart puede modificar el schema automáticamente.

Antes de producción estable se recomienda:

- tomar backup/snapshot de PostgreSQL;
- congelar cambios de schema durante el go-live;
- separar la sincronización de schema del arranque normal;
- preparar un baseline de Prisma Migrate;
- después usar migraciones revisadas y `prisma migrate deploy`.

No cambiar de estrategia a ciegas sobre la base actual: primero hacer backup y baseline.

### 2. No existe CI ni suite automatizada — prioridad alta

El repositorio no tiene workflow de CI ni script de pruebas.

Antes del go-live, como mínimo cada commit destinado a producción debe validar:

```bash
npm ci
npm run lint
npm run build
```

La siguiente mejora recomendada es convertir esto en GitHub Actions y luego añadir pruebas de integración para pedidos/pagos/roles.

### 3. Refund / devolución — prioridad alta si se reciben pagos anticipados

No existe todavía un movimiento contable de devolución.

La aplicación ahora protege la trazabilidad bloqueando la cancelación de un pedido que ya tenga `PAID`.

Antes de permitir cancelaciones después del cobro se necesita un flujo explícito de `REFUNDED`.

### 4. Caja avanzada — prioridad media

Caja básica registra correctamente dinero recibido, pero aún no existe:

- apertura/cierre por turno;
- arqueo;
- retiros/gastos;
- conciliación bancaria/digital;
- devolución;
- responsable del movimiento.

Esto no impide operar si Alentó acepta una Caja de movimientos diarios como alcance V1.

### 5. Autenticación interna — prioridad media

Ya existe autenticación real, pero faltan:

- recuperación de contraseña;
- revocación central inmediata de sesiones;
- auditoría completa de cambios;
- segundo factor.

La cookie interna actual tiene duración larga y debe considerarse una decisión consciente de riesgo.

### 6. Club — decisión de producto

La acumulación está implementada. El canje todavía no.

Para producción hay que decidir una de dos:

- lanzar Club como **acumulación + consulta**, indicando que el canje llegará después; o
- bloquear/promocionar menos el canje hasta implementar la redención transaccional.

---

## Validación manual obligatoria antes de abrir producción

### POS

Antes de probar domicilio, validar en Configuración que las zonas activas sean continuas y que la cobertura máxima coincida con la operación real.

1. Crear Local solo con bebidas.
2. Crear Local/Pickup con pizza.
3. Crear Domicilio con dirección Google válida.
4. Probar fuera de cobertura.
5. Probar cupón y descuento manual.
6. Probar efectivo, Nequi/tarjeta u otros medios configurados.
7. Confirmar código POS consecutivo.

### Cocina

1. Pedido de 1 pizza.
2. Pedido de 2 unidades.
3. Combo con pizza + bebida.
4. Pedido solo bebidas.
5. Editar nota/cantidad y confirmar que vuelve a Cocina cuando corresponde.

### Pedidos / pagos

1. Registrar pago total.
2. Registrar dos pagos parciales.
3. Cambiar medio respecto al previsto.
4. Eliminar un pago erróneo y verificar saldo.
5. Intentar COMPLETED con saldo: debe bloquear.
6. COMPLETED con saldo cero: debe funcionar.
7. Intentar cancelar un pedido con PAID: debe bloquear hasta existir refund.

### Domicilio / repartidor

Regla de no regresión: el seguimiento del cliente permanece visible también en ARRIVED ("Llegó") y la ubicación continúa actualizándose hasta DELIVERED. Al marcar DELIVERED, el seguimiento activo se cierra, desaparece de pedidos en proceso y la pantalla pública muestra una notificación breve "Pedido XXXX fue entregado"; el detalle posterior queda en el historial de /cuenta. No existe un sexto paso visual "Entregado" dentro del seguimiento activo.

El repartidor debe ver el estado de pago en español y con señal visual operacional: **Pagado** en verde cuando la suma de movimientos PAID cubra el total; **Pendiente por cobrar** o **Pago parcial** en rojo cuando todavía exista saldo. Nunca mostrar al repartidor estados crudos en inglés como PENDING/PAID para decidir si debe cobrar.

Durante OUT_FOR_DELIVERY y ARRIVED el cliente puede contactar por llamada al repartidor desde el encabezado del mapa en vivo. El teléfono del repartidor solo se expone en el endpoint firmado de seguimiento mientras ese seguimiento está activo; después de DELIVERED/COMPLETED deja de devolverse.

Regla visual: el código del pedido debe quedar visible en la cabecera tanto para cliente como para repartidor. En seguimiento cliente no existe botón fijo "Volver al menú": se usa una X superior igual a la del detalle del repartidor y dirige a /menu. El nombre del repartidor se muestra en mayúscula y el botón de llamada queda inmediatamente junto al nombre.

1. Probar geocerca fuera de zona: debe ver solicitudes pero no poder autoasignarse.
2. Entrar en la zona: debe habilitar autoasignación automáticamente.
3. Confirmar que salir de la zona con un pedido ya asignado no lo afecta.
4. Autoasignación.
5. Límite simultáneo.
6. Desasignación. Los pedidos DELIVERED, COMPLETED o CANCELED pueden conservar visualmente el repartidor histórico, pero no deben mostrar la acción **Desasignar**; el backend también debe rechazarla. Los pedidos finalizados no muestran el botón **ESTADOS** ni permiten abrir el selector operativo. Dentro del selector, la gestión del repartidor también queda deshabilitada desde DELIVERED en adelante.
7. Checklist únicamente en READY.
8. En camino → llegó → entregado.
9. Dos pedidos en ruta y orden 1/2.
10. Otro repartidor no debe ver pedidos ya asignados.
11. No permitir Inactivo con domicilios pendientes.

### WEB

Regla visual: si una dirección está fuera de cobertura, la alerta de fuera de cobertura debe mostrarse superpuesta dentro del mapa y permitir **Editar dirección** o cambiar directamente a **Recoger en tienda**.

Regla de privacidad: la UI no debe afirmar que un teléfono ya compró solo porque tenga formato válido. Antes del OTP se usa un mensaje neutral **Verificar mi número**; la existencia de un Customer no se revela públicamente.

Regla de cierre público: para PICKUP/STORE, COMPLETED cierra el seguimiento activo inmediatamente, redirige al menú y muestra una notificación breve **"Pedido XXXX fue finalizado"**. No existe un paso visual "Finalizado" dentro del seguimiento activo; el detalle posterior queda en el historial de /cuenta.

1. Compra invitado.
2. Cliente autenticado.
3. Domicilio y Recoger.
4. Confirmar que un invitado con teléfono existente no modifica la dirección principal privada.
5. Seguimiento firmado.
6. Tracking en vivo durante reparto.

### Roles

Validar con usuarios reales separados:

- ADMIN;
- POS;
- KITCHEN;
- CASHIER;
- DRIVER.

No validar roles únicamente desde una sesión ADMIN.

---

## Dependencias externas

Google Maps/Routes sí forma parte del funcionamiento actual del domicilio y debe estar configurado.

Las siguientes integraciones son opcionales/exclusivas de Alentó y se documentan aparte:

`docs/ALENTO_EXCLUSIVE_MODULES.md`.

---

## Criterio de salida recomendado

No declarar “producción estable” solo porque el build arranca.

Para el go-live funcional de Alentó:

1. completar la lista manual anterior;
2. backup de base;
3. decidir estrategia de Prisma;
4. confirmar variables de entorno/secrets;
5. validar dominio/HTTPS;
6. validar Maps con restricciones;
7. confirmar alcance de Club;
8. dejar refund bloqueado hasta implementarlo;
9. realizar un pedido real de punta a punta por cada modalidad;
10. observar logs durante el primer turno completo.


## Incidencias encontradas durante la validación manual

### 2026-09-23 — CASHIER en POS

Primera prueba de producción:

`CASHIER → /interno → buscar cliente`

Resultado inicial: `403 Sin permisos`.

Causa: el rol `CASHIER` tenía acceso a la página del Punto de Venta, pero middleware bloqueaba APIs necesarias para completar el mismo flujo.

Corregido:

- búsqueda/creación/actualización operativa de clientes;
- lectura de cupones;
- elegibilidad de descuentos;
- APIs de domicilio requeridas por POS;
- creación de pedidos `POST /api/orders`;
- actualización de la dirección propia del cliente por sesión pública ya no queda interceptada como API staff.

Regla de no regresión: **si un rol puede entrar al POS, debe poder completar el flujo POS de punta a punta**. El acceso a APIs operativas no implica acceso a la página CRM `/clientes`.

### 2026-09-24 — CASHIER al actualizar estado

Durante la prueba `POS → Recoger`, el usuario CASHIER pudo crear y consultar el pedido, pero recibió `403 Sin permisos` al intentar cambiar el pedido de Horneando/PREPARED a Listo/READY.

Causa: el middleware permitía `PATCH /api/orders/[id]/status` a ADMIN, POS y KITCHEN, pero no a CASHIER, aunque CASHIER tiene acceso funcional a Pedidos.

Corregido: `CASHIER` también puede ejecutar transiciones operativas de estado desde Pedidos. Las validaciones de flujo, saldo y modalidad continúan aplicándose en el endpoint.

### 2026-09-24 — CASHIER al editar pedido

Durante la regresión de Cocina del Paso 13, un usuario CASHIER podía abrir **Editar pedido**, pero al guardar cambios recibía `403 No tienes permiso para editar pedidos`.

Causa: la página Pedidos y el middleware ya permitían al CASHIER consultar la orden, pero la autorización interna de `PATCH /api/orders/[id]` todavía limitaba la edición a ADMIN/POS. El endpoint legacy `/api/orders/[id]/edit` también conservaba la misma restricción en middleware.

Corregido: CASHIER puede editar pedidos activos para ajustar cantidades, agregar productos y modificar notas de cocina. Cancelar/eliminar continúan protegidos por permisos sensibles separados, y las reglas de saldo, estado cerrado y tarifa automática de domicilio permanecen intactas.

Regla de no regresión: **si CASHIER opera Pedidos, debe poder corregir el contenido de una orden activa sin recibir acceso implícito a cancelación o eliminación**.

### 2026-09-24 — CASHIER al asignar repartidor

Durante la validación de reparto múltiple del Paso 14, un usuario CASHIER podía abrir la gestión de estados y seleccionar un repartidor, pero la asignación respondía `403 Sin permisos`.

Causa: el endpoint `POST /api/orders/[id]/driver` ya autorizaba ADMIN/POS/CASHIER internamente, pero el middleware no tenía una regla específica para `/driver` y caía en la regla genérica de escritura de pedidos, limitada a ADMIN/POS.

Corregido: el middleware permite ADMIN/POS/CASHIER en `/api/orders/[id]/driver` tanto para asignar como para desasignar. Las validaciones de capacidad, estado del pedido, WhatsApp del repartidor y protección de pedidos cerrados permanecen en el backend.

Regla de no regresión: **CASHIER puede gestionar repartidores de pedidos a domicilio desde Pedidos sin adquirir permisos sensibles de cancelación o eliminación**.


## Resultados de validación manual

- ✅ 2026-09-23 — POS → Local: flujo validado correctamente de punta a punta.
- ✅ 2026-09-24 — POS → Recoger: flujo validado correctamente de punta a punta, incluyendo Cocina, READY, pago y COMPLETED con usuario CASHIER.
- ✅ 2026-09-24 — POS → Domicilio: flujo validado correctamente de punta a punta, incluyendo tarifa automática, asignación y geocerca del repartidor, navegación y recálculo de ruta, seguimiento cliente hasta ARRIVED, contacto cliente↔repartidor, estado de pago visible para el repartidor y cierre de seguimiento al marcar DELIVERED.
- ✅ 2026-09-24 — POS → Solo bebidas: pedido validado correctamente sin bloqueo de Cocina y con entrada directa a READY/Listo.
- ✅ 2026-09-24 — WEB → Recoger: flujo validado correctamente de punta a punta, incluyendo creación WEB-XXXX, seguimiento de estados y cierre automático del seguimiento con aviso al pasar a COMPLETED/Finalizado.
- ✅ 2026-09-24 — WEB → Domicilio: flujo validado correctamente de punta a punta, incluyendo compra como invitado, cobertura y tarifa automáticas, privacidad de direcciones de clientes existentes, creación WEB-XXXX, asignación/reparto y seguimiento público hasta cierre.
- ✅ 2026-09-24 — Roles y permisos: validación manual aprobada con usuarios reales separados; los accesos y restricciones principales por rol funcionan según la matriz vigente.
- ✅ 2026-09-24 — Pagos y Caja: validación manual aprobada; registro de pago, saldo en cero, medio de pago y total diario de Caja funcionan correctamente.
- ✅ 2026-09-24 — Pagos parciales y mixtos: validación manual aprobada; múltiples movimientos PAID reducen correctamente el saldo, conservan sus medios de pago y Caja suma los ingresos sin duplicar el pedido.
- ✅ 2026-09-24 — Eliminación de pago erróneo: validación manual aprobada; al eliminar un movimiento PAID se recalculan saldo y estado de cobro, y Caja descuenta correctamente el valor eliminado.
- ✅ 2026-09-24 — Bloqueo de cierre con saldo pendiente: validación manual aprobada; un pedido con saldo por cobrar no puede pasar a COMPLETED/Finalizado hasta registrar el pago completo.
- ✅ 2026-09-24 — Cancelación de pedido pagado: validación manual aprobada; un pedido con movimientos PAID queda protegido contra cancelación mientras no exista un flujo auditable de devolución/refund. Caja y los pagos se conservan.
- ✅ 2026-09-24 — Cocina / regresión final: validación manual aprobada, incluyendo edición de pedidos activos por CASHIER, ajuste de cantidades/productos/notas y retorno correcto al flujo de Cocina cuando corresponde.
- ✅ 2026-09-24 — Reparto múltiple: validación manual aprobada con dos domicilios simultáneos para un mismo repartidor, orden de paradas, rutas encadenadas, capacidad máxima y agrupación/expansión de pedidos superpuestos en Repartidor y Mapa De Entregas.


### 2026-09-24 — Migración histórica de Glide

Se añadió una migración ADMIN de una sola ejecución para reconstruir historial de compra por cliente desde `Pedidos.csv`.

Decisiones:

- no conservar los IDs/consecutivos de Glide;
- generar nuevo consecutivo Alentó desde 0001 en orden cronológico;
- vincular clientes por teléfono y crear faltantes;
- importar pedidos como COMPLETED sin activar Cocina, reparto, Club ni notificaciones;
- reconstruir líneas de productos desde el snapshot textual, incluyendo configuración de pizzas y bebida de Combo Antojo cuando existe;
- regularizar registros NO PAGADO como pago histórico en Efectivo;
- bloquear una segunda ejecución mediante AppSetting;
- exigir Pedidos vacío para garantizar que el histórico arranque en 0001.
