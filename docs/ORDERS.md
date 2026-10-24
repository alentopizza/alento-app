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
- indicativo;
- dirección del domicilio cuando el pedido es DELIVERY.

Se modifica el mismo `Customer`, preservando su historial.

### Corregir dirección del domicilio

Cuando un cliente se equivoca al ingresar su dirección, **Editar cliente** muestra el mismo selector Google Maps usado por el CRM:

- se puede buscar otra dirección;
- se puede ajustar el pin manualmente;
- al guardar se actualiza la dirección operativa del cliente y la dirección asociada al pedido;
- la ruta se recalcula con Google Routes;
- la banda y tarifa de domicilio se recalculan server-side;
- el total y el saldo pendiente se ajustan automáticamente;
- no se permite guardar una dirección fuera de cobertura;
- si el nuevo total queda por debajo de dinero ya recibido, el cambio se bloquea hasta resolver la devolución;
- pedidos DELIVERED, COMPLETED o CANCELED no permiten cambiar la dirección.

### Cambiar cliente

Permite reasignar un pedido activo a otro cliente existente.

En Domicilio es obligatorio seleccionar una dirección perteneciente al nuevo cliente.

No se inventa ni copia una dirección de otro registro.


### Reenvío manual de `nuevo_pedido_v2`

El drawer de detalle del pedido incluye **Reenviar WhatsApp**.

Uso principal:

- el cliente registró un teléfono incorrecto;
- el operador corrige el teléfono desde **Editar cliente**;
- luego puede reenviar manualmente la plantilla `nuevo_pedido_v2` sin recrear el pedido.

Endpoint:

`POST /api/orders/[id]/resend-new-order-template`

Reglas:

- usa siempre el teléfono actualmente guardado en `Customer`;
- la plantilla enviada es exactamente `nuevo_pedido_v2`;
- el reenvío exige coincidencia exacta de teléfono en Chatwoot;
- no se permite caer al contacto histórico encontrado únicamente por `customerId`, porque podría corresponder al número equivocado anterior;
- si Chatwoot no tiene contacto/conversación válida para el teléfono corregido, la UI informa el error en lugar de arriesgar un envío al número viejo;
- disponible para roles `ADMIN`, `POS` y `CASHIER`.


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

## Pedidos programados

`Order.scheduledFor` guarda opcionalmente la fecha/hora solicitada por el cliente.

Reglas operativas:

- un pedido sin `scheduledFor` se trata como **Lo antes posible**;
- la fecha/hora programada debe caer dentro del horario de servicio configurado para ese día en Configuración; la apertura es inclusiva y la hora de cierre marca el fin del servicio;
- un pedido programado aparece en Pedidos desde el momento en que se crea;
- las tarjetas y el drawer lo identifican con reloj y acento violeta;
- el texto visible muestra `PROGRAMADO` y la fecha/hora objetivo;
- un pedido programado con preparación de Cocina permanece fuera del tablero hasta 30 minutos antes;
- los pedidos DELIVERY programados tampoco aparecen antes de tiempo en Mapa De Entregas ni a Repartidores;
- al entrar en la ventana de Cocina se incorpora al tablero y el sistema de alertas locales lo trata como un pedido nuevo;
- no se permite marcar preparación antes de la ventana;
- si una línea ya comenzó preparación, el pedido no puede reprogramarse para más adelante.

La ventana vigente es de **30 minutos** y su fuente compartida está en:

`src/lib/orderScheduling.ts`

## Editar pedido

Desde Pedidos se puede:

- cambiar Domicilio / Recoger / Local;
- cambiar entre **Lo antes posible** y **Programar pedido**, incluyendo fecha/hora;
- corregir la dirección de Domicilio; la tarifa se recalcula en servidor según cobertura;
- cambiar cantidades;
- eliminar una línea llevando cantidad a cero;
- agregar productos simples;
- agregar bebidas;
- agregar pizzas configuradas;
- agregar pizzas de dos sabores;
- editar la configuración de pizzas existentes, incluidas pizzas de dos sabores;
- agregar combos;
- agregar/modificar notas de pizza.

### Editor estructurado

Pizzas y combos nuevos utilizan el mismo modelo estructurado del POS.

