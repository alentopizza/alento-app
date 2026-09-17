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
- resumen financiero `Pago pendiente / Pagado`;
- botón principal `ESTADOS` para pedidos no cancelados.

El contador de `líneas` no se muestra en la tarjeta porque no aporta información operativa suficiente para justificar espacio visual.

### Selector `ESTADOS`

La acción operativa principal ya no avanza automáticamente una etapa ni redirige a Cocina.

En las tarjetas y en el drawer de detalle aparece **ESTADOS**. Al pulsarlo se abre un modal con las etapas válidas para la modalidad actual.

Domicilio:

`En preparación → Preparado → Listo → En camino → Ha llegado → Entregado → Finalizado`

Recoger / Local:

`En preparación → Preparado → Listo → Finalizado`

El operador puede seleccionar directamente cualquier etapa posterior. No es obligatorio recorrerlas secuencialmente, pero no se permite retroceder.

Ejemplos:

- `Preparado → Finalizado` en Local o Recoger;
- `Listo → Entregado` en Domicilio;
Los estados anteriores permanecen visibles como referencia, pero aparecen deshabilitados y marcados como `Etapa superada`. Además, `Finalizado` aparece deshabilitado con la indicación `Requiere pago total` mientras exista saldo pendiente.

Pedidos `CANCELED` no usan este selector porque la cancelación continúa como un flujo separado.

El modal vive en `src/components/OrderStatusSelector.tsx` y la integración con la pantalla existente se mantiene aislada en `src/components/OrdersStatusController.tsx` para no modificar la lógica consolidada de pagos, edición y tarjetas.

Al guardar un estado:

- la API actualiza la orden;
- la pantalla se refresca usando el control `Actualizar` ya existente;
- `Finalizado` solo se habilita cuando el saldo pendiente es `0`;
- seleccionar `Finalizado` no registra pagos automáticamente;
- Caja sigue dependiendo únicamente de movimientos `Payment.status = PAID`.

### Resumen financiero premium

La tarjeta muestra siempre el estado financiero de la orden de forma explícita, incluso cuando existen pagos parciales.

Se presentan dos tarjetas de igual ancho:

- `Pago pendiente`: saldo actual de la orden, en tono ámbar/alerta;
- `Pagado`: suma real de todos los movimientos `Payment.status = PAID`, en tono verde/éxito.

El medio de pago previsto ya **no se muestra en la tarjeta compacta** para evitar ruido visual y aprovechar mejor el espacio. Sigue disponible en el detalle del pedido y en el flujo `Registrar pago`.

Ejemplo:

```text
Pago pendiente          Pagado
$ 92.500                $ 50.000
```

El bloque `Pago pendiente` es clicable mientras exista saldo y abre el modal `Registrar ingreso`.

El resumen financiero usa una capa visual aislada en `src/app/orders-card-payment-summary.css`.

Criterios tipográficos actuales:

- familia preferida: `Segoe UI Variable`, con fallback a `Segoe UI`, `Inter`, `Roboto` y `system-ui`;
- `font-synthesis: none` para evitar pesos artificiales;
- etiquetas de 11 px con peso aproximado 650 en lugar de `font-black`;
- montos de 20 px con peso 700;
- tracking más moderado para evitar apariencia apelmazada;
- números tabulares (`tnum`) y lining figures (`lnum`) para lectura y alineación más limpias;
- responsive a 18 px en pantallas pequeñas;
- contraste alto entre texto y fondo sin aumentar innecesariamente el grosor.

La intención es priorizar nitidez en Windows/Chrome y conservar una apariencia elegante y profesional.

Los importes reales recibidos se calculan exclusivamente con pagos `PAID`.

El total de la orden usa un pequeño contenedor visual independiente con fondo neutro, etiqueta `TOTAL` y monto en rojo para mejorar jerarquía sin aumentar demasiado la tarjeta.

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
- fecha y teléfono ligeramente más grandes;
- menor uso de `font-black` visual mediante overrides de peso;
- números con `font-variant-numeric: tabular-nums` para mejorar alineación;
- resumen financiero compacto y legible sin saturar la tarjeta;
- acción principal con tamaño legible.

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
- cancelar pedido mientras siga activo;
- eliminar definitivamente únicamente cuando ya está cancelado.

