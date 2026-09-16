# Estado actual del proyecto

Última actualización: 2026-09-16.

Este documento resume qué está funcionando hoy y cuál es el siguiente bloque aprobado de desarrollo. Para reglas específicas de pedidos ver `docs/ORDERS.md` y para integridad estructurada ver `docs/ORDER_DATA_INTEGRITY.md`.

## Ya implementado

### POS

- Domicilio, Recoger en tienda y Local.
- Cliente obligatorio para Domicilio y Recoger; opcional para Local.
- Búsqueda, creación y edición de clientes.
- Dirección obligatoria para Domicilio.
- Catálogo por categorías.
- Productos simples, pizzas, dos sabores, tamaños, bordes, extras y combos configurables.
- Tarifas de domicilio configurables.
- Medios de pago configurables.
- Cupones y descuento manual.
- Base elegible de descuentos validada en servidor.
- Efectivo con `Paga con` y `Vueltas`.
- Creación real y transaccional en PostgreSQL.

### Integridad estructurada del carrito

El POS usa ahora `src/components/StructuredPosPage.tsx`.

Cada `CartItem` transporta `configuration` estructurada desde el momento en que se selecciona el producto.

Nuevas pizzas guardan:

- `PizzaSize.id`, nombre, diámetro y precio snapshot;
- sabor/sabores por `Product.id`;
- `portion = 1` para un sabor o `0.5` para cada mitad;
- `PizzaCrust.id`, nombre y precio snapshot;
- modificadores por `Product.id`, nombre, cantidad y precio snapshot.

Nuevos combos guardan:

- `comboProductId`;
- `ruleId` de cada pizza incluida;
- tamaño y sabor con IDs;
- `groupId` de cada grupo;
- `optionId` y `productId` de cada selección;
- cantidades incluidas;
- precios snapshot y `priceDelta`;
- descuento propio del combo.

Productos simples usan `kind = STANDARD` con ID estable.

### Recalculo server-side

`POST /api/orders` ya no confía en el precio enviado por el navegador para pizzas y combos.

El servidor:

1. valida el producto padre;
2. exige configuración estructurada para `PIZZA_SINGLE`, `PIZZA_TWO_FLAVORS` y `COMBO`;
3. valida IDs de tamaño, sabores, borde, modificadores, reglas y opciones;
4. valida que las combinaciones pertenezcan a las reglas permitidas;
5. recalcula el precio desde PostgreSQL;
6. genera el snapshot estructurado definitivo de `OrderItem.configuration`;
7. calcula subtotal, descuentos, domicilio y total;
8. crea `Order + OrderItem + Payment` en una transacción.

Por tanto, una pizza o combo nuevo sin estructura válida debe ser rechazado.

### Pedidos

`/pedidos` permite:

- ver detalle estructurado de productos;
- tamaño, sabores, borde, extras y cantidades;
- componentes internos de combos;
- cliente, dirección y zona;
- subtotal, domicilio, descuento y total;
- pago, efectivo recibido y vueltas;
- editar pedidos `CONFIRMED`;
- imprimir comprobante térmico 80 mm;
- cancelar pedidos antes de iniciar Cocina;
- eliminar definitivamente pedidos ya cancelados.

### Cancelación / eliminación

`PATCH /api/orders/[id]` con `{ action: "cancel" }`:

- solo permite `DRAFT` o `CONFIRMED`;
- cambia `Order.status` a `CANCELED`;
- cambia pagos asociados a `CANCELED` salvo `REFUNDED`;
- conserva historial.

`DELETE /api/orders/[id]`:

- solo permite eliminar si la orden ya está `CANCELED`;
- elimina `Order` y por cascade sus `OrderItem` y `Payment`.

Eliminar definitivamente debe reservarse para pruebas/limpieza administrativa. Pedidos reales normalmente deben conservarse cancelados.

### Pedidos históricos

Los pedidos creados antes de este refactor pueden contener `POS_SNAPSHOT`.

Se conservan únicamente para presentación histórica e impresión. No deben utilizarse para inventario ni costos futuros.

Las órdenes nuevas de pizza/combo no deben volver a generar `POS_SNAPSHOT`.

### Edición controlada

Solo órdenes `CONFIRMED` pueden editarse. Una vez Cocina cambie la orden a `PREPARING`, la edición queda bloqueada.

La edición actual permite:

- cambiar modalidad;
- cambiar zona/tarifa;
- modificar cantidades;
- eliminar líneas;
- agregar productos simples;
- actualizar efectivo recibido.

Todavía no permite reconfigurar/agregar pizzas y combos dentro del editor. Esa evolución debe reutilizar el mismo constructor estructurado del POS.

### Impresión térmica 80 mm

Ruta:

`/pedidos/[id]/imprimir`

El comprobante usa `OrderItem.configuration` para presentar tamaño, sabores, borde, extras y componentes del combo.

No es factura electrónica fiscal; es comprobante operativo/de entrega.

## Reglas de descuentos

La base elegible excluye:

- domicilio;
- combos;
- productos con `couponEligible = false`.

No se acumula cupón + descuento manual.

## Efectivo

- `cashReceived` = efectivo entregado;
- `changeDue = cashReceived - total`;
- no se crea el pedido si el efectivo es menor al total.

## APIs principales

- `GET /api/catalog`
- `GET/POST /api/customers`
- `PATCH/DELETE /api/customers/[id]`
- `GET/PUT /api/settings`
- `GET/POST /api/coupons`
- `PATCH/DELETE /api/coupons/[id]`
- `POST /api/discount/eligibility`
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/[id]`
- `PATCH /api/orders/[id]`
- `DELETE /api/orders/[id]`

## Base de datos / despliegue

Este refactor de integridad estructurada utiliza el campo JSON `OrderItem.configuration` ya existente y no agrega columnas nuevas.

Si el schema anterior ya fue sincronizado, este bloque **no requiere `npx prisma db push`**.

Producción sigue sin baseline formal. Cuando un cambio futuro sí modifique Prisma usar:

```bash
npx prisma db push
```

No usar `prisma migrate deploy`.

## Prueba obligatoria antes de Cocina

Después del despliegue:

1. cancelar y eliminar los pedidos de prueba antiguos;
2. crear una pizza de un sabor;
3. crear una pizza dos sabores;
4. crear una pizza con borde y extra;
5. crear un combo con pizza + antojo + bebida;
6. crear un producto simple;
7. revisar `/pedidos` y el ticket 80 mm;
8. comprobar que tamaños, sabores, porciones, borde, extras y componentes se muestran correctamente;
9. no avanzar a inventario/Cocina si alguna línea nueva aparece solo como `POS_SNAPSHOT`.

## Próximo paso aprobado

Primero validar en producción la integridad estructurada de las órdenes nuevas.

Después:

1. Cocina leyendo órdenes `CONFIRMED`;
2. estados `CONFIRMED → PREPARING → READY`;
3. bloqueo de edición en `PREPARING`;
4. flujo de entrega/cierre;
5. inventario/recetas/costos usando los IDs estructurados.

## Regla de continuidad

Todo cambio funcional o estructural debe actualizar este documento y/o documentación especializada en el mismo bloque. Ver `docs/HANDOFF.md`.