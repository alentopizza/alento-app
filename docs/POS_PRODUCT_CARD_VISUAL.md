# Diseño de tarjetas de producto del POS

Última actualización: 2026-10-01.

## Fuente visual canónica

El POS ya no mantiene una tarjeta visual propia.

La tarjeta del **menú público del cliente** es la fuente de verdad visual y se comparte con:

- `/menu`;
- POS;
- Menú administrativo.

Las clases canónicas viven en `src/app/globals.css` bajo:

- `.alento-product-card`;
- `.alento-product-card-media`;
- `.alento-product-card-image`;
- `.alento-product-card-body`;
- `.alento-product-card-title`;
- `.alento-product-card-footer`;
- `.alento-product-card-price`;
- `.alento-product-card-action`.

## Reglas visuales

- fondo oscuro;
- imagen 1:1;
- imagen a sangre con `object-cover`;
- nombre en el bloque inferior;
- precio, `Desde` o `Ahorra` en rojo;
- CTA circular rojo `+`;
- mismas proporciones y hover que el menú del cliente.

## Comportamiento POS

La unificación es solo visual. No cambia:

- `startAdd(product)`;
- configuración de pizzas;
- configuración de combos;
- precios;
- integridad estructurada de `CartItem.configuration`;
- reglas de cierre del pedido.

## Regla de no regresión

No crear otra variante visual local de tarjeta para POS.

Si cambia la tarjeta aprobada, modificar el estilo compartido `.alento-product-card*` para que menú público, POS y administración hereden el cambio.
