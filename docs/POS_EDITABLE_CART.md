# POS — carrito estructurado y editable

Última actualización: 2026-09-16.

## Objetivo

El carrito del POS debe mostrar al operador la configuración real del producto sin obligarlo a interpretar una frase larga. Además, pizzas y combos agregados al carrito pueden reabrirse para corregir su configuración antes de cerrar el pedido.

## Presentación de pizzas

Las líneas de pizza usan `OrderLineConfiguration` y no reconstruyen los datos desde texto libre.

Para una pizza de dos sabores se muestran campos separados:

- Tamaño
- Borde
- Sabor 1
- Sabor 2

Ejemplo:

- Tamaño: Personal
- Borde: Tradicional
- Sabor 1: Chicharrona
- Sabor 2: Napolitana

Para una pizza de un sabor se muestran:

- Tamaño
- Borde
- Sabor

Los ingredientes adicionales aparecen como etiquetas individuales, por ejemplo `+ Jamón`, `+ Pepperoni`.

## Combos

Cada pizza incluida en el combo se presenta por separado con tamaño y sabor. Antojos, bebidas y otras selecciones se muestran como etiquetas con el nombre del grupo y la opción seleccionada.

## Edición desde el carrito

Las líneas con `configuration.kind = PIZZA` o `COMBO` son editables.

Al hacer click sobre la línea:

1. se abre el mismo configurador utilizado al agregar el producto;
2. se precargan tamaño, sabores, borde, extras o selecciones del combo desde el snapshot del carrito;
3. el CTA cambia de `Agregar al pedido` / `Agregar combo` a `Guardar cambios`;
4. al confirmar se reemplaza la misma línea del carrito;
5. se conserva `key` y `quantity` de la línea existente;
6. se recalcula `unitPrice` con la configuración nueva.

No se agrega una línea duplicada al editar.

Los productos `STANDARD` no abren configurador porque no tienen modificadores estructurados en el POS actual; siguen permitiendo modificar cantidad con `- / +`.

## Componentes

- `src/components/StructuredPosPageV2.tsx`: flujo POS actual con edición de líneas.
- `src/components/PosCartLine.tsx`: render estructurado de cada línea.
- `src/app/pos-cart-line.css`: estilo visual del carrito estructurado.
- `src/app/page.tsx`: carga `StructuredPosPageV2`.

## Integridad de datos

La edición trabaja sobre `OrderItem.configuration` compatible con el modelo ya documentado en `docs/ORDER_DATA_INTEGRITY.md`.

No se convierten los datos a texto libre para guardar el pedido. Tamaños, sabores, bordes, modificadores, reglas y opciones conservan sus IDs y snapshots estructurados.

## Base de datos

Este cambio no modifica Prisma ni agrega columnas. No requiere `prisma db push`.

## Prueba recomendada

1. agregar Pizza 2 Sabores;
2. comprobar Tamaño, Borde, Sabor 1 y Sabor 2 por separado;
3. hacer click en la línea;
4. cambiar un sabor y guardar;
5. confirmar que la línea se actualice sin duplicarse;
6. agregar pizza de un sabor con dos extras;
7. confirmar que los extras aparezcan como etiquetas;
8. reabrirla, retirar/agregar extras y guardar;
9. agregar un combo;
10. reabrirlo, cambiar bebida o antojo y guardar;
11. cambiar cantidades con `- / +` y confirmar que esos botones no abran el editor.
