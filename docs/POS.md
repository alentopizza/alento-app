# Punto de venta (POS)

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Ruta principal: `/`

Este documento describe el comportamiento vigente del Punto de Venta de Alentó App. Es la referencia funcional para creación de pedidos internos desde mostrador, domicilio y recogida.

## Objetivo

El POS permite configurar, cobrar y enviar un pedido al flujo operativo utilizando el mismo catálogo, reglas de precio y representación estructurada que consumen Pedidos y Cocina.

El POS no es un formulario separado del resto del sistema: crea la misma entidad `Order` que luego continúa por Pedidos, Cocina, pagos y Caja.

## Modalidades

Se soportan tres tipos:

- `DELIVERY` — Domicilio.
- `PICKUP` — Recoger.
- `STORE` — Local.

Domicilio y Recoger requieren cliente. Local permite cliente opcional.

En Domicilio se valida que exista una dirección utilizable antes de confirmar.

## Flujo general

```text
Seleccionar productos
→ configurar pizzas/combos cuando aplique
→ seleccionar modalidad
→ seleccionar/crear cliente cuando aplique
→ elegir condiciones de pago
→ confirmar pedido
→ POST /api/orders
→ Order + OrderItem + Payment
→ PREPARING
→ Pedidos
→ Cocina cuando existen productos que requieren preparación
```

Los productos pueden agregarse al carrito antes de terminar cliente/modalidad. Las validaciones obligatorias se aplican al cierre.

## Catálogo

El POS consume `GET /api/catalog`.

El catálogo entrega:

- categorías visibles y su orden persistente desde Menú;
- productos activos;
- productos destacados con orden independiente;
- pizzas;
- tamaños;
- bordes y precios por tamaño;
- modificadores/ingredientes extra;
- combos;
- reglas internas de combos.

### Navegación y búsqueda

Las categorías del POS respetan `Category.sortOrder` configurado en Menú.

El POS incluye búsqueda rápida por nombre/descripción y puede encontrar productos sin depender de la categoría activa.

Las tarjetas usan la misma línea visual aprobada en Menú: imagen 1:1 completa, bloque inferior oscuro, nombre, precio y acción `+`.

### Destacados

Un producto puede aparecer visualmente en la categoría Destacados sin convertirse en una entidad nueva.

El orden de Destacados es independiente y se administra desde Menú.

La lista `pizzaFlavors` se deduplica por `product.id`; marcar una pizza como destacada no puede duplicar su sabor dentro del configurador de dos sabores.

## Pizzas

Se soportan:

- pizza de un sabor;
- pizza de dos sabores.

La configuración guarda:

- producto;
- tamaño;
- diámetro;
- uno o dos sabores;
- `portion = 1` o `0.5`;
- borde;
- ingredientes extra;
- precios snapshot necesarios para recalculo/visualización.

### Tamaño

El tamaño se selecciona desde `PizzaSize`.

No se infiere por texto. El ID y snapshot viajan en `OrderItem.configuration`.

### Bordes

El borde se valida contra la disponibilidad/precio del tamaño seleccionado.

Un borde no disponible para el tamaño no puede confirmarse.

### Sabores

Las pizzas de dos sabores guardan ambos sabores como elementos independientes.

Ejemplo conceptual:

```ts
flavors: [
  { productId: 10, name: "Chicharrona", portion: 0.5 },
  { productId: 14, name: "Napolitana", portion: 0.5 }
]
```

### Ingredientes extra

Los extras se guardan como modificadores estructurados con ID, nombre, cantidad y precio snapshot.

No se deben representar como texto libre.

Regla vigente:

- `PIZZA_SINGLE`: puede usar ingredientes extra;
- `PIZZA_TWO_FLAVORS`: **no muestra ni acepta ingredientes extra**.

La restricción de dos sabores existe porque el modelo actual aplicaría el extra a toda la pizza y no puede expresar de forma inequívoca a qué mitad corresponde. Esta capacidad queda pendiente del futuro rediseño de modificadores documentado en `docs/MENU.md`.

### Nota para Cocina

Cada pizza puede llevar una observación opcional de máximo **120 caracteres**.

Ejemplos:

- `Ligera en salsa`
- `Sin jamón`
- `Bien tostada`

La nota se guarda en `OrderItem.notes`.

Viaja por:

```text
Configurador POS
→ carrito
→ checkout
→ PostgreSQL
→ Pedidos
→ Cocina
→ comprobante térmico
```

La nota no modifica precio ni sustituye tamaño, sabores, borde o extras.

## Combos

Los combos se configuran antes de entrar al carrito.

Pueden contener:

- pizzas;
- reglas de tamaño/sabor;
- grupos;
- opciones;
- cantidades;
- ajustes de precio;
- descuento propio del combo.

La configuración se persiste estructuradamente para que el combo no sea una caja negra para inventario/costos.

Las bebidas que formen parte de un combo pueden aparecer en la configuración comercial, pero Cocina no las trata como una tarea de preparación.

## Productos simples

Bebidas, antojos y otros productos no configurables usan representación `STANDARD`.

Conservan como mínimo:

- `productId`;
- nombre snapshot;
- cantidad;
- precio unitario.

## Carrito

El carrito permite:

- agregar productos;
- aumentar/disminuir cantidades;
- editar pizzas ya agregadas;
- editar combos;
- revisar configuración;
- revisar notas de Cocina;
- visualizar sabores mediante chips;
- ver subtotal antes del checkout.

