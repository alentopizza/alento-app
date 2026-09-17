# POS — Carrito y resumen visual

Última actualización: 2026-09-17.

Este documento registra el lenguaje visual actual del carrito lateral del Punto de Venta.

## Objetivo

El carrito del POS reutiliza ahora el lenguaje visual del drawer de detalle de `/pedidos` para que ambos módulos se sientan parte del mismo producto.

La modificación es **exclusivamente visual**. No cambia:

- precios;
- cantidades;
- estructura de `CartItem`;
- `OrderItem.configuration`;
- configuradores de pizza/combo;
- validaciones de cliente/modalidad;
- checkout;
- persistencia de pedidos.

## Jerarquía visual

El panel lateral se organiza visualmente así:

1. encabezado oscuro del pedido actual;
2. bloque blanco de modalidad y cliente;
3. bloque blanco de productos con scroll propio;
4. footer blanco de totales y acción principal.

El fondo general del drawer es crema cálido, mientras las superficies operativas permanecen blancas.

## Encabezado

El resumen `Pedido actual` se presenta como un encabezado oscuro con el lenguaje visual de Alentó y un acento rojo inferior, siguiendo el mismo patrón del detalle de Pedidos.

Mantiene visibles el número de productos, cliente seleccionado y modalidad actual cuando existen.

## Cliente y modalidad

El selector `Domicilio / Recoger / Local` mantiene exactamente la lógica existente.

El bloque de cliente continúa permitiendo:

- buscar;
- crear;
- editar;
- cambiar cliente;
- completar dirección de domicilio.

Su presentación se integra como una tarjeta operativa blanca debajo del encabezado oscuro.

## Productos

La zona de productos es la única parte principal del drawer que debe hacer scroll cuando existen muchas líneas.

Cada línea usa `PosCartLine` y presenta ahora con mayor jerarquía:

- `cantidad × producto`;
- total de la línea;
- tamaño y borde;
- sabores cuando corresponda;
- extras;
- componentes de combo;
- precio unitario;
- control de cantidad;
- acceso a editar pizzas/combos configurables.

La densidad se mantiene mayor que en el drawer de Pedidos porque un carrito puede contener muchas líneas antes de confirmar una orden.

## Totales y acción principal

El footer permanece visible y separado del scroll de productos.

Contiene:

- subtotal;
- total de productos;
- botón `Continuar pedido`.

El total usa rojo Alentó como punto focal.

La lógica completa de domicilio, descuentos, pago y confirmación sigue viviendo en el checkout; este rediseño no mueve esas responsabilidades al carrito.

## Estado vacío

Cuando no existen productos, el espacio del carrito permanece compacto y no desplaza innecesariamente los controles principales.

El mensaje de estado vacío continúa siendo informativo y no compite visualmente con modalidad, cliente o el footer.

## Implementación

Archivos relevantes:

- `src/components/StructuredPosPageV2.tsx`: estructura y lógica del POS.
- `src/components/PosCartLine.tsx`: presentación semántica de cada línea.
- `src/app/pos-cart-line.css`: estilos de las líneas del carrito.
- `src/app/pos-cart-detail-style.css`: lenguaje visual del drawer inspirado en el detalle de Pedidos.
- `src/app/layout.tsx`: activa las hojas de estilo.

La hoja `pos-cart-detail-style.css` está separada deliberadamente del CSS histórico del POS para que futuros ajustes o una reversión visual no obliguen a modificar la lógica ni otros módulos.

## Regla para cambios futuros

No usar ajustes visuales del carrito como motivo para modificar la estructura persistida de productos o simplificar `OrderItem.configuration`.

Si se cambia el diseño, conservar siempre:

- edición de configuraciones;
- cantidades;
- información suficiente para entender cada producto;
- scroll independiente de productos;
- totales y acción principal accesibles.

## Base de datos

Este cambio es únicamente de interfaz. No modifica Prisma ni requiere `npx prisma db push`.