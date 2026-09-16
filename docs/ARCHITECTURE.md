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

Punto de venta: tipo de pedido, cliente, catálogo, configuración de productos, carrito, domicilio, descuentos, medio de pago y revisión de cierre.

### `/clientes`

Directorio, búsqueda y edición de clientes. Domicilio y Recoger en tienda requieren cliente para conservar historial.

### `/menu`

Administración del catálogo, categorías, pizzas, modificadores y combos.

### `/cupones`

Administración de descuentos reutilizables. Soporta:

- `FIXED`: descuento plano en pesos;
- `PERCENTAGE`: porcentaje sobre productos elegibles;
- estado activo/inactivo.

Los cupones activos se consumen desde el cierre del POS mediante `/api/coupons?active=1`.

### `/configuracion`

Fuente de verdad para ubicación del local, zonas/tarifas de domicilio y medios de pago.

### `/cocina`

Destino operativo de pedidos confirmados. La conexión real depende de terminar primero la persistencia de pedidos.

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
9. Revisión final.
10. Creación persistente del pedido.
11. Envío a Cocina.

## Configuración operativa

`AppSetting` almacena `pos_settings` en JSON. Incluye ubicación, `deliveryBands` y `paymentMethods`.

En la operación actual, `deliveryBands` funciona como catálogo manual de zonas/tarifas. El operador usa `name`, `fee` y `active`. `minMeters` y `maxMeters` quedan reservados para automatización futura con mapas.

Google Maps no es dependencia operativa por ahora. Una integración futura debe automatizar la selección de zona, no sustituir la configuración comercial.

## Arquitectura de descuentos

Hay dos clases de descuento operativo en el cierre:

### Cupón

Entidad persistente `Coupon`:

```ts
Coupon {
  id
  name
  type: FIXED | PERCENTAGE
  value
  active
}
```

Los cupones nunca se calculan directamente sobre `Order.subtotal`. Antes se obtiene una **base elegible**.

### Elegibilidad de productos

`Product` contiene:

```ts
couponEligible Boolean @default(true)
```

La regla comercial es:

- un producto normal participa si `couponEligible = true`;
- cualquier `COMBO` queda excluido siempre, aunque el campo estuviera activo;
- futuras ofertas o promociones que ya reduzcan el precio original deben guardar `couponEligible = false`;
- el domicilio (`deliveryFee`) nunca forma parte de la base elegible.

La elegibilidad se calcula del lado servidor mediante:

`POST /api/discount/eligibility`

El endpoint recibe líneas del carrito con `productId`, `unitPrice` y `quantity`, consulta los productos reales y devuelve:

```ts
{
  eligibleSubtotal,
  excludedSubtotal,
  eligibleProductIds,
  excludedProductIds
}
```

Esto evita confiar en una bandera enviada por el navegador y centraliza la regla comercial.

### Cupón porcentual

Se calcula así:

```text
desconto = eligibleSubtotal × porcentaje
```

Ejemplo:

- pizza normal: $40.000;
- combo promocional: $30.000;
- domicilio: $10.000;
- base elegible: $40.000;
- cupón 60%: $24.000;
- total final: $56.000.

Ni el combo ni el domicilio reciben el descuento.

### Cupón fijo

El descuento queda limitado a la base elegible:

```text
desconto = min(valorCupón, eligibleSubtotal)
```

Un cupón de $10.000 sobre solo $7.000 elegibles descuenta $7.000.

### Descuento manual

Es una excepción operativa, pero respeta exactamente la misma base elegible. No puede rebajar combos, productos promocionales ni domicilio y nunca puede superar `eligibleSubtotal`.

### Regla de exclusividad

Un pedido usa una sola fuente:

- sin descuento;
- cupón;
- manual.

No acumular cupón + manual.

## Snapshot del descuento en el pedido

`Order` contiene:

- `couponId`: relación opcional con el cupón;
- `couponName`: snapshot del nombre usado;
- `discount`: valor monetario final aplicado.

El snapshot permite que el historial conserve lo ocurrido aunque el cupón sea renombrado o modificado después.

## APIs relevantes

- `/api/catalog`: catálogo POS.
- `/api/customers` y `/api/customers/[id]`: clientes.
- `/api/settings`: configuración operativa.
- `/api/coupons`: listar y crear cupones.
- `/api/coupons/[id]`: editar/eliminar cupones.
- `/api/discount/eligibility`: calcula el subtotal que puede recibir descuentos.
- `/api/delivery/quote`: reservado para automatización futura basada en distancia.

## Datos de pedidos

Prisma contiene `Order`, `OrderItem`, `Payment`, `Customer`, `CustomerAddress` y `Coupon`.

`Order` dispone de subtotal, domicilio, descuento, total, tipo, fuente, relaciones con cliente/dirección/cupón, items y pagos.

## Base de datos

La base de producción existente no tiene baseline de Prisma Migrate. Por ahora los cambios de schema se aplican manualmente con:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar un baseline formal.

## Principio de diseño

POS, Chatwoot y futura app de clientes deben compartir el mismo motor de catálogo, precios, descuentos, cobertura, pedidos y pagos. Evitar duplicar reglas comerciales por canal.
