# Estado actual del proyecto

Última actualización: 2026-09-16.

Este documento resume qué está funcionando hoy y cuál es el siguiente bloque aprobado de desarrollo.

## Ya implementado

### POS

- Selección inicial de tipo de pedido.
- Domicilio, Recoger en tienda y Local.
- Cliente obligatorio para Domicilio y Recoger en tienda.
- Cliente opcional para Local.
- Búsqueda, creación y edición de clientes desde el POS.
- Dirección obligatoria para Domicilio.
- Catálogo por categorías.
- Productos simples, pizzas, dos sabores, tamaños, bordes, ingredientes extra y combos configurables.
- Carrito con cantidades y subtotal.
- Modal compacto de cierre del pedido.
- Tarifa de domicilio seleccionable desde Configuración.
- Medios de pago configurables.
- Cupones y descuento manual.
- Base elegible de descuentos calculada en servidor.
- Combos y productos no acumulables excluidos de cupones/descuentos.
- Efectivo con `Paga con` y cálculo automático de `Vueltas`.
- Creación real y transaccional del pedido en PostgreSQL.
- Confirmación visual del pedido con código `ALT-000001`, `ALT-000002`, etc.

### Pedidos

Existe `/pedidos` para consultar las órdenes persistidas.

La pantalla muestra:

- código del pedido;
- fecha/hora;
- estado;
- tipo de entrega;
- cliente y dirección cuando aplica;
- productos;
- subtotal, domicilio, descuento y total;
- forma de pago;
- efectivo recibido y vueltas cuando aplica;
- cupón usado cuando aplica.

Actualmente lista las 100 órdenes más recientes mediante `GET /api/orders`.

### Cupones

Existe `/cupones` para administrar descuentos reutilizables.

Cada cupón tiene:

- nombre;
- tipo `FIXED` o `PERCENTAGE`;
- valor;
- estado activo/inactivo.

Los cupones activos aparecen automáticamente en el cierre del POS.

### Clientes

- Directorio, búsqueda y edición.
- Dirección principal.
- Protección contra eliminación de clientes con pedidos asociados.

### Menú

- Administración de categorías y productos.
- Categoría Combos.
- Reglas configurables de combos.
- `Product.couponEligible` controla si un producto normal puede recibir descuentos.
- Los `COMBO` quedan siempre excluidos de cupones/descuento manual.

### Configuración

- Ubicación del local.
- Zonas/tarifas de domicilio editables.
- Medios de pago configurables.
- Persistencia mediante `AppSetting`.
- Google Maps no es dependencia operativa actual.

## Flujo real de creación de pedido

### Domicilio

1. Seleccionar Domicilio.
2. Seleccionar/crear cliente con dirección.
3. Agregar productos.
4. Abrir cierre.
5. Seleccionar tarifa/zona de domicilio.
6. Calcular base elegible.
7. Elegir descuento: ninguno, cupón o manual.
8. Elegir medio de pago.
9. Si es Efectivo, indicar `Paga con` y calcular vueltas.
10. Revisar el pedido.
11. Pulsar `Crear pedido`.
12. El servidor valida y crea `Order + OrderItem + Payment` dentro de una transacción.
13. Se muestra el código `ALT-XXXXXX`.
14. `Nuevo pedido` recarga el POS limpio.

Recoger en tienda y Local siguen el mismo cierre, omitiendo la tarifa de domicilio. Recoger requiere cliente; Local permite cliente opcional.

## Persistencia real

`POST /api/orders` crea la orden.

El servidor vuelve a validar antes de persistir:

- tipo de pedido;
- cliente y dirección cuando corresponden;
- existencia/estado de productos;
- tarifa de domicilio activa;
- medio de pago activo;
- elegibilidad de descuentos;
- cupón activo;
- límite del descuento manual;
- efectivo recibido cuando aplica.

La escritura se realiza con `prisma.$transaction` para crear de forma atómica:

- `Order`;
- sus `OrderItem`;
- su `Payment`.

Si la transacción falla, no debe quedar una orden parcial.

## Estado inicial de una orden POS

