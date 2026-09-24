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
| Pedidos | LISTO CON VALIDACIÓN | detalle, edición, cliente, pagos, estados, cancelación controlada, impresión, driver, mapa de entregas |
| Cocina | LISTO CON VALIDACIÓN | PREPARING → preparación por cantidades → PREPARED/Horneando → READY desde operación |
| Recoger / Local | LISTO CON VALIDACIÓN | PREPARING → PREPARED → READY → COMPLETED; COMPLETED exige saldo pagado |
| Domicilio / Repartidor | LISTO CON VALIDACIÓN | asignación → checklist al estar READY → EN CAMINO → LLEGÓ → ENTREGADO → cierre operativo |
| Reparto múltiple | LISTO CON VALIDACIÓN | límite configurable, orden de paradas, mapa, rutas encadenadas y colores por tramo |
| Geocerca de aceptación | LISTO CON VALIDACIÓN | radio configurable alrededor de Alentó; autoasignación requiere ubicación reciente y estar dentro de zona |
| Seguimiento cliente | LISTO CON VALIDACIÓN | estado firmado, mapa/ETA/moto hasta ARRIVED; GPS continúa hasta DELIVERED, luego se cierra el seguimiento activo y queda historial |
| Checkout WEB | LISTO CON VALIDACIÓN | invitado o sesión → dirección/cobertura → pago previsto → WEB-xxxx → seguimiento |
| Pagos | LISTO CON VALIDACIÓN | intención PENDING, múltiples ingresos PAID, pagos parciales/mixtos, saldo |
| Caja básica | LISTO CON VALIDACIÓN | total diario y desglose por medios usando únicamente PAID |
| Devoluciones / refunds | PENDIENTE CONTROLADO | no existe flujo contable de devolución; se bloquea cancelar un pedido que ya tenga dinero PAID |
| Club Alentó | PARCIAL | acumulación, saldo e historial funcionan; canje transaccional dentro del checkout sigue pendiente |
| Clientes | LISTO CON VALIDACIÓN | CRM, clasificación, historial, direcciones, importación/exportación y permisos |
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

1. Probar geocerca fuera de zona: debe ver solicitudes pero no poder autoasignarse.
2. Entrar en la zona: debe habilitar autoasignación automáticamente.
3. Confirmar que salir de la zona con un pedido ya asignado no lo afecta.
4. Autoasignación.
5. Límite simultáneo.
6. Desasignación.
7. Checklist únicamente en READY.
8. En camino → llegó → entregado.
9. Dos pedidos en ruta y orden 1/2.
10. Otro repartidor no debe ver pedidos ya asignados.
11. No permitir Inactivo con domicilios pendientes.

### WEB

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


## Resultados de validación manual

- ✅ 2026-09-23 — POS → Local: flujo validado correctamente de punta a punta.
- ✅ 2026-09-24 — POS → Recoger: flujo validado correctamente de punta a punta, incluyendo Cocina, READY, pago y COMPLETED con usuario CASHIER.
