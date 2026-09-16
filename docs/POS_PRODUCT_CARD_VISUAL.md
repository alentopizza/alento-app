# Diseño de tarjetas de producto del POS

Última actualización: 2026-09-16.

Este documento registra el pulido visual final de las tarjetas del catálogo del POS.

## Objetivo

Reducir espacios muertos en la parte inferior de cada tarjeta y hacer que la acción de agregar sea más compacta y elegante sin cambiar la lógica de producto ni del carrito.

## Reglas visuales

- Las reglas aplican únicamente al catálogo del POS y no deben afectar `/menu` ni otras pantallas administrativas.
- El bloque de contenido usa menor padding vertical.
- El título usa tipografía de sistema más fina y legible.
- La descripción conserva máximo dos líneas, pero con menor altura mínima.
- El bloque inferior alinea precio a la izquierda y acción a la derecha.
- La etiqueta `PRECIO` se mantiene pequeña y secundaria.
- El valor (`Desde`, `Ahorra` o precio directo) es el elemento principal del footer de la tarjeta.
- El botón conserva internamente el texto `Agregar`, pero visualmente se representa con un botón rojo compacto de `+`.
- El botón `+` permanece en la esquina inferior derecha de la tarjeta y tiene estado hover y disabled.
- En móvil se reduce ligeramente el tamaño del botón y el padding de la tarjeta.

## Implementación

Archivo de estilo:

`src/app/product-card-polish.css`

El archivo se carga después de los estilos generales desde `src/app/layout.tsx`.

La implementación visual no cambia:

- `startAdd(product)`;
- configuración de pizzas;
- configuración de combos;
- precios;
- integridad estructurada de `CartItem.configuration`;
- reglas de cierre del pedido.

Por tanto, este cambio es exclusivamente de UX/UI.
