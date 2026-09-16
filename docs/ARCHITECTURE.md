# Arquitectura de Alentó App

Este documento describe cómo está organizada Alentó App, cuál es la responsabilidad de cada módulo y qué decisiones deben respetarse al continuar el desarrollo.

## Objetivo del proyecto

Alentó App es la aplicación operativa propia de Alentó Pizza. Su objetivo es reemplazar gradualmente Glide y convertirse en la fuente principal de verdad para clientes, catálogo, precios, descuentos, pedidos, cocina, caja, pagos, configuración operativa y futuras integraciones.

Chatwoot debe funcionar como canal de atención, no como un segundo sistema de pedidos. Alentó App conserva las reglas y los datos comerciales.

## Stack e infraestructura

- Next.js 15 + React 19 + TypeScript + Tailwind CSS 4.
- Prisma 6 + PostgreSQL.
- EasyPanel/VPS.
- Proyecto: `app_alento`.
- Servicio: `alento-app`.
- PostgreSQL: `alento-db`.
- POS: `https://pos.alentopizza.com/`.

## Módulos principales

### `/`

Punto de venta. Construye el pedido, cliente, modalidad, productos, descuentos, domicilio y pago. El cierre crea una orden real en PostgreSQL.

### `/pedidos`

Consulta las órdenes persistidas con detalle de productos, configuración, cliente, totales y pago. También permite edición controlada de órdenes `CONFIRMED` e impresión térmica.

### `/pedidos/[id]/imprimir`

Vista de comprobante térmico de 80 mm. Está separada de la vista normal de Pedidos y usa estilos de impresión específicos para ocultar la interfaz general de Alentó App.

### `/clientes`

Directorio, búsqueda y edición de clientes. Domicilio y Recoger en tienda requieren cliente para conservar historial.

### `/menu`

Administración del catálogo, categorías, pizzas, modificadores y combos.

### `/cupones`

Administración de descuentos reutilizables `FIXED` y `PERCENTAGE`.

### `/configuracion`

Fuente de verdad para ubicación del local, zonas/tarifas de domicilio y medios de pago.

### `/cocina`

Destino operativo de órdenes confirmadas. El siguiente bloque debe conectarlo a `Order.status`.

## Tipos de pedido

- `DELIVERY`: Domicilio. Cliente y dirección obligatorios.
- `PICKUP`: Recoger en tienda. Cliente obligatorio.
- `STORE`: Local. Cliente opcional.

## Flujo del POS

1. Tipo de pedido.
2. Cliente cuando corresponde.
3. Productos y configuración.
4. Cierre.
5. Tarifa de domicilio cuando corresponde.
6. Cálculo de base elegible para descuento.
7. Descuento: ninguno, cupón o manual.
8. Medio de pago.
9. Si es Efectivo, `Paga con` y vueltas.
10. Revisión final.
11. `POST /api/orders`.
12. Transacción PostgreSQL: `Order + OrderItem + Payment`.
13. Orden nace `CONFIRMED`.
14. Confirmación con código `ALT-XXXXXX`.
15. Nuevo pedido reinicia el POS.

## Arquitectura de creación de pedidos

`POST /api/orders` es la entrada persistente del POS.

Responsabilidades del servidor:

- validar `fulfillmentType`;
- exigir cliente para `DELIVERY`/`PICKUP`;
- validar dirección para `DELIVERY`;
- comprobar productos activos;
- validar zona/tarifa de domicilio contra `AppSetting`;
- validar método de pago activo;
- recalcular base elegible;
- volver a calcular cupón o validar descuento manual;
- validar efectivo recibido;
- calcular subtotal, domicilio, descuento y total;
- crear todo dentro de `prisma.$transaction`.

La transacción crea:

```text
Order
├── OrderItem[]
└── Payment[]
```

No debe existir una orden parcialmente creada si falla algún elemento.

## Identificador visible de pedido

El identificador actual se deriva del `Order.id`:

```text
ALT-000001
ALT-000002
...
```

No existe una columna adicional para el código todavía. El frontend/API formatea el ID con seis dígitos.

## Estado inicial

Pedidos creados desde POS:

```text
Order.status = CONFIRMED
Order.source = POS
Payment.status = PENDING
```

`CONFIRMED` significa que la orden ya es válida y debe entrar al flujo operativo.

## Edición controlada de pedidos

La edición vive en:

- `GET /api/orders/[id]` para detalle completo;
- `PATCH /api/orders/[id]` para guardar modificaciones.

### Regla de estado

Solo una orden con `status = CONFIRMED` puede editarse desde `/pedidos`.

Cuando Cocina cambie una orden a `PREPARING`, el editor debe quedar bloqueado. Esta regla evita modificar productos mientras ya están siendo preparados.

### Cambios permitidos actualmente

- cambiar modalidad;
- seleccionar tarifa/zona al pasar a Domicilio;
- cambiar cantidades de líneas existentes;
- eliminar líneas llevando su cantidad a cero;
- agregar productos simples activos, especialmente bebidas y antojos;
- actualizar `Paga con` cuando un pedido en efectivo aumenta de total.

La edición recalcula subtotal, domicilio, total, monto del pago y vueltas.

