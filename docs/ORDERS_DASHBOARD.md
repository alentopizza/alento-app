# Dashboard de Pedidos

La ruta `/pedidos` usa una vista de tarjetas compactas orientada a operación rápida.

## Objetivo

Cada pedido aparece una sola vez. La tarjeta debe permitir identificarlo y operar sin llenar la pantalla de detalle que solo se necesita ocasionalmente.

## Header

La página usa un hero oscuro consistente con el POS:

- etiqueta `Operación`;
- título `Pedidos`;
- texto `Una orden, un estado actual y una acción clara.`;
- contador de pedidos activos;
- actualización manual.

## Búsqueda y filtros

Permite buscar por código ALT, cliente, teléfono, estado y medio de pago.

Filtros rápidos:

- Todos;
- Activos;
- Finalizados;
- Cancelados.

La información se refresca automáticamente cada 15 segundos.

## Tarjeta moderna

Cada tarjeta usa una franja superior con el color del estado actual y una estructura visual más densa:

- estado actual;
- modalidad: Domicilio, Recoger o Local;
- fecha/hora;
- código `ALT-xxxxxx`;
- cantidad de líneas y unidades;
- cliente y contacto resumido;
- total;
- saldo o pago recibido;
- acción principal del workflow.

Las acciones secundarias son botones compactos:

- ver detalle;
- editar;
- imprimir 80 mm;
- abrir comprobante;
- eliminar pedido de prueba cuando todavía no existe dinero recibido.

El componente activo es `src/components/OrdersCardsDashboardV3.tsx`.

## Impresión

El botón de impresora no abre primero el comprobante. La interfaz crea un iframe temporal a:

`/pedidos/[id]/imprimir?autoprint=1&embedded=1`

y la pantalla térmica ejecuta `window.print()` al cargar.

## Comprobante

El botón de comprobante abre la vista térmica normal. Esa vista incluye un botón para descargar una copia HTML autocontenida.

Se mantienen separadas dos acciones:

- `Imprimir`: dispara la impresión directamente;
- `Comprobante`: permite revisar y descargar una copia.

## Detalle lateral

Al abrir una tarjeta se muestra un drawer con:

- fecha;
- estado;
- cliente;
- teléfono;
- modalidad;
- dirección;
- productos y configuración estructurada;
- subtotal;
- domicilio;
- descuentos;
- total;
- movimientos de pago;
- dinero recibido;
- saldo pendiente;
- acciones Editar, Imprimir, Comprobante y Registrar pago.

## Movimientos de pago

El detalle del pedido muestra cada `Payment` de la orden.

Estados visibles:

- `PENDING`: pago anunciado pero todavía no recibido;
- `PAID`: dinero realmente recibido y contabilizado en Caja;
- `CANCELED`: pago anulado por error de registro;
- `REFUNDED`: pago devuelto, cuando se implemente el flujo de devoluciones.

Un pago `PAID` puede anularse desde el detalle con:

`DELETE /api/orders/[id]/payment/[paymentId]`

La aplicación no borra físicamente el registro contable. Lo cambia a `CANCELED`, limpia `paidAt`, efectivo/vueltas y deja una nota de anulación en `reference`.

Efectos de anular un pago:

- deja de contar inmediatamente en `/caja` porque Caja solo consulta `status = PAID`;
- vuelve a aparecer saldo pendiente en el pedido;
- puede registrarse nuevamente el pago correcto;
- se conserva historial para auditoría y soporte.

Los pagos `REFUNDED` no pueden anularse por esta vía.

## Edición operativa

Desde Pedidos se puede:

- cambiar Domicilio / Recoger / Local;
- seleccionar otra zona/tarifa de domicilio;
- subir o bajar cantidades de líneas existentes;
- quitar una línea llevando su cantidad a cero;
- agregar productos simples como bebidas o antojos.

Pizzas y combos nuevos no se agregan desde este editor simple porque requieren configuración estructurada de tamaño, sabor, borde, extras y reglas de combo.

Cuando una edición agrega o modifica productos y el pedido ya había avanzado, el servidor lo devuelve a `PREPARING` para que Cocina no omita el cambio.

Si ya existe dinero recibido:

- el pago `PAID` se conserva sin reescribir;
- si el pedido aumenta, se crea o ajusta un saldo `PENDING` por la diferencia;
- si el nuevo total queda por debajo de lo ya cobrado, la edición se bloquea hasta implementar devolución.

## Eliminación para pruebas

`DELETE /api/orders/[id]?test=1` permite eliminar órdenes de prueba aunque no estén canceladas, siempre que no exista un pago realmente recibido.

Si existe cualquier `Payment` con `status = PAID` o `paidAt`, el servidor bloquea la eliminación para conservar trazabilidad contable.

## Archivos principales

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV3.tsx`
- `src/app/pedidos/[id]/imprimir/page.tsx`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/orders/[id]/payment/route.ts`
- `src/app/api/orders/[id]/payment/[paymentId]/route.ts`
- `src/app/caja/page.tsx`
- `src/app/api/caja/summary/route.ts`
- `src/lib/orderWorkflow.ts`
- `src/lib/orderPresentation.ts`

## Base de datos

La funcionalidad de anulación de pagos reutiliza el enum `PaymentStatus.CANCELED` y no agrega columnas nuevas.

Si `Payment.paidAt` ya fue sincronizado anteriormente, esta iteración no requiere un nuevo `prisma db push`.
