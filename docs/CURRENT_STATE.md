# Estado actual del proyecto

Última actualización: 2026-09-17.

Este documento resume el comportamiento real de Alentó App al momento de esta actualización. Para el orden de implementación aprobado ver `docs/ROADMAP.md`; para arquitectura general ver `docs/ARCHITECTURE.md`; para autenticación futura ver `docs/AUTH_ROLES_AND_PUBLIC_APP.md`.

## Fase activa

La prioridad actual es cerrar **Pedidos** y **Cocina** antes de iniciar autenticación.

Orden aprobado:

```text
Pedidos
→ Cocina
→ Validación integrada Pedidos ↔ Cocina
→ Autenticación y Roles
```

No iniciar el bloque de usuarios/login/roles mientras existan pendientes operativos relevantes en Pedidos o Cocina.

Los criterios de cierre de cada fase están definidos en `docs/ROADMAP.md`.

## Estado general

Alentó App ya funciona como sistema operativo interno en construcción para POS, clientes, menú, pedidos, Cocina, pagos, Caja, cupones, configuración e impresión térmica.

Todavía no existe autenticación ni autorización por roles. El sistema interno no debe considerarse protegido para exposición pública hasta completar ese bloque.

## Infraestructura actual

- Next.js 15 + React 19 + TypeScript.
- Tailwind CSS 4.
- Prisma 6 + PostgreSQL.
- EasyPanel/VPS.
- Proyecto EasyPanel: `app_alento`.
- Servicio: `alento-app`.
- Base PostgreSQL: `alento-db`.
- Acceso temporal actual: `pos.alentopizza.com`.
- `alentopizza.com` continúa servido por Glide mientras Alentó App termina su etapa de construcción.

La arquitectura objetivo es un solo dominio principal, no un dominio separado para cada módulo.

## POS

El POS permite Domicilio (`DELIVERY`), Recoger (`PICKUP`) y Local (`STORE`); búsqueda/creación/edición de clientes; catálogo; productos simples; pizzas de uno y dos sabores; tamaños; bordes por tamaño; extras; combos configurables; tarifas manuales de domicilio; descuentos/cupones; medios de pago configurables; efectivo con `Paga con` y `Vueltas`; y creación real de pedidos en PostgreSQL.

Los productos pueden agregarse antes de seleccionar cliente o modalidad. Las validaciones obligatorias se aplican al cierre del pedido.

## Integridad estructurada de productos

`OrderItem.configuration` es la fuente estructurada de lo vendido.

Pizzas conservan IDs y snapshots de tamaño, sabor/sabores, porciones, borde y modificadores. Combos conservan producto combo, reglas, tamaños/sabores, grupos, opciones, cantidades, precios snapshot, `priceDelta` y descuento propio.

Esto es requisito crítico para Cocina, inventario, recetas y costos futuros. Ver `docs/ORDER_DATA_INTEGRITY.md`.

## Creación de pedidos

`POST /api/orders` valida y recalcula server-side. Los pedidos nuevos nacen directamente en `PREPARING`, evitando depender de triggers SQL no aplicados por `prisma db push`.

## Flujo operativo de estados

### Domicilio

```text
PREPARING → PREPARED → READY → OUT_FOR_DELIVERY → ARRIVED → DELIVERED → COMPLETED
```

### Recoger / Local

```text
PREPARING → PREPARED → READY → COMPLETED
```

## Cocina

`/cocina` consume pedidos reales, muestra productos estructurados y permite marcar cantidades preparadas por línea (`preparedQuantity`). Cuando todas las unidades están completas, la orden pasa automáticamente a `PREPARED`; luego Cocina puede marcarla `READY`.

Cocina ya muestra el consecutivo comercial (`POS-0001`, etc.) cuando existe.

La fase de Cocina todavía debe validarse con los escenarios definidos en `docs/ROADMAP.md` antes de considerarse cerrada.

## Pedidos

`/pedidos` usa tarjetas compactas y permite buscar/filtrar, abrir detalle, ver productos, registrar/eliminar pagos, editar modalidad y cantidades, cambiar domicilio, actualizar los datos del cliente asociado, reasignar un pedido activo a otro cliente existente, agregar productos simples, imprimir y eliminar pedidos de prueba/corrección autorizada. Al reasignar un pedido de Domicilio se exige una dirección perteneciente al nuevo cliente.

