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
- El carrito puede armarse antes de seleccionar tipo de pedido o cliente.
- Las validaciones de tipo de pedido, cliente y dirección se aplican al cierre, no al botón `Agregar`.

### Flujo operativo del carrito

El POS no obliga a seguir un orden rígido para tomar el pedido.

Se permite:

1. agregar primero productos al carrito;
2. después seleccionar Domicilio / Recoger / Local;
3. después buscar o crear el cliente;
4. finalmente continuar al cierre.

Esto cubre llamadas o pedidos presenciales donde el cliente primero dicta los productos y entrega sus datos al final.

Reglas:

- `Agregar` debe estar disponible aunque todavía no exista cliente o tipo seleccionado;
- pizzas y combos siguen abriendo sus configuradores normalmente;
- el carrito conserva toda la configuración estructurada de productos;
- `Continuar pedido` sí permanece bloqueado hasta que exista al menos un producto y se cumplan las reglas comerciales;
- Domicilio requiere tipo `DELIVERY`, cliente y dirección;
- Recoger requiere tipo `PICKUP` y cliente;
- Local permite cliente opcional.

### Diseño operativo del POS

La interfaz del POS está entrando en su etapa de diseño casi final.

Reglas visuales actuales:

- no mostrar al operador etiquetas técnicas como `Datos estructurados` o `Estructurado`;
- la integridad estructurada sigue funcionando internamente y se considera una responsabilidad del sistema, no un mensaje de interfaz;
- encabezado principal más compacto para recuperar espacio vertical;
- texto operativo del encabezado: `Toma pedidos y confirma ventas desde una sola pantalla.`;
- bloque de tipo de pedido y cliente reducido en altura;
- se retiró el rótulo `Preparar pedido` del panel derecho;
- el rótulo de modalidad ahora es `SELECCIONE TIPO DE PEDIDO`, centrado y en rojo;
- el rótulo de cliente ahora es `INFORMACIÓN CLIENTE`, centrado y en rojo;
- ya no se muestran los pasos `1. Tipo`, `2. Cliente`, `OBLIGATORIO` u `OPCIONAL` como parte de esas cabeceras;
- la obligatoriedad de cliente para Domicilio y Recoger se mantiene en la lógica aunque ya no se repita visualmente en la cabecera;
- el selector de modalidad usa ahora un control compacto tipo segmented control;
- las etiquetas operativas visibles son `DOMICILIO`, `RECOGER` y `LOCAL`;
- `Recoger` representa internamente `PICKUP` / `Recoger en tienda`; solo se abrevia en la UI;
- la modalidad seleccionada se distingue con borde rojo suave, fondo blanco y sombra mínima;
- el bloque de cliente dejó de verse como una segunda columna separada por un divisor fuerte y pasa a una tarjeta secundaria compacta;
- buscar cliente usa botón negro solo con icono de lupa;
- crear cliente usa botón rojo solo con icono `+`;
- ambos controles tienen la misma altura y tamaño;
- `Editar` y `Cambiar` usan botones secundarios compactos;
- catálogo mantiene tarjetas compactas con imagen 1:1;
- el panel derecho funciona como área fija de pedido actual en escritorio;
- el listado de productos del carrito es la zona que hace scroll;
- subtotal, total y botón `Continuar pedido` permanecen visibles en la zona inferior del panel derecho sin exigir scroll de la página;
- los detalles técnicos de inventario/costos no deben contaminar la experiencia diaria del cajero.

La UI puede seguir recibiendo ajustes menores, pero no se deben sacrificar las reglas de integridad de `OrderItem.configuration` por decisiones visuales.

### Administración de Menú

`/menu` vuelve a funcionar como módulo administrativo independiente del POS.

Reglas actuales:

