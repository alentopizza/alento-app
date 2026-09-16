# Arquitectura de Alentó App

Este documento describe cómo está organizada Alentó App, cuál es la responsabilidad de cada módulo y qué decisiones deben respetarse al continuar el desarrollo.

## Objetivo del proyecto

Alentó App es la aplicación operativa propia de Alentó Pizza. Su objetivo es centralizar clientes, catálogo, precios, descuentos, pedidos, cocina, caja, pagos, configuración operativa, inventario/costos futuros e integraciones.

Chatwoot debe funcionar como canal de atención, no como un segundo sistema de pedidos. Alentó App conserva las reglas y los datos comerciales.

## Stack e infraestructura

- Next.js 15 + React 19 + TypeScript + Tailwind CSS 4.
- Prisma 6 + PostgreSQL.
- EasyPanel/VPS.
- Proyecto: `app_alento`.
- Servicio: `alento-app`.
- PostgreSQL: `alento-db`.
- POS: `https://pos.alentopizza.com/`.

## Principio crítico: el pedido es fuente futura de inventario

Cada orden debe conservar exactamente qué se vendió.

El texto visible del ticket no es una fuente de inventario. Para órdenes nuevas de pizzas y combos la fuente válida es `OrderItem.configuration` estructurada con IDs, cantidades, porciones y snapshots.

Ver `docs/ORDER_DATA_INTEGRITY.md`.

## Módulos principales

### `/`

Punto de venta. La ruta usa `src/components/StructuredPosPage.tsx`.

El carrito crea configuración estructurada desde el momento de la selección del producto.

### `/pedidos`

Consulta órdenes persistidas con detalle estructurado, edición controlada, cancelación/eliminación administrativa e impresión térmica.

### `/pedidos/[id]/imprimir`

Comprobante operativo de 80 mm basado en la configuración persistida.

### `/clientes`

Directorio, búsqueda y edición de clientes.

### `/menu`

Administración del catálogo, categorías, pizzas, modificadores y combos.

### `/cupones`

Administración de descuentos reutilizables.

### `/configuracion`

Fuente de verdad para ubicación del local, zonas/tarifas de domicilio y medios de pago.

### `/cocina`

Destino operativo de órdenes confirmadas. Debe consumir la misma configuración estructurada del pedido.

## Tipos de pedido

- `DELIVERY`: Domicilio. Cliente y dirección obligatorios.
- `PICKUP`: Recoger en tienda. Cliente obligatorio.
- `STORE`: Local. Cliente opcional.

## Flujo del POS

1. Tipo de pedido.
2. Cliente cuando corresponde.
3. Construcción estructurada del producto.
4. Carrito con `configuration`.
5. Cierre: domicilio, descuento y pago.
6. `POST /api/orders`.
7. Validación/recalculo server-side.
8. Transacción `Order + OrderItem + Payment`.
9. Orden nace `CONFIRMED`.

## Configuración estructurada de OrderItem

### `PIZZA`

Debe conservar:

- producto padre;
- tamaño con `PizzaSize.id`;
- sabor(es) con `Product.id`;
- `portion` de cada sabor;
- borde con `PizzaCrust.id`;
- modificadores con `Product.id` y cantidad;
- snapshots de nombre/precio/diámetro necesarios para histórico.

Dos sabores usan `portion = 0.5` para cada mitad.

### `COMBO`

Debe conservar:

- `comboProductId`;
- `ruleId` de pizzas;
- tamaño y sabor de cada pizza;
- `groupId` de grupos;
- `optionId` y `productId` de selecciones;
- cantidades incluidas;
- snapshots de precios y `priceDelta`;
- descuento propio del combo.

### `STANDARD`

Producto simple identificado por `productId` y snapshot de nombre.

### `POS_SNAPSHOT`

Formato histórico anterior al refactor. Se conserva para visualizar órdenes antiguas, pero no debe volver a generarse para pizzas/combos nuevos y no sirve como fuente fiable de inventario.

## Arquitectura de creación de pedidos

`POST /api/orders` es la entrada persistente.

El servidor debe:

