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

## Tarjeta compacta

Cada tarjeta muestra únicamente:

- estado actual;
- modalidad: Domicilio, Recoger o Local;
- fecha/hora;
- código `ALT-xxxxxx`;
- cantidad de líneas y unidades;
- cliente y contacto resumido;
- total;
- estado real del pago;
- acción principal del workflow.

Las acciones secundarias son botones compactos:

- ver detalle;
- editar;
- imprimir 80 mm;
- abrir el comprobante para descargarlo;
- eliminar pedido de prueba cuando todavía no existe dinero recibido.

## Impresión

El botón de impresora no abre primero el comprobante. La interfaz crea un iframe temporal a:

`/pedidos/[id]/imprimir?autoprint=1&embedded=1`

y la pantalla térmica ejecuta `window.print()` al cargar.

La intención es disparar directamente el diálogo de impresión de la impresora térmica.

## Comprobante descargable

El botón de comprobante abre la vista térmica normal. Esa vista incluye un botón `Descargar comprobante` que genera una copia HTML autocontenida del documento.

Esto mantiene separadas dos acciones:

- `Imprimir`: dispara la impresión directamente;
- `Comprobante`: permite revisar y descargar una copia del documento.

Si más adelante se necesita PDF fiscal o PDF generado por servidor, debe implementarse como un flujo separado; el comprobante actual sigue siendo operativo y no equivale a factura electrónica DIAN.

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
- dinero recibido y saldo pendiente;
- acciones Editar, Imprimir, Comprobante y Registrar pago/Ver en Caja.

## Edición operativa

Desde Pedidos se puede:

- cambiar Domicilio / Recoger / Local;
- seleccionar otra zona/tarifa de domicilio;
- subir o bajar cantidades de líneas existentes;
- quitar una línea llevando su cantidad a cero;
- agregar productos simples como bebidas o antojos.

Pizzas y combos nuevos no se agregan desde este editor simple porque requieren configuración estructurada de tamaño, sabor, borde, extras y reglas de combo. Para esos casos se debe reutilizar el configurador del POS en una iteración posterior.

Cuando una edición agrega o modifica productos y el pedido ya había avanzado, el servidor lo devuelve a `PREPARING` para que Cocina no omita el cambio.

Si ya existe dinero recibido:

- el pago `PAID` se conserva sin reescribir;
- si el pedido aumenta, se crea o ajusta un saldo `PENDING` por la diferencia;
- si el nuevo total queda por debajo de lo ya cobrado, la edición se bloquea hasta implementar devolución.

## Eliminación para pruebas

`DELETE /api/orders/[id]?test=1` permite eliminar órdenes de prueba aunque no estén canceladas, siempre que no exista un pago realmente recibido.

Si existe cualquier `Payment` con `status = PAID` o `paidAt`, el servidor bloquea la eliminación para conservar trazabilidad contable.

La eliminación de prueba borra Order, OrderItem y Payment por las relaciones cascade existentes.

## Archivos principales

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV2.tsx`
- `src/app/pedidos/[id]/imprimir/page.tsx`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/orders/[id]/payment/route.ts`
- `src/app/caja/page.tsx`
- `src/app/api/caja/summary/route.ts`
- `src/lib/orderWorkflow.ts`
- `src/lib/orderPresentation.ts`

## Base de datos

La iteración de pagos agrega `Payment.paidAt DateTime?` para registrar cuándo entra realmente el dinero.

Por tanto esta versión sí requiere ejecutar:

```bash
npx prisma db push
```

Después del push, `prisma generate` debe quedar actualizado para que la aplicación reconozca `paidAt`.