- los estilos exclusivos del POS quedan encapsulados y no deben afectar `/menu`, `/pedidos`, `/clientes` o `/configuracion`;
- la columna lateral de categorías debe mostrar todas las categorías administrativas y su cantidad de productos;
- el encabezado de Menú conserva su propio texto: `Productos, precios, imágenes, destacados y combos configurables.`;
- se mantiene búsqueda por producto;
- se mantiene creación y edición de productos;
- se mantiene activar/desactivar y mostrar/ocultar del POS;
- se mantiene constructor/configuración de combos;
- cada tarjeta de producto incluye ahora acción `Eliminar`.

#### Eliminación segura de productos

`DELETE /api/menu-admin` recibe `{ productId }`.

El borrado físico solo se permite si el producto:

- no tiene `OrderItem` históricos;
- no es opción de ningún combo;
- no es sabor permitido de ningún combo;
- no tiene otras relaciones que provoquen una restricción de integridad.

Si existe historial de pedidos o dependencias de combos, la API responde `409` y el producto **no se elimina**. En esos casos la operación correcta es:

1. desactivar el producto;
2. ocultarlo del POS;
3. retirarlo de combos si corresponde.

Esta regla protege el futuro inventario/costos y evita romper pedidos históricos.

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
- `GET/PATCH/POST/DELETE /api/menu-admin`
- `POST /api/discount/eligibility`
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/[id]`
- `PATCH /api/orders/[id]`
- `DELETE /api/orders/[id]`

## Base de datos / despliegue

Este refactor de integridad estructurada utiliza el campo JSON `OrderItem.configuration` ya existente y no agrega columnas nuevas.

La recuperación de `/menu`, la eliminación segura de productos y los últimos ajustes visuales/operativos del POS tampoco agregan columnas nuevas.

Si el schema anterior ya fue sincronizado, este bloque **no requiere `npx prisma db push`**.

Producción sigue sin baseline formal. Cuando un cambio futuro sí modifique Prisma usar:

```bash
npx prisma db push
```

No usar `prisma migrate deploy`.

## Prueba obligatoria antes de Cocina

Después del despliegue:

1. abrir `/menu` y comprobar que todas las categorías vuelvan a mostrarse;
2. comprobar que el encabezado de Menú ya no herede texto del POS;
3. editar/activar/ocultar un producto y comprobar recarga correcta;
4. crear un producto de prueba y eliminarlo si todavía no tiene dependencias;
5. intentar eliminar un producto usado en un pedido o combo y confirmar que el sistema lo bloquee con mensaje claro;
6. cancelar y eliminar los pedidos de prueba antiguos;
7. sin seleccionar tipo ni cliente, agregar un producto simple y confirmar que entra al carrito;
8. sin seleccionar cliente, abrir y configurar una pizza y confirmar que entra al carrito;
9. sin seleccionar cliente, abrir y configurar un combo y confirmar que entra al carrito;
10. comprobar que `Continuar pedido` siga bloqueado hasta completar tipo/cliente/dirección según corresponda;
11. crear una pizza de un sabor;
12. crear una pizza dos sabores;
13. crear una pizza con borde y extra;
14. crear un combo con pizza + antojo + bebida;
15. crear un producto simple;
16. revisar `/pedidos` y el ticket 80 mm;
17. comprobar que tamaños, sabores, porciones, borde, extras y componentes se muestran correctamente;
18. comprobar visualmente que `Continuar pedido` permanece disponible sin hacer scroll largo del POS;
19. no avanzar a inventario/Cocina si alguna línea nueva aparece solo como `POS_SNAPSHOT`.

## Próximo paso aprobado

Primero validar en producción la integridad estructurada de las órdenes nuevas, el layout casi final del POS y la recuperación del módulo Menú.

Después:

1. Cocina leyendo órdenes `CONFIRMED`;
2. estados `CONFIRMED → PREPARING → READY`;
3. bloqueo de edición en `PREPARING`;
4. flujo de entrega/cierre;
5. inventario/recetas/costos usando los IDs estructurados.

## Regla de continuidad

Todo cambio funcional o estructural debe actualizar este documento y/o documentación especializada en el mismo bloque. Ver `docs/HANDOFF.md`.