Las acciones destructivas de Pedidos ya no usan los diálogos nativos del navegador (`window.confirm`). Se muestran mediante el componente reutilizable `src/components/ActionConfirmModal.tsx`.

Variantes:

- `warning`: cancelar pedido; conserva trazabilidad y usa acento ámbar;
- `danger`: eliminar pedido o eliminar pago; usa acento rojo y comunica claramente que la acción es irreversible o afecta Caja.

El modal bloquea sus acciones mientras la operación está en curso para evitar doble ejecución. La lógica backend y los endpoints permanecen sin cambios.

El botón `Comprobante` fue retirado de Pedidos para reducir ruido visual. La impresión directa permanece como acción disponible.

El componente principal sigue siendo `src/components/OrdersCardsDashboardV3.tsx`.

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
- acciones Editar, Imprimir y Estados.

El encabezado del bloque de productos no muestra un contador de `líneas`.

### Drawer compacto

El detalle lateral usa una capa visual específica en `src/app/orders-detail-drawer-compact.css` para mostrar más información antes de necesitar scroll.

Criterios:

- header más bajo, manteniendo código, fecha y modalidad visibles;
- en pedidos Domicilio, la zona/tarifa se muestra junto al badge de modalidad (`SIN COSTO`, `ZONA 2`, etc.) y ya no ocupa una fila dentro de Cliente;
- bloque de cliente más compacto, con teléfono y dirección en una misma zona de metadatos;
- productos con menor padding y separación vertical, conservando configuración estructurada;
- tamaño, sabores, borde y opciones de combo se muestran como chips compactos; en pizzas de un solo sabor se omite `Sabor 1` cuando coincide exactamente con el nombre del producto para evitar información redundante;
- ingredientes `Extra` usan chips ámbar/naranja para distinguirlos rápidamente;
- totales condensados con mayor jerarquía para el total final;
- pagos con tarjetas de estado suaves, mayor contraste y resumen recibido/saldo más claro;
- footer fijo con menor altura;
- pesos tipográficos moderados, mejor contraste y números tabulares para evitar apariencia borrosa; nombre, precio y chips de producto usan una escala ligeramente mayor para mejorar legibilidad sin perder compactación;
- ajustes adicionales en viewports bajos para priorizar visibilidad operativa.

Este cambio es únicamente visual. No modifica pedidos, pagos, estados, Caja, Cocina ni Prisma.

## Pagos registrados

El detalle muestra los registros `Payment` existentes en la orden.

Estados habituales:

- `PENDING`: medio anunciado pero dinero todavía no recibido;
- `PAID`: dinero recibido y contabilizado en Caja;
- `REFUNDED`: reservado para el futuro flujo de devoluciones.

### Efectivo pendiente y `Paga con`

En un pago `PENDING` por efectivo, `cashReceived`/`Paga con` es una referencia operativa para calcular cambio; **no representa dinero recibido en Caja**.

Por eso, editar un pedido pendiente nunca debe bloquearse porque el nuevo total supere el monto antiguo de `Paga con`.

Regla:

- si el monto guardado todavía es mayor o igual al nuevo total, se conserva y `changeDue` se recalcula;
- si el nuevo total supera ese monto, `cashReceived` y `changeDue` se limpian;
- el `Payment.amount` pendiente se actualiza al nuevo saldo;
- la validación estricta del efectivo recibido ocurre cuando se registra realmente el ingreso (`PAID`).

Esta regla solo aplica a pagos pendientes. Los pagos `PAID` sí representan dinero real recibido y siguen protegidos: no se permite reducir el pedido por debajo de lo ya cobrado sin un flujo de devolución.

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
- agregar bebidas y otros productos simples;
- agregar pizzas configuradas;
- agregar pizzas de dos sabores configuradas;
- agregar combos configurados.

### Organización del editor

El modal de edición separa claramente:

1. `Productos actuales`: líneas ya existentes y cantidades.
2. `Agregar pizzas y combos`: productos que requieren configuración antes de agregarse.
3. `Agregar bebidas y otros`: productos simples que solo requieren cantidad.

El componente `src/components/OrderEditStructuredAdder.tsx` contiene el flujo de selección/configuración de pizzas y combos para no seguir aumentando el componente principal de Pedidos.

### Pizzas y combos agregados desde Pedidos

Las nuevas pizzas y combos conservan `OrderItem.configuration` estructurado.