Si una edición agrega o cambia productos después de que el pedido avanzó, el sistema puede devolverlo a `PREPARING` para que Cocina procese correctamente los cambios.

La fase de Pedidos todavía debe validarse con los escenarios definidos en `docs/ROADMAP.md` antes de considerarse cerrada.

## Eliminación y cancelación

Eliminar pedido significa borrado físico. El servidor elimina atómicamente `Payment → OrderItem → Order`; si algo falla, se revierte todo.

Cancelar conserva el pedido con estado `CANCELED` para trazabilidad.

Eliminar pago también es borrado físico: desaparece y deja de contar en Caja.

## Pagos y Caja

Elegir un medio de pago al crear el pedido no significa que el dinero ya se recibió. Un pago puede permanecer `PENDING` hasta que se registre realmente.

Caja contabiliza únicamente pagos `PAID` con `paidAt`. Si un pedido ya recibió dinero y luego sube de valor, el pago recibido no se reescribe; queda saldo pendiente por la diferencia.

Ver `docs/PAYMENTS_AND_CASH.md`.

## Consecutivo comercial global

`Order.id` es técnico. Los pedidos nuevos usan `Order.sequenceNumber` y `OrderSequence`.

Ejemplo:

```text
POS-0001
POS-0002
WEB-0003
POS-0004
```

Todos los canales comparten la misma secuencia; el prefijo identifica el origen.

La secuencia ya fue probada con `Order.id = 12`, `sequenceNumber = 1`, `source = POS`, cuyo identificador comercial correcto es `POS-0001`.

Pedidos y Cocina ya usan `sequenceNumber`; las demás vistas se migrarán progresivamente sin cambiar los IDs internos usados por APIs.

Ver `docs/ORDER_NUMBERING.md`.

## Impresión

Existe comprobante térmico de 80 mm en `/pedidos/[id]/imprimir`. Es un comprobante operativo, no facturación electrónica fiscal.

## Autenticación y roles — siguiente fase después de Pedidos + Cocina

Actualmente no existe `User` interno, login, contraseña/hash, sesión, middleware, autorización por rol ni protección de APIs internas.

Este bloque está aprobado, pero **no debe iniciarse hasta cerrar Pedidos y Cocina y aprobar el checkpoint integrado**.

Roles iniciales propuestos:

- `ADMIN`
- `POS`
- `KITCHEN`
- `CASHIER`
- `DISPATCH`

La protección debe existir tanto en páginas como en APIs. Ver `docs/AUTH_ROLES_AND_PUBLIC_APP.md`.

## Dominio y app pública futura

`alentopizza.com` está actualmente ocupado por Glide.

La arquitectura objetivo es una sola URL:

```text
alentopizza.com/        → experiencia pública del cliente
alentopizza.com/interno → login y sistema interno
```

No se desea mantener dominios separados permanentemente para POS, Cocina, Caja, etc.

La futura app/web pública reutilizará el mismo catálogo, configuradores, precios, cobertura, pedidos, pagos y configuración estructurada. Sus pedidos usarán `Order.source = WEB` y el mismo consecutivo global.

## Portabilidad / producto replicable

El repositorio debe permanecer claro y desacoplado para poder replicar una instalación para otro restaurante o evolucionar a un producto comercial.

La lógica central no debe depender innecesariamente de datos exclusivos de Alentó Pizza. La arquitectura actual es una instalación por negocio; todavía no es multi-tenant.

## Prisma y producción

Producción usa manualmente:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar un baseline formal. `db push` no ejecuta triggers/functions SQL definidos únicamente en archivos de migración.

## Próximos pasos aprobados

1. Cerrar Pedidos según los criterios de `docs/ROADMAP.md`.
2. Cerrar Cocina según los criterios de `docs/ROADMAP.md`.
3. Ejecutar y aprobar el checkpoint integrado POS → Pedidos → Cocina → Pago → Caja.
4. Agregar `User` y `UserRole` en Prisma.
5. Elegir solución de autenticación.
6. Implementar login/logout y sesión segura.
7. Proteger una ruta piloto.
8. Proteger todas las páginas internas.
9. Proteger todas las APIs internas.
10. Aplicar permisos por rol.
11. Crear administración de usuarios.
12. Continuar Caja/cierres e inventario/costos.
13. Construir experiencia pública.
14. Sustituir Glide y migrar `alentopizza.com`.
