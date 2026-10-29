# Pulido visual de configuradores del POS

Última actualización: 2026-09-16.

Este documento registra el criterio visual aplicado a los configuradores de pizza y combo del POS.

## Objetivo

Mejorar legibilidad y jerarquía sin alterar la lógica estructurada de productos ni `OrderItem.configuration`.

## Reglas visuales actuales

- Los configuradores usan `ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont` y `Segoe UI` para una apariencia más limpia y legible.
- Los títulos de producto tienen menos peso bruto, mejor tracking y jerarquía más refinada.
- Cada grupo funcional se presenta dentro de un contenedor visible con borde gris cálido, fondo blanco suave y sombra ligera.
- Los contenedores se usan para separar visualmente Tamaño, Sabor 1, Sabor 2, Borde, Ingredientes extra y grupos de combo como Antojo o Bebida.
- Los títulos de sección usan un peso medio-alto en lugar de `font-black` visualmente pesado.
- Las opciones conservan selección fuerte: negro para selecciones principales y rojo Alentó para modificadores seleccionados.
- Los estados hover reciben una sombra mínima para mejorar lectura sin generar ruido.
- Los chips auxiliares como `Opcional`, `Incluida en el combo` o los contadores de selección usan borde y sombra muy suaves.
- El precio y la acción inferior conservan jerarquía clara, pero con tipografía menos pesada.

## Bordes por tamaño

La mejora visual no cambia la regla comercial existente:

- cada borde muestra el precio configurado para el tamaño actualmente seleccionado;
- precio `0` se muestra como `Incluido`;
- una combinación sin precio configurado se muestra como `No disponible`;
- al cambiar tamaño, si el borde actual deja de ser válido, se selecciona automáticamente el primer borde disponible.

## Integridad

Este bloque es exclusivamente de UX/CSS. No modifica Prisma, contratos de API, IDs estructurados ni snapshots de precios guardados en pedidos.

## Archivos

- `src/app/product-config-polish.css`
- `src/app/layout.tsx`
- `src/components/StructuredPosPage.tsx`

Los estilos de este archivo se cargan después de `pos-polish.css` para aislar el pulido de configuradores del resto del sistema.