El cliente envía IDs/configuración, pero el servidor recalcula y valida.

Lógica compartida:

`src/lib/orderLineNormalizer.ts`

### Edición de pizzas existentes

La edición de una línea de pizza ya creada puede modificar su configuración estructurada sin reemplazarla por texto plano.

Reglas vigentes:

- una pizza de un sabor puede reabrirse en el configurador y conservar tamaño, sabor, borde, extras y nota;
- una pizza de dos sabores puede reabrirse y cambiar tamaño, ambas mitades/sabores y borde;
- el backend vuelve a normalizar la línea mediante `normalizeOrderLine()` y recalcula su precio;
- si solo cambia la cantidad o la nota, la configuración histórica existente se conserva;
- líneas históricas sin `productId` se mantienen editables en cantidad/nota sin intentar reconstruir una configuración inexistente;
- solo las líneas que reciben explícitamente un parche de `configuration` sustituyen su configuración;
- no confiar en el precio enviado por el navegador.

La UI usa `existingPizzaEdits` / `ExistingPizzaEditRequest` en `OrdersCardsDashboardV3.tsx`; la autoridad final sigue en `PATCH /api/orders/[id]/edit`.

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

## Selector compacto de estados

El modal operativo de estados está optimizado para no saturar la pantalla, especialmente en pedidos de Domicilio.

Comportamiento vigente:

- muestra un stepper horizontal compacto con todo el flujo;
- el estado actual se identifica de forma visible;
- solo la **siguiente transición recomendada** aparece como acción principal;
- los saltos a etapas posteriores siguen permitidos dentro de **Más estados**;
- los estados ya superados no se muestran como botones grandes;
- el pago pendiente se resume en una tarjeta compacta;
- la asignación de repartidor se mantiene dentro del mismo modal, pero en formato reducido;
- Finalizado continúa bloqueado mientras exista saldo pendiente.

Para Domicilio, el flujo visible respeta:

`Preparando → Horneando → Listo → En camino → Ha llegado → Entregado → Finalizado`

Recordatorio técnico:

- `PREPARED` es el estado interno mostrado como **Horneando**;
- `PREPARED → READY` corresponde al hornero/operación, no a Cocina.

## Eliminación definitiva de pedidos cerrados

La eliminación definitiva está permitida únicamente para:

- `CANCELED`;
- `COMPLETED`.

Requisitos:

- usuario ADMIN o permiso `DELETE_ORDERS`;
- los pedidos activos no se pueden eliminar;
- la acción exige confirmación explícita.

Al eliminar un pedido finalizado:

- se elimina la orden;
- se eliminan sus líneas;
- se eliminan sus pagos;
- se eliminan sus `ClubPointTransaction`;
- los `NotificationJob` relacionados caen por cascada;
- el pedido deja de existir en historial y métricas del cliente.

Esta acción debe usarse como limpieza/mantenimiento y es irreversible.

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

`DELETE /api/orders/[id]` exige únicamente que el pedido esté en estado:

- `CANCELED`.

La fecha de creación ya no limita la eliminación definitiva.

La eliminación transaccional borra:

```text
Payment
→ OrderItem
→ Order
```

Los pedidos cancelados pueden eliminarse desde este flujo aunque pertenezcan a un día operativo anterior.

## Impresión

### Precios de borde en el comprobante

Para pizzas con configuración estructurada, el comprobante no debe ocultar el valor de un borde especial dentro del precio principal de la pizza.

Regla visual:

```text
1 × PIZZA / SABOR                  $ precio base
  TAMAÑO: ...
  SABOR: ...
  BORDE: BOCADILLO                $ precio borde
```

El precio principal mostrado se obtiene restando del `OrderItem.lineTotal` únicamente el snapshot `configuration.crust.price × quantity`. El subtotal y total de la orden no se recalculan en impresión.

- borde con precio mayor a cero: mostrar nombre + precio separado;
- borde de $0: mostrar el nombre sin inventar un cargo;
- pedidos históricos sin snapshot de precio de borde: mostrar el nombre disponible, pero no inferir un precio actual del catálogo.

El comprobante usa el título **DETALLE DEL PEDIDO**; no volver a introducir checklist de despacho.

La acción Imprimir usa la ruta:

`/pedidos/[id]/imprimir`

