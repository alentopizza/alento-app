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

Punto de venta. Construye el pedido, cliente, modalidad, productos, descuentos, domicilio y pago. El cierre ahora crea una orden real en PostgreSQL.

### `/pedidos`

Consulta las órdenes persistidas más recientes con cliente, tipo, estado, productos, totales y pago.

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

`CONFIRMED` significa que la orden ya es válida y debe entrar al flujo operativo. El siguiente módulo debe definir las transiciones de Cocina.

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

### Estado actual de `configuration`

El diseño final debe transportar IDs estructurados desde el constructor del carrito:

- pizza: tamaño, sabores, borde, modificadores;
- combo: pizzas, sabores, tamaños y selecciones de grupos.

La API admite `configuration`, pero el carrito actual todavía no la llena completamente. Mientras tanto, pizzas y combos se persisten con un snapshot `POS_SNAPSHOT` del detalle legible y el precio calculado por el POS.

Esta es una decisión temporal y está documentada como deuda técnica. Antes de exponer creación de pedidos a un canal no confiable (por ejemplo una app pública), debe completarse la validación/recalculado server-side de pizzas y combos.

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
- `POST /api/delivery/quote`: reservado para automatización futura basada en distancia.

## Próxima arquitectura: Cocina

Cocina debe leer únicamente órdenes operativas, inicialmente `status = CONFIRMED`, y permitir transiciones controladas:

```text
CONFIRMED → PREPARING → READY
```

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

## Principio de diseño

POS, Chatwoot y futura app de clientes deben compartir el mismo motor de catálogo, precios, descuentos, cobertura, pedidos y pagos. Evitar duplicar reglas comerciales por canal.