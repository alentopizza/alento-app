# Pedidos, edición e impresión

Este documento describe el comportamiento operativo de las órdenes persistidas en Alentó App.

## Creación

Las órdenes se crean desde el POS mediante `POST /api/orders`.

Una orden nueva nace con:

- `source = POS`;
- `status = CONFIRMED`;
- un `Payment` con `status = PENDING`;
- código visual derivado de `Order.id`: `ALT-000001`, `ALT-000002`, etc.

La creación es transaccional: `Order`, `OrderItem` y `Payment` se guardan dentro de una única transacción Prisma.

## Integridad estructurada obligatoria

A partir del refactor inventory-ready, toda pizza y combo nuevo debe llegar a `POST /api/orders` con `OrderItem.configuration` estructurada.

El servidor ya no acepta una pizza o combo nuevo basado solamente en texto o precio enviado por el navegador.

El servidor valida IDs y recalcula el precio desde PostgreSQL.

Ver `docs/ORDER_DATA_INTEGRITY.md` para la especificación completa.

### Pizza

Guarda de forma estructurada:

- `productId` de la pizza;
- tamaño con `PizzaSize.id`, nombre, diámetro y precio snapshot;
- sabor o sabores con `Product.id`, nombre, precio snapshot y `portion` (`1` o `0.5`);
- borde con `PizzaCrust.id`, nombre y precio snapshot;
- modificadores con `Product.id`, nombre, cantidad y precio unitario snapshot.

Una pizza de dos sabores conserva ambos sabores por separado con `portion = 0.5`.

### Combo

Guarda:

- `comboProductId`;
- pizzas incluidas con `ruleId`, tamaño y sabor;
- cada grupo del combo por `groupId`;
- cada opción seleccionada por `optionId` y `productId`;
- cantidad incluida de cada opción;
- precio snapshot y `priceDelta`;
- descuento propio del combo.

Esto evita que un combo sea una caja negra para inventario.

### Producto estándar

Bebidas, antojos y productos simples usan `kind = STANDARD` y conservan `productId` y nombre snapshot.

## Recalculo server-side

`POST /api/orders` recalcula:

- precio de tamaño;
- precio del sabor de mayor valor en dos sabores;
- precio del borde por tamaño;
- modificadores y cantidades;
- componentes permitidos de combos;
- cantidades incluidas en grupos de combo;
- descuento propio del combo;
- subtotal;
- descuentos/cupones;
- domicilio;
- total.

Una configuración inválida o que use IDs no permitidos es rechazada.

El `unitPrice` enviado por el navegador es solamente una vista previa y no es la fuente final para pizzas/combos.

## Pedidos históricos

Los pedidos creados antes del refactor pueden contener `POS_SNAPSHOT`.

Ese formato se conserva únicamente para compatibilidad visual e impresión histórica. No debe utilizarse como fuente fiable para inventario o costos y no debe generarse en órdenes nuevas.

`src/lib/orderPresentation.ts` puede interpretar esos snapshots antiguos para visualización.

## Pantalla `/pedidos`

La pantalla muestra:

- código;
- fecha/hora;
- estado;
- modalidad;
- cliente;
- teléfono;
- dirección y zona cuando aplica;
- detalle estructurado de cada producto;
- tamaño, sabores, borde, extras y cantidades;
- componentes internos del combo;
- subtotal, domicilio, descuento y total;
- medio de pago;
- `Paga con` y `Vueltas` para efectivo;
- cupón usado.

## Edición controlada

Endpoints:

- `GET /api/orders/[id]`: detalle completo;
- `PATCH /api/orders/[id]`: modificación controlada.

Solo una orden con `status = CONFIRMED` puede editarse normalmente. Cuando Cocina la mueva a `PREPARING`, la edición queda bloqueada.

Actualmente permite:

- cambiar modalidad;
- cambiar zona/tarifa al pasar a Domicilio;
- modificar cantidades de líneas existentes;
- quitar líneas llevando cantidad a cero;
- agregar productos simples activos;
- actualizar `Paga con` si el total aumenta.

La edición completa de pizzas/combos debe reutilizar más adelante el mismo constructor estructurado del POS. Nunca debe modificar texto descriptivo para representar un cambio de configuración.

## Cancelar y eliminar pedidos

### Cancelar

`PATCH /api/orders/[id]` con:

```json
{ "action": "cancel" }
```

Solo permite cancelar pedidos que todavía no iniciaron Cocina (`DRAFT` o `CONFIRMED`).

Al cancelar:

- `Order.status` pasa a `CANCELED`;
- los pagos asociados pasan a `CANCELED` salvo un eventual pago ya `REFUNDED`;
- el historial se conserva.

Esta es la operación recomendada para pedidos reales que fueron anulados.

### Eliminar definitivamente

`DELETE /api/orders/[id]` solo funciona si el pedido ya tiene `status = CANCELED`.

La eliminación borra el `Order` y, por las relaciones `onDelete: Cascade`, sus `OrderItem` y `Payment`.

Debe reservarse principalmente para pruebas o limpieza administrativa. Una venta real normalmente debe permanecer como `CANCELED` para conservar trazabilidad.

En `/pedidos`:

1. `Cancelar pedido` aparece para órdenes todavía no preparadas.
2. `Eliminar definitivamente` aparece únicamente después de cancelar.

## Recalculo al editar

Al guardar una edición se recalculan subtotal, domicilio, total, `Payment.amount` y `changeDue` si es efectivo.

El descuento monetario ya confirmado se conserva como snapshot histórico y se limita a la nueva base elegible si fuese necesario. En esta etapa no se reevalúa automáticamente el porcentaje de un cupón sobre productos agregados después de la confirmación original.

## Comprobante térmico 80 mm

Ruta:

`/pedidos/[id]/imprimir`

Incluye:

- identidad del local;
- fecha/hora;
- número/código;
- modalidad;
- cliente y dirección;
- checklist de despacho;
- configuración estructurada del producto;
- subtotal, domicilio, descuento y total;
- medio de pago;
- efectivo recibido y vueltas;
- cupón.

`window.print()` dispara la impresión y `@media print` oculta la interfaz general.

Este comprobante es operativo/de entrega y no sustituye facturación electrónica fiscal.

## Próximo paso

Antes de Cocina se debe desplegar y probar una nueva muestra de órdenes estructuradas:

1. pizza de un sabor;
2. pizza de dos sabores;
3. pizza con borde y extra;
4. combo con pizza, antojo y bebida;
5. producto estándar.

Se debe revisar en PostgreSQL/Pedidos que todos los IDs, cantidades y porciones estén presentes.

Después de validar esta integridad, Cocina puede consumir la misma estructura sin inferir texto.