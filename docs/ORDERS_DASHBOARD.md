# Dashboard de Pedidos

La ruta `/pedidos` usa una vista de tarjetas compactas orientada a operación rápida.

## Objetivo

Cada pedido aparece una sola vez. La tarjeta debe permitir identificarlo y operar sin llenar la pantalla de información que solo se necesita al abrir el detalle.

## Header

La página usa un hero oscuro consistente con el POS:

- etiqueta `Operación`;
- título `Pedidos`;
- texto `Una orden, un estado actual y una acción clara.`;
- contador de pedidos activos;
- actualización manual.

## Identificador comercial y consecutivo global

El identificador visible se genera con `src/lib/orderCode.ts` y usa `Order.sequenceNumber` cuando existe.

Formato:

- POS: `POS-0001`
- Web: `WEB-0002`

El prefijo identifica el origen y el número comercial se comparte entre todos los canales.

Ejemplo:

1. POS → `POS-0001`;
2. WEB → `WEB-0002`;
3. POS → `POS-0003`.

`Order.id` sigue siendo el identificador técnico interno para rutas y relaciones. Pedidos antiguos sin `sequenceNumber` pueden usar `id` como fallback visual para compatibilidad.

Eliminar un pedido no retrocede ni reutiliza el consecutivo comercial.

## Búsqueda y filtros

Permite buscar por código comercial, cliente, teléfono, estado y medio de pago.

Filtros rápidos:

- Todos;
- Activos;
- Finalizados;
- Cancelados.

La información se refresca automáticamente cada 15 segundos.

## Tarjetas de pedido

Cada tarjeta muestra:

- estado actual;
- modalidad;
- fecha/hora;
- código comercial;
- cantidad total de productos;
- cliente y contacto resumido;
- total;
- saldo o pago recibido;
- acción principal del workflow.

El contador de `líneas` no se muestra en la tarjeta porque no aporta información operativa suficiente para justificar espacio visual.

### Modalidad por color

La modalidad debe reconocerse rápidamente sin leer toda la tarjeta.

Se usan badges sólidos y de alto contraste:

- `DOMICILIO / DELIVERY`: rojo sólido con texto blanco;
- `RECOGER / PICKUP`: azul sólido con texto blanco;
- `LOCAL / STORE`: verde sólido con texto blanco.

Además, el encabezado donde aparece el estado (`EN PREPARACIÓN`, `LISTO`, etc.) repite la modalidad mediante un borde superior de 4 px con el mismo color:

- Domicilio → rojo;
- Recoger → azul;
- Local → verde.

Así la modalidad puede reconocerse incluso antes de leer el badge.

El mismo criterio visual se aplica en la tarjeta y el badge del encabezado del detalle lateral.

Los overrides visuales están aislados en `src/app/orders-fulfillment-badges.css` para poder ajustar contraste y acentos sin tocar la lógica del componente.

### Tipografía y jerarquía

Las tarjetas usan una jerarquía tipográfica más refinada y legible mediante `src/app/orders-card-typography.css`.

Principios:

- familia de sistema moderna: `Segoe UI`, `Roboto`, `Helvetica Neue`, `Arial`;
- código comercial y total como elementos protagonistas;
- nombre del cliente visible pero con menos peso que antes;
- fecha, teléfono y medio de pago ligeramente más grandes;
- menor uso de `font-black` visual mediante overrides de peso;
- números con `font-variant-numeric: tabular-nums` para mejorar alineación;
- saldo y acción principal con tamaño legible sin saturar la tarjeta.

Estos estilos están limitados a `/pedidos` para no modificar POS, Cocina ni Caja.

### Tarjeta de información del cliente

El bloque del cliente está optimizado para lectura rápida durante la operación.

Criterios visuales:

- contenedor más alto y con mayor respiración interna;
- avatar/inicial de 50 px con borde y sombra suaves;
- nombre del cliente a aproximadamente 17 px y con peso medio/alto;
- teléfono y dirección a aproximadamente 13 px;
- teléfono y dirección se renderizan en líneas independientes;
- cada dato secundario usa un pequeño punto visual discreto, sin emojis;
- la dirección solo aparece en la tarjeta cuando el pedido es `DOMICILIO` y existe una dirección asociada;
- fondo crema muy suave, borde discreto y sombra ligera.