- validar modalidad, cliente y dirección;
- validar zona y medio de pago;
- comprobar producto padre;
- exigir configuración estructurada para pizzas y combos;
- validar IDs activos;
- comprobar que tamaños, sabores y opciones pertenecen a reglas permitidas;
- recalcular precios desde PostgreSQL;
- recalcular base elegible/descuento;
- validar efectivo;
- persistir todo dentro de una transacción.

El navegador puede calcular precios para vista previa, pero no es fuente autoritativa del precio final de pizzas y combos.

## IDs + snapshots

Cada selección importante conserva:

1. ID estable para inventario, recetas y costos.
2. Snapshot legible/comercial para histórico.

Nunca usar el nombre como clave de negocio ni reconstruir una orden nueva a partir de texto.

## Futuro inventario y costos

La relación objetivo es:

```text
Order
→ OrderItem.configuration
→ tamaño / sabores / borde / extras / componentes de combo
→ recetas
→ consumo de insumos
→ costo teórico del pedido
```

Ejemplo de dos sabores:

```text
Grande
+ receta base Grande
+ Hawaiana Grande × 0.5
+ Chicharrona Grande × 0.5
+ Borde Cheddar Grande × 1
+ Extra Pepperoni Grande × 1
```

Por eso `portion` y `quantity` son datos obligatorios.

## Edición controlada

Solo pedidos `CONFIRMED` pueden editarse.

Actualmente permite modalidad, tarifa, cantidades y productos simples. La futura edición completa de pizzas/combos debe reutilizar el mismo constructor estructurado del POS.

No se debe editar manualmente una descripción textual para representar cambios de tamaño/sabor/borde/extras.

## Cancelación y eliminación

Cancelar:

- permitido para `DRAFT` o `CONFIRMED`;
- cambia `Order.status` a `CANCELED`;
- cancela pagos asociados;
- conserva trazabilidad.

Eliminar definitivamente:

- solo permitido para `CANCELED`;
- pensado principalmente para pruebas/limpieza administrativa;
- borra por cascade líneas y pagos.

Pedidos reales anulados deberían conservarse como `CANCELED`.

## Snapshot comercial de Order

`Order` conserva zona, cupón, origen del descuento, subtotal, domicilio, descuento y total para que el histórico no cambie por configuraciones futuras.

## Impresión térmica

`/pedidos/[id]/imprimir` presenta el pedido usando `OrderItem.configuration`. El comprobante es operativo y no factura electrónica fiscal.

## Descuentos

- combos no son elegibles;
- `couponEligible = false` excluye el producto;
- domicilio nunca se descuenta;
- cupón y descuento manual no se acumulan.

## Pagos

Para efectivo:

- `cashReceived >= total`;
- `changeDue = cashReceived - total`.

## APIs relevantes

- `GET /api/catalog`
- `/api/customers` y `/api/customers/[id]`
- `GET/PUT /api/settings`
- `/api/coupons` y `/api/coupons/[id]`
- `POST /api/discount/eligibility`
- `GET/POST /api/orders`
- `GET/PATCH/DELETE /api/orders/[id]`

## Próxima arquitectura: Cocina

Cocina debe consumir exclusivamente los datos persistidos en la orden:

```text
CONFIRMED → PREPARING → READY
```

Al pasar a `PREPARING`, la orden deja de ser editable.

Antes de desarrollar Cocina se debe probar en producción que todas las órdenes nuevas de pizza/combo quedan estructuradas correctamente.

## Base de datos

Producción no tiene baseline formal de Prisma Migrate. Para cambios futuros de schema usar:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar baseline.

El refactor actual utiliza el JSON `OrderItem.configuration` ya existente y no requiere nuevas columnas.

## Documentación especializada

- `docs/ORDERS.md`
- `docs/ORDER_DATA_INTEGRITY.md`
- `docs/CURRENT_STATE.md`
- `docs/HANDOFF.md`

## Principio de diseño

POS, Chatwoot, Cocina, inventario y futura app de clientes deben compartir el mismo motor de catálogo, configuración de producto, precios, descuentos, cobertura, pedidos y pagos.