Formato:

**80 mm**

Incluye:

- código comercial basado en `sequenceNumber`;
- modalidad;
- cliente y teléfono;
- dirección completa de entrega;
- barrio/sector y zona cuando existen;
- **indicaciones/complemento de entrega** desde `CustomerAddress.notes`;
- repartidor asignado cuando existe;
- bloque operativo de cobro: `PAGADO · NO COBRAR` o `COBRAR $...`;
- medio de pago indicado;
- productos/configuración;
- notas de Cocina;
- nota general del pedido cuando existe;
- totales;
- detalle de pagos realmente recibidos.

Para Domicilio, la impresión se considera una hoja operativa para el repartidor: dirección, indicaciones y cobro deben quedar visualmente por encima del checklist de productos.

No es facturación electrónica fiscal.

La impresión puede ejecutarse con iframe/autoprint desde la tarjeta.

### Descarga de comprobante en PNG

Pedidos también permite descargar el comprobante como imagen sin abrir una página visible.

Endpoint:

`GET /api/orders/[id]/receipt-image`

La imagen se genera en servidor y conserva la información operativa del comprobante: código, fecha, modalidad, programación cuando aplica, cliente, dirección/indicaciones, productos/configuración, notas, domicilio, descuentos, total y estado de cobro. El texto se convierte a trazos vectoriales antes del render para evitar dependencias de fuentes del dispositivo del usuario.

Esta salida es complementaria a la impresión térmica y no cambia la contabilidad ni el contenido persistido del pedido.

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
- mantener la exigencia de cancelar antes de eliminar definitivamente.

## Prisma

El cierre actual de Pedidos no requiere un cambio adicional del schema.


## Permisos para cancelar y eliminar pedidos

Cancelar y eliminar pedidos son acciones sensibles y ya no dependen únicamente del rol.

Permisos:

- `CANCEL_ORDERS`: permite cancelar un pedido activo;
- `DELETE_ORDERS`: permite eliminar definitivamente un pedido ya cancelado.

`ADMIN` dispone de ambos implícitamente.

Para cualquier otro colaborador deben habilitarse expresamente desde **Usuarios y Roles**.

La UI oculta los botones cuando el usuario no tiene el permiso, pero la regla real se valida también en `/api/orders/[id]`.

Flujo de eliminación continúa siendo:

```text
Pedido activo
→ permiso CANCEL_ORDERS
→ CANCELED
→ permiso DELETE_ORDERS
→ eliminación definitiva
```


## Revisión productiva 2026-09-23

Reglas vigentes adicionales:

- el domicilio ya no permite escoger una tarifa manual al editar;
- el backend recalcula Google Routes y selecciona la banda activa;
- la tarjeta muestra repartidor asignado;
- el administrador puede desasignar un repartidor;
- si se desasigna durante `OUT_FOR_DELIVERY` o `ARRIVED`, el pedido vuelve a `READY` y se limpia la verificación del driver;
- existe **Mapa De Entregas** con pedidos, repartidores, Alentó y rutas;
- rutas múltiples encadenan paradas y diferencian cada tramo por color;
- el límite de domicilios simultáneos por repartidor se configura desde Configuración;
- una orden con dinero `PAID` no puede cancelarse hasta disponer de un flujo de refund.


### Comanda térmica de repartidor

Cuando `fulfillmentType = DELIVERY`, la impresión genera un único trabajo con dos páginas térmicas de 80 mm:

1. factura/comprobante para caja;
2. comanda operativa para el repartidor.

La comanda incluye:

- código del pedido;
- nombre y teléfono;
- dirección;
- indicaciones;
- estado de pago;
- medio de pago pendiente;
- efectivo con el que paga el cliente, cuando existe;
- vueltas que debe llevar el repartidor;
- Nequi `324 333 4009`;
- Llave `@324 333 4009`.

No incluye el detalle de productos: su función es exclusivamente operativa para la entrega.

La segunda hoja usa `break-before: page` / `page-break-before: always`. El sistema envía factura y comanda como páginas separadas; el corte físico entre ambas depende de que el driver de la impresora térmica esté configurado para **cortar al finalizar cada página**.

Los pedidos que no son domicilio imprimen únicamente el comprobante.
