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

## Identificador público y consecutivo global

El identificador visible de una orden se genera con `src/lib/orderCode.ts`.

Formato principal:

- POS: `POS-0001`
- Web: `WEB-0002`

El prefijo identifica el origen, pero el número se comparte entre todos los canales porque corresponde a `Order.id` de PostgreSQL.

Ejemplo:

1. primer pedido creado desde POS: `POS-0001`;
2. segundo pedido creado desde Web: `WEB-0002`;
3. tercer pedido creado desde POS: `POS-0003`.

No existen consecutivos independientes por canal.

Eliminar un pedido no renumera ni reutiliza su consecutivo. Si se elimina `POS-0007`, el siguiente registro seguirá usando el siguiente valor de la secuencia global.

Actualmente `OrderSource` ya contempla `POS`, `WEB`, `WHATSAPP`, `INSTAGRAM`, `FACEBOOK` y `OTHER`. POS y WEB son los prefijos principales definidos para la operación actual/futura.

## Búsqueda y filtros

Permite buscar por código público (`POS-xxxx`, `WEB-xxxx`), cliente, teléfono, estado y medio de pago.

Filtros rápidos:

- Todos;
- Activos;
- Finalizados;
- Cancelados.

La información se refresca automáticamente cada 15 segundos.

## Tarjeta moderna

Cada tarjeta usa una franja superior con el estado actual y una estructura visual compacta:

- estado actual;
- modalidad: Domicilio, Recoger o Local;
- fecha/hora;
- código público con prefijo de origen;
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
- eliminar pedido.

El componente activo es `src/components/OrdersCardsDashboardV3.tsx`.

## Impresión

El botón de impresora no abre primero el comprobante. La interfaz crea un iframe temporal a:

`/pedidos/[id]/imprimir?autoprint=1&embedded=1`

y la pantalla térmica ejecuta `window.print()` al cargar.

El comprobante usa el mismo `orderCode()` para que el código impreso coincida con Pedidos y Cocina.

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

## Pagos registrados

El detalle del pedido muestra cada `Payment` que todavía existe en la orden.

Estados operativos habituales:

- `PENDING`: medio anunciado pero dinero todavía no recibido;
- `PAID`: dinero recibido y contabilizado en Caja;
- `REFUNDED`: reservado para el futuro flujo de devoluciones.

### Eliminar un pago

Endpoint:

`DELETE /api/orders/[id]/payment/[paymentId]`

Esta acción es un **borrado físico** del registro `Payment`.

Se utiliza cuando el operador ingresó un pago por error y necesita corregirlo completamente.

Efectos:

- el `Payment` desaparece de PostgreSQL;
- deja de contar inmediatamente en Caja;
- el pedido recalcula visualmente su saldo con los pagos que continúen existiendo;
- puede registrarse posteriormente el pago correcto.

No se usa `CANCELED` para este caso porque el usuario pidió que un registro erróneo pueda eliminarse definitivamente.

Las devoluciones reales de dinero serán un flujo diferente y sí deberán conservar trazabilidad (`REFUNDED`).

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

## Eliminar vs cancelar pedido

Son operaciones diferentes.

### Eliminar pedido

`DELETE /api/orders/[id]`

Elimina definitivamente la orden de PostgreSQL.

El esquema Prisma define `onDelete: Cascade` desde `Order` hacia:

- `OrderItem`;
- `Payment`.

Por lo tanto, al eliminar un pedido también desaparecen definitivamente sus líneas y pagos. No quedan datos huérfanos.

Esta acción se utiliza para pruebas o registros creados por error.

### Cancelar pedido

Cancelar NO elimina la orden.

El endpoint de edición soporta:

```json
{ "action": "cancel" }
```

y cambia `Order.status` a `CANCELED` cuando las reglas financieras lo permiten.

Se utiliza cuando el pedido fue real pero el cliente lo canceló y queremos conservarlo en el historial.

Una futura versión puede guardar además motivo de cancelación, usuario y hora exacta del cambio.

## Archivos principales

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV3.tsx`
- `src/app/pedidos/[id]/imprimir/page.tsx`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/orders/[id]/payment/route.ts`
- `src/app/api/orders/[id]/payment/[paymentId]/route.ts`
- `src/app/caja/page.tsx`
- `src/app/api/caja/summary/route.ts`
- `src/lib/orderCode.ts`
- `src/lib/orderWorkflow.ts`
- `src/lib/orderPresentation.ts`

## Base de datos

Esta iteración no agrega nuevas tablas ni columnas.

El borrado definitivo se apoya en las relaciones existentes con `onDelete: Cascade` y el consecutivo público usa el `Order.id` ya existente.

No requiere un nuevo `prisma db push` si la base ya está sincronizada con el esquema actual.
