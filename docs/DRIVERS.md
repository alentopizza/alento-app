# Repartidores y despacho

Estado: **IMPLEMENTADO Y OPERATIVO**

Última actualización: **2026-10-24**

Este documento es la referencia canónica del flujo de repartidores de Alentó App.

## Acceso

Roles operativos:

- `DRIVER`;
- `DISPATCH` se conserva como rol legacy compatible.

Ruta principal:

- `/repartidor`.

La propia página valida sesión y rol. Operación puede gestionar asignación y disponibilidad desde Pedidos/Mapa De Entregas con los roles permitidos por backend.

## Persistencia principal

`Order`:

- `driverId`;
- `driverAssignedAt`;
- `driverLatitude`;
- `driverLongitude`;
- `driverLocationAccuracy`;
- `driverLocationUpdatedAt`;
- `driverEarningAmount`;
- `driverEarningBase`;
- `driverEarningRatePercent`;
- `driverEarningKind`;
- `driverEarningCreditedAt`;
- `deliveredAt`.

`User`:

- `driverAvailable`;
- ubicación general del repartidor;
- precisión y fecha de última lectura.

`OrderItem` conserva la verificación de despacho por conductor mediante `driverVerifiedAt` y `driverVerifiedDriverId`.

## Home del repartidor

`/repartidor` usa `DriverHome`.

Incluye:

- activar/inactivar disponibilidad;
- GPS general;
- mapa de solicitudes y pedidos propios;
- solicitudes disponibles;
- domicilios ya asignados;
- acceso al detalle;
- autoasignación;
- navegación inferior Solicitudes / Desempeño / Cartera;
- paneles financieros.

Cuando el repartidor se pone inactivo:

- se detiene el seguimiento general;
- se limpian coordenadas generales del servidor;
- no se permite desactivarlo remotamente si todavía mantiene domicilios activos.

Operación puede activar/desactivar un repartidor mediante `/api/drivers/[id]/availability`.

## Solicitudes y autoasignación

Un repartidor disponible puede reclamar pedidos DELIVERY en estados habilitados.

Endpoint:

`POST /api/repartidor/requests/[id]/claim`

Protecciones:

- el pedido debe seguir sin `driverId`;
- el repartidor debe estar disponible;
- se respeta `maxConcurrentDeliveries`;
- se respeta el radio de aceptación cuando aplica;
- la escritura exige `driverId: null` en la condición para evitar que dos repartidores tomen la misma orden;
- si otro repartidor ganó la carrera, la solicitud se rechaza.

La capacidad y geocerca se configuran en `/configuracion`.

## Asignación desde operación

Pedidos y Mapa De Entregas permiten asignar/desasignar.

La desasignación de un pedido que ya estaba `OUT_FOR_DELIVERY` o `ARRIVED` devuelve la orden a `READY` y limpia la verificación correspondiente al conductor anterior.

Pedidos cerrados no permiten nuevas acciones de asignación.

## Detalle firmado

Ruta:

`/repartidor/pedido/[token]`

Responsabilidades:

- mostrar cliente, dirección y contenido;
- mostrar estado de cobro en lenguaje operativo;
- checklist persistente;
- compartir ubicación;
- iniciar navegación;
- avanzar estados.

El checklist vive en base de datos. No usar `localStorage` como fuente de verdad.

Una reasignación no puede reutilizar como válidos los checks hechos por otro conductor.

## Estados de entrega

Flujo:

```text
READY
→ OUT_FOR_DELIVERY
→ ARRIVED
→ DELIVERED
→ COMPLETED
```

Antes de `OUT_FOR_DELIVERY`:

- el checklist debe estar completo;
- debe existir una lectura GPS válida y reciente.

Al marcar `DELIVERED`, el detalle de repartidor se cierra y vuelve a la home al refrescar.

## Navegación y mapas

La navegación usa la ubicación viva del repartidor, el destino y la ruta vigente.

Reglas visuales compartidas:

- documento: `docs/MAPS_VISUAL_SYSTEM.md`;
- pedidos propios asignados usan la semántica visual definida allí;
- rutas múltiples conservan orden de paradas;
- el mapa administrativo muestra pedidos y repartidores;
- el mapa del cliente solo expone la ubicación correspondiente a su orden firmada.

## Seguimiento del cliente

`/seguimiento/[token]` se refresca automáticamente.

Durante la entrega puede mostrar:

- nombre del repartidor;
- ubicación de la moto;
- distancia restante;
- ETA;
- acción de contacto mientras el seguimiento está activo.

Endpoint firmado:

`GET /api/seguimiento/[token]/delivery-live`

No exponer ubicación de otros pedidos ni hacer búsquedas por teléfono arbitrario.

## Desempeño y cartera

Endpoint:

`GET /api/repartidor/finances`

La home muestra:

- entregas del período;
- ganancias;
- movimientos de ganancia;
- pagos realizados al repartidor;
- saldo de cartera.

La ganancia se acredita por pedido entregado y queda congelada en el propio `Order`.

Configuración:

- `earningPercent`: porcentaje del domicilio cobrado;
- `freeDeliveryEarning`: valor fijo cuando el domicilio al cliente fue gratuito.

Cambiar la configuración después no modifica ganancias ya acreditadas.

Los pagos al repartidor se registran como Salidas de Caja asociadas a `driverId`. Si una salida de pago al repartidor se elimina mientras la Caja correspondiente sigue abierta, el valor vuelve a su cartera.

Referencia contable: `docs/PAYMENTS_AND_CASH.md`.

## Archivos principales

- `src/app/repartidor/page.tsx`;
- `src/components/DriverHome.tsx`;
- `src/components/DriverOrderActions.tsx`;
- `src/components/DriverFinancePanels.tsx`;
- `src/app/api/repartidor/**`;
- `src/app/api/drivers/[id]/availability/route.ts`;
- `src/components/AdminDeliveryMapModal.tsx`;
- `src/lib/driverCapacity.ts` cuando aplique;
- `src/lib/deliveryStopOrder.ts`;
- `docs/MAPS_VISUAL_SYSTEM.md`.

## Reglas de no regresión

- no permitir doble asignación;
- no permitir salir sin checklist/GPS requerido;
- no usar estado visual como sustituto de validación backend;
- no perder verificación por conductor;
- no acreditar dos veces una ganancia;
- no recalcular retroactivamente ganancias ya acreditadas;
- no exponer GPS de un repartidor fuera del pedido firmado correspondiente;
- no contar pedidos programados fuera de ventana como solicitudes disponibles.
