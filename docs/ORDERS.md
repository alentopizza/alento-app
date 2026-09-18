# Pedidos

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Ruta: `/pedidos`

Este documento es la referencia funcional vigente para consulta y gestión de pedidos después de su creación en POS.

## Objetivo

Pedidos centraliza el flujo operativo de una orden:

- consulta;
- búsqueda;
- edición;
- cliente;
- productos;
- pagos;
- impresión;
- estados;
- cancelación;
- eliminación controlada.

Cocina controla la preparación. Pedidos controla el resto de la operación.

## Identificador comercial

`Order.id` es técnico.

El código visible usa:

- `Order.sequenceNumber`;
- `Order.source`.

Ejemplos:

```text
POS-0006
POS-0007
WEB-0008
```

El mismo código se muestra en POS, Pedidos, Cocina y comprobante.

## Tarjetas

Cada pedido se presenta en una tarjeta compacta.

El header contiene:

- estado;
- modalidad.

El cuerpo muestra:

- fecha/hora;
- código comercial;
- total;
- cliente;
- teléfono;
- dirección cuando aplica;
- estado de pago actual;
- acciones.

### Total

El encabezado no muestra la palabra `TOTAL`.

La fecha aparece arriba y código + monto comparten la misma línea base.

El monto usa tamaño/peso moderado para no competir con el código del pedido.

### Cliente

La tarjeta usa:

- inicial;
- nombre;
- teléfono;
- dirección únicamente para Domicilio cuando existe.

## Estado de pago en tarjeta

La tarjeta muestra **un solo estado financiero actual**.

Si existe saldo:

```text
PAGO PENDIENTE
$ 50.800
```

Si está completamente cubierto:

```text
PAGADO
$ 50.800
```

El bloque ocupa todo el ancho de la tarjeta.

No se muestra el medio previsto/recibido en la tarjeta compacta.

La información detallada de movimientos vive en el drawer.

## Buscar y filtrar

Se puede buscar por datos relevantes de la orden.

Filtros principales:

- Todos;
- Activos;
- Finalizados;
- Cancelados.

El header superior muestra únicamente contador `ACTIVOS` + número.

No existe botón de actualización manual en el header; la interfaz evita ruido visual innecesario.

## Detalle lateral

Al seleccionar una tarjeta se abre un drawer.

Muestra:

- código;
- fecha;
- modalidad;
- zona/tarifa cuando aplica;
- estado;
- cliente;
- teléfono;
- dirección;
- productos;
- configuración;
- notas;
- totales;
- pagos;
- saldo;
- acciones.

## Cliente del pedido

Desde el drawer existe `Editar cliente`.

Permite dos operaciones distintas.

### Actualizar el mismo cliente

Se usa cuando la misma persona cambia:

- nombre;
- teléfono;
- indicativo.

Se modifica el mismo `Customer`, preservando su historial.

### Cambiar cliente

Permite reasignar un pedido activo a otro cliente existente.

En Domicilio es obligatorio seleccionar una dirección perteneciente al nuevo cliente.

No se inventa ni copia una dirección de otro registro.

## Productos y configuración

El detalle lee `OrderItem.configuration`.

Pizzas muestran:

- tamaño;
- borde;
- sabores como chips;
- extras;
- nota de Cocina.

Una pizza de dos sabores se visualiza mediante chips, sin depender de texto plano.

## Notas de Cocina

`OrderItem.notes` se muestra en Pedidos y puede editarse para pizzas.

Máximo vigente:

**120 caracteres**

Si una nota cambia después de que una línea fue preparada, el backend reinicia la preparación de esa línea y devuelve el pedido a Cocina cuando corresponda.

## Editar pedido

Desde Pedidos se puede:

- cambiar Domicilio / Recoger / Local;
- seleccionar tarifa de domicilio;
- cambiar cantidades;
- eliminar una línea llevando cantidad a cero;
- agregar productos simples;
- agregar bebidas;
- agregar pizzas configuradas;
- agregar pizzas de dos sabores;
- agregar combos;
- agregar/modificar notas de pizza.

### Editor estructurado

Pizzas y combos nuevos utilizan el mismo modelo estructurado del POS.

El cliente envía IDs/configuración, pero el servidor recalcula y valida.

Lógica compartida:

`src/lib/orderLineNormalizer.ts`

## Efecto de editar sobre Cocina

Una edición que cambia algo que requiere preparación puede devolver la orden a:

`PREPARING`

Ejemplos:

