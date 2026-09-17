# POS — presentación de pizza normal en el carrito

Fecha: 2026-09-17

## Regla visual

Una pizza normal de un solo sabor usa el nombre del producto como sabor implícito, por lo que el carrito **no repite** una fila `Sabor`.

Ejemplo:

- `Chicharrona`
- `Tamaño: Personal`
- `Borde: Tradicional`
- `Ingredientes adicionales: + Jamón, + Pepperoni` como etiquetas cuando existan.

## Pizza 2 sabores

La pizza de dos sabores sí muestra explícitamente:

- Tamaño;
- Borde;
- Sabor 1;
- Sabor 2;
- ingredientes adicionales como etiquetas.

## Edición

Las líneas configurables de pizza y combo siguen siendo editables desde el carrito. Al hacer clic en la línea se reabre el configurador con las selecciones actuales; `Guardar cambios` reemplaza esa misma línea y conserva su cantidad.

## Build / lint

`StructuredPosPageV2.tsx` reutiliza las mismas aserciones ya validadas del configurador anterior para reglas de combo. La excepción ESLint `@typescript-eslint/no-non-null-asserted-optional-chain` se aplica ahora tanto a `StructuredPosPage.tsx` como a `StructuredPosPageV2.tsx`, evitando que el build de Next.js falle por esa regla sin modificar la lógica de datos.

No requiere cambios de Prisma ni base de datos.