Editar una pizza mantiene su nota existente.

## Clientes

El POS permite:

- buscar cliente;
- seleccionar cliente;
- crear cliente;
- editar cliente;
- administrar múltiples direcciones;
- agregar nuevas direcciones;
- editar una dirección existente;
- marcar una dirección como principal;
- eliminar direcciones;
- elegir en el checkout cuál dirección guardada usar para el domicilio.

`CustomerAddress` se trata como una colección. La dirección marcada `isDefault=true` solo es la selección inicial/preferida; no sustituye ni elimina las demás direcciones del cliente.

Un cliente nuevo puede guardar una primera dirección durante su creación. Una vez creado, las demás direcciones se administran con los endpoints específicos de direcciones.

En Domicilio, el checkout selecciona por defecto la dirección principal y, si existen varias, permite escoger otra antes de crear la orden.

El cliente comercial (`Customer`) es independiente del usuario interno (`User`).


### Dirección del cliente con Google Maps

El POS usa una única dirección por cliente.

Flujo:

`Cliente → Dirección de entrega → Google Maps → Guardar`

Reglas:

- no existe selección entre múltiples direcciones;
- no existe concepto operativo de dirección Principal;
- si la dirección tiene `placeId + latitude + longitude`, se considera validada;
- una dirección antigua sin datos Google debe actualizarse antes de usarla para domicilio;
- editar la dirección reemplaza la anterior;
- la captura principal siempre usa Google Maps;
- barrio e indicaciones siguen siendo complementarios;
- el backend elimina direcciones adicionales heredadas al guardar la dirección única.

## Precios y seguridad comercial

El navegador muestra precios como vista previa, pero **no es la fuente final**.

`POST /api/orders` vuelve a validar y recalcular server-side mediante la lógica compartida de normalización.

Se validan, entre otros:

- producto activo;
- tamaño;
- sabores;
- borde;
- extras;
- reglas de combo;
- opciones permitidas;
- cantidades;
- domicilio;
- descuentos;
- total.

No confiar en `unitPrice` enviado por el cliente para pizzas/combos.

## Pagos al crear el pedido

Seleccionar un medio de pago en POS no implica que el dinero ya haya sido recibido.

El pedido puede crear una referencia `Payment PENDING` que representa intención/medio previsto.

Caja contabiliza únicamente pagos `PAID`.

La recepción real del dinero se registra desde Pedidos.

## Creación del pedido

Endpoint:

`POST /api/orders`

La creación es transaccional.

Guarda:

- `Order`;
- `OrderItem`;
- configuración estructurada;
- notas;
- pagos/referencias iniciales.

### Estado inicial

Un pedido con productos que requieren Cocina nace en:

`PREPARING`

Las bebidas se crean como atendidas para preparación y no bloquean Cocina.

Un pedido compuesto únicamente por productos que no requieren preparación puede avanzar directamente fuera de la cola de Cocina según la regla backend vigente.

## Consecutivo comercial

El código visible no se construye con `Order.id`.

Se usa:

- `Order.sequenceNumber`;
- `Order.source`.

Ejemplo:

```text
POS-0006
POS-0007
WEB-0008
```

Todos los canales comparten la secuencia global.

El modal de pedido creado muestra el código comercial devuelto por el servidor.

## Confirmación visual de pedido creado

Después de guardar se muestra un modal moderno con:

- código comercial;
- modalidad;
- total;
- confirmación de que quedó disponible en operación;
- acción para iniciar un nuevo pedido.

## UI cerrada para esta etapa

El encabezado comunica:

`Configura, cobra y envía cada pedido a operación.`

Incluye un indicador visual de POS activo.

La interfaz prioriza:

- configuración rápida;
- tarjetas legibles;
- chips de sabores;
- jerarquía compacta;
- continuidad hacia Pedidos/Cocina.

## Archivos principales

- `src/components/StructuredPosPageV2.tsx`
- `src/components/PosCartLine.tsx`
- `src/components/OrderCheckoutModal.tsx`
- `src/app/api/catalog/route.ts`
- `src/app/api/orders/route.ts`
- `src/lib/orderLineNormalizer.ts`
- `src/lib/orderConfiguration.ts`
- `src/lib/orderCode.ts`

## Reglas de no regresión

- no volver a crear pizzas/combos como texto plano;
- no usar `Order.id` como consecutivo comercial;
- no duplicar sabores por pertenecer también a Destacados;
- no reactivar ingredientes extra en `PIZZA_TWO_FLAVORS` sin un modelo estructurado de alcance por mitad;
- respetar el orden de categorías y Destacados definido desde Menú;
- no considerar `Payment PENDING` como ingreso de Caja;
- no eliminar la nota de producto durante edición;
- no calcular precios finales de configurables únicamente en el navegador;
- no permitir que bebidas bloqueen el flujo de Cocina.

## Prisma

El cierre actual del POS no requiere cambios adicionales de schema.

No ejecutar `npx prisma db push` por cambios exclusivamente visuales/funcionales aquí documentados.


## Ruta interna vigente

El Punto de Venta se sirve desde `/interno`.

La raíz `/` corresponde a la experiencia pública principal de Alentó y no debe volver a protegerse como POS. El acceso del colaborador se realiza desde el login unificado y, según sus roles, puede redirigir a `/interno`.