Una orden creada desde el POS nace con:

- `status = CONFIRMED`;
- `source = POS`;
- pago con `status = PENDING`.

El siguiente módulo debe definir cuándo el pago pasa a `PAID` y cómo avanza el estado operativo desde Cocina/Caja.

## Snapshot comercial en Order

Además de los totales, `Order` guarda snapshots para conservar el contexto histórico:

- `couponId`;
- `couponName`;
- `discountSource` (`NONE`, `COUPON`, `MANUAL`);
- `deliveryZoneId`;
- `deliveryZoneName`;
- `deliveryFee`;
- `discount`;
- `subtotal`;
- `total`.

Así un pedido histórico no cambia aunque luego se renombre una tarifa o un cupón.

## OrderItem y configuración

Cada línea guarda:

- `productId`;
- `productName`;
- `unitPrice`;
- `quantity`;
- `lineTotal`;
- `configuration` JSON.

### Estado transitorio importante

El constructor visual actual del POS todavía no transporta todos los IDs estructurados de pizzas y combos dentro de `CartItem`.

Por eso, mientras se completa esa refactorización, `POST /api/orders` guarda para esas líneas un snapshot `POS_SNAPSHOT` con el detalle legible que vio el operador y el precio calculado por el POS.

Productos estándar sí pueden verificarse directamente contra su precio actual en PostgreSQL.

**Pendiente recomendado:** enriquecer `CartItem.configuration` con IDs de tamaño, sabores, borde, modificadores y selecciones de combo. La API ya acepta un campo `configuration` y debe evolucionar para recalcular completamente pizzas/combos del lado servidor antes de crear la orden.

## Reglas de descuentos

Un pedido usa una sola fuente:

- `NONE`;
- `COUPON`;
- `MANUAL`.

No se acumula cupón + manual.

La base elegible excluye:

- domicilio;
- combos;
- productos con `couponEligible = false`.

La elegibilidad se consulta mediante `POST /api/discount/eligibility` y se recalcula nuevamente durante la creación del pedido.

## Regla de efectivo y vueltas

Para Efectivo:

- `Payment.cashReceived` = valor entregado por el cliente;
- `Payment.changeDue` = `cashReceived - total`;
- no se crea el pedido si `cashReceived < total`.

En Domicilio indica las vueltas que debe llevar el domiciliario. En Local/Recoger ayuda al cajero.

## APIs principales

- `GET /api/catalog`
- `GET/POST /api/customers`
- `PATCH/DELETE /api/customers/[id]`
- `GET/PUT /api/settings`
- `GET/POST /api/coupons`
- `PATCH/DELETE /api/coupons/[id]`
- `POST /api/discount/eligibility`
- `GET /api/orders`: lista pedidos recientes.
- `POST /api/orders`: crea una orden real.
- `POST /api/delivery/quote`: reservado para automatización futura por distancia.

## Base de datos / despliegue

El schema actual incluye, entre otros cambios recientes:

- modelo `Coupon`;
- `Product.couponEligible`;
- `Payment.cashReceived`;
- `Payment.changeDue`;
- `Order.deliveryZoneId`;
- `Order.deliveryZoneName`;
- `Order.discountSource`.

Como producción sigue sin baseline formal de Prisma Migrate, después de desplegar esta versión se debe ejecutar:

```bash
npx prisma db push
```

No usar `prisma migrate deploy`.

## Pendiente inmediato

Con pedidos reales ya creados, el siguiente bloque recomendado es conectar la operación:

1. Cocina leyendo órdenes `CONFIRMED`.
2. Cambio de estados `CONFIRMED → PREPARING → READY`.
3. Flujo posterior según tipo: domicilio, recoger o local.
4. Definir cuándo `Payment.status` pasa de `PENDING` a `PAID`.
5. Mejorar detalle estructurado de pizzas/combos en `OrderItem.configuration`.
6. Después, Caja y conciliación.

## Regla de continuidad

Todo cambio funcional o estructural debe actualizar este documento y/o `ARCHITECTURE.md` en el mismo bloque de trabajo. Ver `docs/HANDOFF.md`.