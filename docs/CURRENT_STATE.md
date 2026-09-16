# Estado actual del proyecto

Última actualización: 2026-09-16.

Este documento resume qué está funcionando hoy y cuál es el siguiente bloque aprobado de desarrollo. Para reglas específicas de pedidos, edición e impresión ver `docs/ORDERS.md`.

## Ya implementado

### POS

- Selección de Domicilio, Recoger en tienda o Local.
- Cliente obligatorio para Domicilio y Recoger; opcional para Local.
- Búsqueda, creación y edición de clientes.
- Dirección obligatoria para Domicilio.
- Catálogo por categorías.
- Productos simples, pizzas, dos sabores, tamaños, bordes, extras y combos configurables.
- Carrito con cantidades y subtotal.
- Tarifas de domicilio desde Configuración.
- Medios de pago configurables.
- Cupones y descuento manual.
- Base elegible calculada en servidor: domicilio, combos y productos no acumulables quedan excluidos.
- Efectivo con `Paga con` y `Vueltas`.
- Creación real y transaccional en PostgreSQL.
- Confirmación con código `ALT-XXXXXX`.

### Pedidos

`/pedidos` ya funciona con órdenes persistidas y ahora ofrece:

- detalle completo de productos;
- tamaño, sabor/sabores, borde y extras cuando están disponibles en `OrderItem.configuration`;
- interpretación de pedidos históricos `POS_SNAPSHOT` para mostrar su detalle legible;
- cliente, teléfono, dirección y zona;
- subtotal, domicilio, descuento y total;
- pago, efectivo recibido y vueltas;
- cupón;
- botón `Editar pedido`;
- botón `Imprimir 80 mm`.

### Edición controlada

API:

- `GET /api/orders/[id]`;
- `PATCH /api/orders/[id]`.

Regla principal: **solo pedidos `CONFIRMED` pueden editarse**. Cuando Cocina cambie el estado a `PREPARING`, la edición se bloquea.

La edición actual permite:

- cambiar Domicilio / Recoger / Local;
- seleccionar zona/tarifa al pasar a Domicilio;
- cambiar cantidades de líneas existentes;
- eliminar una línea llevando cantidad a cero;
- agregar productos simples activos como bebidas o antojos;
- actualizar `Paga con` si el pedido en efectivo aumenta de valor.

Por seguridad, todavía no permite reconfigurar una pizza/ combo existente ni agregar una nueva pizza/combo configurable desde el editor. Para eso se reutilizará después el constructor del POS.

Al editar se recalculan subtotal, domicilio, total, valor del pago y vueltas. El descuento monetario ya confirmado se conserva como snapshot histórico, limitado por la nueva base elegible cuando corresponde.

### Impresión térmica 80 mm

Ruta:

`/pedidos/[id]/imprimir`

Genera un comprobante operativo inspirado en el formato suministrado por Alentó Pizza con:

- logo y datos del local;
- fecha/hora;
- número/código;
- modalidad;
- cliente;
- dirección/zona;
- checklist de despacho;
- productos con configuración;
- subtotal, domicilio, descuento y total;
- medio de pago;
- `Paga con` y `Vueltas`;
- cupón.

El botón `Imprimir` usa `window.print()`. Los estilos de `globals.css` ocultan el resto de la app durante impresión y limitan el comprobante a 80 mm.

Este comprobante no se declara como factura electrónica fiscal; es un comprobante operativo/de entrega.

### Cupones

`/cupones` administra cupones `FIXED` y `PERCENTAGE`, activos/inactivos. Un pedido usa una sola fuente: `NONE`, `COUPON` o `MANUAL`.

### Clientes

- Directorio, búsqueda y edición.
- Dirección principal.
- Protección contra eliminación si existen pedidos asociados.

### Menú

- Administración de categorías/productos.
- Combos configurables.
- `Product.couponEligible` controla acumulación de descuentos.
- `COMBO` siempre queda excluido del descuento.

### Configuración

- Ubicación del local.
- Zonas/tarifas de domicilio.
- Medios de pago.
- Persistencia en `AppSetting`.
- Google Maps queda como automatización futura.

## Persistencia de pedidos

`POST /api/orders` valida y crea de forma atómica:

- `Order`;
- `OrderItem`;
- `Payment`.

Una orden POS nace con:

- `status = CONFIRMED`;
- `source = POS`;
- `Payment.status = PENDING`.

`Order` conserva snapshots de zona, cupón, origen del descuento y valores monetarios para que el historial no cambie si la configuración futura cambia.

## Configuración de OrderItem

`OrderItem.configuration` puede contener:

- `PIZZA`;
- `COMBO`;
- `STANDARD`;
- `POS_SNAPSHOT`.

`src/lib/orderPresentation.ts` centraliza cómo convertir esa configuración en detalle visual para `/pedidos` y el comprobante térmico.

Estado transitorio: el constructor actual del POS todavía genera `POS_SNAPSHOT` para parte de pizzas/combos porque `CartItem` no transporta todos los IDs estructurados. El siguiente refactor de catálogo debe guardar IDs de tamaño, sabores, borde, extras y opciones de combo para que el servidor pueda recalcular todo independientemente del navegador.

## Reglas de descuentos

La base elegible excluye:

- domicilio;
- combos;
- productos con `couponEligible = false`.

No se acumula cupón + descuento manual.

En una orden ya confirmada y posteriormente editada, el valor monetario del descuento original se conserva; por ahora no se reevalúa automáticamente un porcentaje de cupón sobre nuevos productos añadidos durante la edición.

## Efectivo

- `cashReceived` = valor entregado por el cliente.
- `changeDue = cashReceived - total`.
- Si una edición incrementa el total por encima de `cashReceived`, la API exige actualizar `Paga con` antes de guardar.

## APIs principales

- `GET /api/catalog`
- `GET/POST /api/customers`
- `PATCH/DELETE /api/customers/[id]`
- `GET/PUT /api/settings`
- `GET/POST /api/coupons`
- `PATCH/DELETE /api/coupons/[id]`
- `POST /api/discount/eligibility`
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/[id]`
- `PATCH /api/orders/[id]`
- `POST /api/delivery/quote` reservado para mapas futuros.

## Base de datos / despliegue

Producción sigue sin baseline formal de Prisma Migrate. Para cambios de schema usar:

```bash
npx prisma db push
```

No usar `prisma migrate deploy`.

**El bloque de detalle/edición/impresión descrito en esta actualización no agrega nuevas columnas respecto al schema usado para la persistencia real de órdenes; si ese schema ya fue sincronizado, no requiere otro `db push`.**

## Pendiente inmediato

El siguiente bloque recomendado es Cocina:

1. leer órdenes `CONFIRMED`;
2. mostrar configuración detallada para preparación;
3. cambiar estados `CONFIRMED → PREPARING → READY`;
4. bloquear edición una vez pasa a `PREPARING`;
5. resolver flujo final según Domicilio / Recoger / Local;
6. definir cuándo `Payment.status` cambia a `PAID`.

Después: Caja, conciliación y refactor estructurado completo de configuraciones de pizza/combo.

## Regla de continuidad

Todo cambio funcional o estructural debe actualizar este documento y/o la documentación especializada en el mismo bloque. Ver `docs/HANDOFF.md`.