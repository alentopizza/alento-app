# Pedidos, edición e impresión

Este documento describe el comportamiento operativo de las órdenes persistidas en Alentó App.

## Creación

Las órdenes se crean desde el POS mediante `POST /api/orders`.

Una orden nueva nace con:

- `source = POS`;
- `status = CONFIRMED`;
- un `Payment` con `status = PENDING`;
- código visual derivado de `Order.id`: `ALT-000001`, `ALT-000002`, etc.

La creación es transaccional: `Order`, `OrderItem` y `Payment` se guardan dentro de una única transacción Prisma.

## Pantalla `/pedidos`

La pantalla de Pedidos muestra:

- código;
- fecha/hora;
- estado;
- modalidad;
- cliente;
- teléfono;
- dirección y zona cuando aplica;
- detalle de cada producto;
- tamaño, sabores, borde y extras cuando la configuración lo permite;
- subtotal;
- domicilio;
- descuento;
- total;
- medio de pago;
- `Paga con` y `Vueltas` para efectivo;
- cupón usado.

Los pedidos históricos creados antes de transportar configuración estructurada usan `POS_SNAPSHOT`; `src/lib/orderPresentation.ts` interpreta el texto guardado para presentar tamaño, sabores, borde, extras y opciones de combo de forma legible.

## Edición controlada

Endpoint:

- `GET /api/orders/[id]`: detalle completo.
- `PATCH /api/orders/[id]`: modificación controlada.

### Regla de estado

Solo una orden con `status = CONFIRMED` puede editarse.

Una vez Cocina la mueva a `PREPARING`, la edición desde Pedidos debe quedar bloqueada. Esto evita modificar una orden que ya está siendo elaborada.

### Cambios permitidos actualmente

- cambiar modalidad entre Domicilio, Recoger en tienda y Local;
- seleccionar tarifa/zona al cambiar a Domicilio;
- modificar cantidades de líneas ya existentes;
- eliminar una línea llevando su cantidad a cero, siempre que el pedido conserve al menos un producto;
- agregar productos simples activos del catálogo, especialmente bebidas y antojos;
- actualizar `Paga con` cuando el medio original es Efectivo y el nuevo total aumenta.

### Cambios no disponibles todavía

- reconfigurar tamaño, sabores, borde o extras de una pizza ya creada;
- agregar una pizza configurable o combo desde el editor de Pedidos;
- cambiar cliente desde el editor;
- cambiar medio de pago desde el editor.

Para agregar una pizza o combo con configuración completa debe usarse por ahora el constructor del POS.

## Recalculo al editar

Al guardar una edición se recalculan:

- subtotal;
- domicilio;
- total;
- `Payment.amount`;
- `changeDue` si el pago es Efectivo.

El descuento monetario ya confirmado se conserva como snapshot histórico y se limita a la nueva base elegible si fuese necesario. En esta etapa no se reevalúa automáticamente el porcentaje de un cupón sobre productos agregados después de la confirmación original.

Si el nuevo total supera `cashReceived`, la API rechaza la edición hasta que el operador actualice `Paga con`.

## Comprobante térmico 80 mm

Ruta:

`/pedidos/[id]/imprimir`

La vista está diseñada para impresora térmica de 80 mm y contiene:

- logo y datos de Alentó Pizza;
- fecha/hora;
- número y código del pedido;
- modalidad destacada;
- cliente y teléfono;
- dirección/zona para domicilio;
- checklist de despacho;
- productos con configuración;
- subtotal, domicilio, descuento y total;
- medio de pago;
- efectivo recibido y vueltas cuando aplica;
- cupón cuando aplica;
- mensaje final.

El botón `Imprimir` ejecuta `window.print()` y los estilos `@media print` de `src/app/globals.css` ocultan toda la interfaz de Alentó App para imprimir únicamente el comprobante a 80 mm.

Este documento es un comprobante operativo/de entrega. La implementación actual no pretende sustituir una factura electrónica fiscal ni un documento equivalente exigido por normativa tributaria.

## Configuración de productos históricos

`OrderItem.configuration` puede contener:

- `PIZZA`: snapshot estructurado de tamaño, sabores, borde y modificadores;
- `COMBO`: pizzas y grupos/opciones del combo;
- `STANDARD`: producto simple;
- `POS_SNAPSHOT`: snapshot transitorio con el detalle textual original del carrito.

`src/lib/orderPresentation.ts` centraliza la presentación de estas variantes para Pedidos e impresión.

## Próximo paso relacionado

Antes de habilitar edición completa de pizzas y combos, el POS debe transportar `CartItem.configuration` estructurada con IDs de tamaño, sabores, borde, modificadores y selecciones de combo. Después el servidor podrá reutilizar el mismo constructor/recalculador en creación y edición.