- agregar pizza;
- aumentar cantidad de una línea preparable;
- cambiar nota de pizza preparada.

Agregar únicamente una bebida no debe reactivar Cocina.

## Totales después de editar

El servidor recalcula:

- subtotal;
- domicilio;
- descuento permitido;
- total;
- saldo.

Los precios enviados desde la UI no se consideran autoridad para productos configurables.

## Pagos

Seleccionar un medio en POS puede crear una intención `PENDING`.

El dinero real se registra desde Pedidos como `PAID`.

Se soportan:

- pago total;
- pago parcial;
- varios pagos;
- varios medios;
- efectivo;
- referencia;
- eliminación de un pago registrado por error.

### Regla de Caja

Caja contabiliza únicamente pagos realmente recibidos.

`PENDING` no es ingreso.

### Saldo

`saldo = total - pagos PAID vigentes`

Si el pedido aumenta después de un pago:

- el ingreso ya recibido se conserva;
- aparece saldo por la diferencia.

No se debe reducir una orden por debajo de lo ya cobrado sin un futuro flujo de devolución.

## Registrar pago

El modal de pago permite:

- monto;
- medio;
- pago parcial;
- efectivo entregado opcional;
- cálculo de cambio;
- referencia opcional.

## Eliminar pago

Un pago registrado por error puede eliminarse.

Endpoint:

`DELETE /api/orders/[id]/payment/[paymentId]`

Efectos:

- se elimina físicamente;
- deja de contar en Caja;
- se recalcula saldo.

Esto no equivale a una devolución real.

## Estados

Flujo Domicilio:

```text
PREPARING
→ PREPARED
→ READY
→ OUT_FOR_DELIVERY
→ ARRIVED
→ DELIVERED
→ COMPLETED
```

Recoger / Local:

```text
PREPARING
→ PREPARED
→ READY
→ COMPLETED
```

Cocina controla hasta `READY`.

Pedidos continúa los estados posteriores.

## Cancelar

Cancelar conserva histórico.

Regla actual:

- solo dentro del mismo día operativo de Bogotá;
- la UI y el backend aplican la restricción.

Al cancelar:

- `Order.status = CANCELED`;
- deja el flujo activo;
- pagos no reembolsados se cancelan según regla vigente;
- la tarjeta adopta estado visual de cancelado.

## Eliminar definitivamente

La secuencia es:

```text
Pedido activo
→ Cancelar
→ Eliminar
```

`DELETE /api/orders/[id]` exige:

- pedido `CANCELED`;
- mismo día operativo.

La eliminación transaccional borra:

```text
Payment
→ OrderItem
→ Order
```

Después del cambio de día, el cancelado queda histórico y ya no se elimina desde este flujo.

## Impresión

La acción Imprimir usa la ruta:

`/pedidos/[id]/imprimir`

Formato:

**80 mm**

Incluye:

- pedido;
- modalidad;
- cliente;
- productos/configuración;
- notas de Cocina;
- totales;
- información de pago operativa.

No es facturación electrónica fiscal.

La impresión puede ejecutarse con iframe/autoprint desde la tarjeta.

## Header del módulo

Texto vigente:

`Todo el flujo de tus órdenes, en un solo lugar.`

El contador muestra:

`ACTIVOS`

y el número correspondiente.

## Archivos principales

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV3.tsx`
- `src/components/ActionConfirmModal.tsx`
- `src/components/OrderEditStructuredAdder.tsx`
- `src/app/pedidos/[id]/imprimir/page.tsx`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/orders/[id]/status/route.ts`
- `src/app/api/orders/[id]/payment/route.ts`
- `src/app/api/orders/[id]/payment/[paymentId]/route.ts`
- `src/lib/orderLineNormalizer.ts`
- `src/lib/orderPresentation.ts`
- `src/lib/orderWorkflow.ts`
- `src/lib/orderCode.ts`
- `src/lib/operationalDate.ts`

## Reglas de no regresión

- no volver a códigos `ALT-...`;
- no usar `Order.id` como código comercial;
- no volver a mostrar simultáneamente Pagado + Pendiente en tarjeta;
- no mostrar medio de pago en tarjeta compacta;
- no perder notas al editar;
- no permitir una edición de bebida que reactive Cocina;
- no confiar en precios del navegador para configurables;
- no borrar directamente una orden activa;
- no contar `PENDING` en Caja;
- no permitir cancelar/eliminar pedidos históricos fuera de la regla diaria.

## Prisma

El cierre actual de Pedidos no requiere un cambio adicional del schema.