Una pizza puede registrar:

- tamaño;
- uno o dos sabores;
- borde;
- ingredientes adicionales.

Un combo puede registrar:

- pizzas incluidas;
- tamaño y sabor de cada pizza;
- grupos/opciones del combo.

El cliente envía la configuración seleccionada, pero el servidor **no confía en precios enviados por la interfaz**. `PATCH /api/orders/[id]` vuelve a validar el catálogo y recalcula precio, disponibilidad y configuración antes de crear el `OrderItem`.

La lógica compartida está en:

`src/lib/orderLineNormalizer.ts`

Esto permite que edición y creación de pedidos utilicen la misma representación estructurada del producto y evita guardar pizzas/combos como líneas simples.

### Efecto sobre Cocina

Si una edición cambia cantidades o agrega cualquier producto, el pedido vuelve a `PREPARING` cuando ya estaba en una etapa posterior editable.

Los productos nuevos se crean con:

`preparedQuantity = 0`

De esta forma Cocina debe preparar las nuevas unidades y no se omiten productos agregados después de crear la orden.

### Totales y pagos después de editar

El servidor recalcula:

- subtotal;
- base elegible de descuento;
- descuento vigente dentro de la nueva base elegible;
- domicilio;
- total;
- saldo pendiente.

Si ya existe dinero recibido:

- el pago `PAID` se conserva;
- si el pedido aumenta, aparece saldo pendiente por la diferencia;
- si el nuevo total queda por debajo de lo cobrado, la edición se bloquea hasta implementar devolución.

## Eliminar vs cancelar pedido

La secuencia operativa es obligatoriamente:

`Pedido activo → Cancelar → Eliminar`

### Cancelar

Cancelar conserva el pedido, sus productos y sus pagos para mantener trazabilidad.

La cancelación está limitada al **mismo día operativo en que se creó la orden**, calculado con la zona horaria `America/Bogota`. Un pedido de un día anterior ya no puede cancelarse después del cierre diario.

La restricción existe tanto en la interfaz como en `PATCH /api/orders/[id]`, por lo que no puede omitirse llamando directamente al endpoint.

Al cancelar:

- `Order.status` pasa a `CANCELED`;
- los movimientos `Payment` existentes no se borran;
- los pagos que no estén `REFUNDED` pasan a estado `CANCELED`, por lo que dejan de contar como ingresos activos en Caja;
- la orden deja de participar del flujo operativo normal;
- la tarjeta adopta una apariencia gris/desactivada para diferenciarla claramente de órdenes activas;
- recién entonces la interfaz habilita la acción de eliminación definitiva, siempre que la orden siga perteneciendo al día operativo actual.

### Eliminar

`DELETE /api/orders/[id]` solo acepta pedidos cuyo estado ya sea `CANCELED` **y cuya fecha de creación corresponda al día operativo actual en Bogotá**.

Después del cambio de día, un pedido cancelado queda preservado como histórico del cierre diario y ya no puede eliminarse.

Al eliminar definitivamente, la transacción borra físicamente:

- todos los `Payment` relacionados;
- todos los `OrderItem`;
- el `Order`.

Esto evita datos huérfanos y también impide borrar accidentalmente una orden activa sin pasar primero por cancelación.

## Archivos principales

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV3.tsx`
- `src/components/ActionConfirmModal.tsx`
- `src/components/OrdersStatusController.tsx`
- `src/components/OrderStatusSelector.tsx`
- `src/components/OrderEditStructuredAdder.tsx`
- `src/app/pedidos/[id]/imprimir/page.tsx`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/orders/[id]/status/route.ts`
- `src/app/api/orders/[id]/payment/route.ts`
- `src/app/api/orders/[id]/payment/[paymentId]/route.ts`
- `src/app/orders-fulfillment-badges.css`
- `src/app/orders-card-typography.css`
- `src/app/orders-card-payment-summary.css`
- `src/app/orders-detail-drawer-compact.css`
- `src/app/orders-canceled-card.css`
- `src/lib/orderLineNormalizer.ts`
- `src/lib/orderCode.ts`
- `src/lib/orderWorkflow.ts`
- `src/lib/orderPresentation.ts`
- `src/lib/operationalDate.ts`

## Base de datos

Este cambio no modifica Prisma ni requiere `npx prisma db push`.