Por ahora no reconfigura una pizza/combo ya creado ni permite agregar una pizza/combo configurable desde el editor. Esa evolución debe reutilizar el constructor estructurado del POS.

### Descuento durante edición

El valor monetario ya confirmado se trata como snapshot histórico. Al editar se conserva, limitado por la nueva base elegible si fuese necesario. No se vuelve a calcular automáticamente un porcentaje de cupón sobre productos añadidos después de la confirmación original.

## Snapshot comercial de Order

Para que el historial no dependa de cambios posteriores en Configuración, `Order` guarda:

```ts
couponId?
couponName?
deliveryZoneId?
deliveryZoneName?
discountSource // NONE | COUPON | MANUAL
subtotal
deliveryFee
discount
total
```

Esto permite renombrar cupones o zonas sin alterar la interpretación de pedidos anteriores.

## OrderItem

Cada línea guarda:

```ts
productId?
productName
unitPrice
quantity
lineTotal
configuration Json?
```

### Variantes de `configuration`

- `PIZZA`: tamaño, sabores, borde y modificadores estructurados.
- `COMBO`: pizzas y grupos/opciones estructurados.
- `STANDARD`: producto simple.
- `POS_SNAPSHOT`: snapshot transitorio con detalle textual del carrito.

`src/lib/orderPresentation.ts` centraliza cómo convertir estas variantes en detalle legible para Pedidos e impresión.

### Estado transitorio importante

El carrito actual todavía no transporta todos los IDs estructurados de pizzas y combos. Mientras se completa esa refactorización, algunas líneas se persisten como `POS_SNAPSHOT`.

Antes de exponer creación de pedidos a un canal no confiable, debe completarse la validación/recalculado server-side de pizzas y combos.

## Impresión térmica

`/pedidos/[id]/imprimir` genera un comprobante operativo de 80 mm con:

- identidad del local;
- número/código de pedido;
- modalidad;
- cliente y dirección;
- checklist de productos;
- configuración de pizzas/combos cuando esté disponible;
- subtotal, domicilio, descuento y total;
- forma de pago;
- efectivo recibido y vueltas;
- cupón.

`window.print()` dispara la impresión y `@media print` en `globals.css` oculta el resto de la interfaz. El comprobante no se presenta como factura electrónica fiscal.

## Configuración operativa

`AppSetting` almacena `pos_settings` en JSON. Incluye ubicación, `deliveryBands` y `paymentMethods`.

En operación actual, `deliveryBands` es un catálogo manual de zonas/tarifas. Google Maps queda como automatización futura.

## Arquitectura de descuentos

`Product.couponEligible` controla la elegibilidad de productos normales.

Reglas:

- combos nunca son elegibles;
- `couponEligible = false` excluye el producto;
- domicilio nunca se descuenta;
- cupón y descuento manual son mutuamente excluyentes.

El popup consulta `POST /api/discount/eligibility` para mostrar la base al operador, y `POST /api/orders` vuelve a calcular la elegibilidad antes de persistir.

### Cupón porcentual

```text
discount = eligibleSubtotal × porcentaje
```

### Cupón fijo

```text
discount = min(valorCupón, eligibleSubtotal)
```

### Manual

No puede superar `eligibleSubtotal`.

## Arquitectura de pagos

`Payment` contiene:

```ts
method
amount
cashReceived?
changeDue?
status
reference?
```

Para Efectivo:

- `cashReceived >= Order.total`;
- `changeDue = cashReceived - Order.total`;
- domicilio: vueltas para el domiciliario;
- local/recoger: cambio para el cajero.

Medios no efectivos dejan `cashReceived` y `changeDue` en `null`.

## APIs relevantes

- `GET /api/catalog`
- `/api/customers` y `/api/customers/[id]`
- `GET/PUT /api/settings`
- `/api/coupons` y `/api/coupons/[id]`
- `POST /api/discount/eligibility`
- `GET /api/orders`: consulta las últimas órdenes.
- `POST /api/orders`: crea una orden transaccional.
- `GET /api/orders/[id]`: detalle de una orden.
- `PATCH /api/orders/[id]`: edición controlada de una orden `CONFIRMED`.
- `POST /api/delivery/quote`: reservado para automatización futura basada en distancia.

## Próxima arquitectura: Cocina

Cocina debe leer órdenes operativas, inicialmente `status = CONFIRMED`, y permitir transiciones controladas:

```text
CONFIRMED → PREPARING → READY
```

Al pasar a `PREPARING`, la orden deja de ser editable desde Pedidos.

Después de `READY`, el flujo depende de modalidad:

- `DELIVERY`: eventualmente `OUT_FOR_DELIVERY → COMPLETED`;
- `PICKUP`: entrega al cliente → `COMPLETED`;
- `STORE`: servido/cerrado → `COMPLETED`.

Estas transiciones aún no están implementadas.

## Base de datos

Producción no tiene baseline formal de Prisma Migrate. Los cambios se aplican manualmente:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar un baseline formal.

## Documentación especializada

Para reglas específicas de pedidos, edición e impresión ver `docs/ORDERS.md`.

## Principio de diseño

POS, Chatwoot y futura app de clientes deben compartir el mismo motor de catálogo, precios, descuentos, cobertura, pedidos y pagos. Evitar duplicar reglas comerciales por canal.