El objetivo visual es que la información se lea como:

```text
Ivan Garzon
• +57 3243755611
• Calle 8a #92-72
```

En `RECOGER` o `LOCAL`, si no existe dirección asociada al pedido, se muestra únicamente el teléfono.

El detalle lateral usa la misma jerarquía visual y también separa nombre, teléfono y dirección en líneas distintas.

### Acciones secundarias

La tarjeta conserva botones compactos para:

- ver detalle;
- editar;
- imprimir 80 mm;
- eliminar pedido cuando corresponde.

El botón `Comprobante` fue retirado de Pedidos para reducir ruido visual. La impresión directa permanece como acción disponible.

El componente activo es `src/components/OrdersCardsDashboardV3.tsx`.

## Impresión

El botón de impresora crea un iframe temporal a:

`/pedidos/[id]/imprimir?autoprint=1&embedded=1`

y la vista térmica ejecuta `window.print()` al cargar.

La ruta de impresión sigue existiendo y puede abrirse directamente por URL si se necesita revisar el comprobante, pero ya no tiene un botón independiente en la tarjeta o en el footer del drawer.

## Detalle lateral

Al abrir una tarjeta se muestra un drawer con:

- fecha;
- modalidad con color distintivo;
- estado;
- cliente;
- teléfono;
- dirección cuando aplica;
- productos y configuración estructurada;
- subtotal;
- domicilio;
- descuentos;
- total;
- movimientos de pago;
- dinero recibido;
- saldo pendiente;
- acciones Editar, Imprimir y la acción principal del workflow.

El encabezado del bloque de productos no muestra un contador de `líneas`.

## Pagos registrados

El detalle muestra los registros `Payment` existentes en la orden.

Estados habituales:

- `PENDING`: medio anunciado pero dinero todavía no recibido;
- `PAID`: dinero recibido y contabilizado en Caja;
- `REFUNDED`: reservado para el futuro flujo de devoluciones.

### Eliminar un pago

Endpoint:

`DELETE /api/orders/[id]/payment/[paymentId]`

Es un borrado físico del registro `Payment` y se utiliza para corregir ingresos registrados por error.

Efectos:

- desaparece de PostgreSQL;
- deja de contar en Caja;
- el saldo visual se recalcula con los pagos restantes;
- puede registrarse después el pago correcto.

Una devolución real será un flujo diferente y deberá conservar trazabilidad.

## Edición operativa

Desde Pedidos se puede:

- cambiar Domicilio / Recoger / Local;
- seleccionar tarifa de domicilio;
- modificar cantidades de líneas existentes;
- quitar una línea llevando su cantidad a cero;
- agregar productos simples como bebidas o antojos.

Pizzas y combos nuevos no se agregan desde este editor simple porque requieren configuración estructurada.

Cuando una edición modifica productos y el pedido ya había avanzado, el servidor puede devolverlo a `PREPARING` para que Cocina no omita el cambio.

Si ya existe dinero recibido:

- el pago `PAID` se conserva;
- si el pedido aumenta, aparece saldo pendiente por la diferencia;
- si el nuevo total queda por debajo de lo cobrado, la edición se bloquea hasta implementar devolución.

## Eliminar vs cancelar pedido

`DELETE /api/orders/[id]` elimina físicamente el pedido junto con sus `Payment` y `OrderItem` en una transacción, evitando datos huérfanos.

Cancelar mantiene el pedido en el histórico con estado `CANCELED` y debe usarse cuando la orden fue real y se desea conservar trazabilidad.

## Archivos principales

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV3.tsx`
- `src/app/pedidos/[id]/imprimir/page.tsx`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/orders/[id]/payment/route.ts`
- `src/app/api/orders/[id]/payment/[paymentId]/route.ts`
- `src/app/orders-fulfillment-badges.css`
- `src/app/orders-card-typography.css`
- `src/lib/orderCode.ts`
- `src/lib/orderWorkflow.ts`
- `src/lib/orderPresentation.ts`

## Base de datos

Estos ajustes visuales no cambian Prisma ni requieren `npx prisma db push`.
