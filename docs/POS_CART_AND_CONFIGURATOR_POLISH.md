# POS: carrito compacto y configuradores unificados

Actualización: 2026-09-17.

## Carrito

- Se eliminó la línea `c/u $...` de las tarjetas del carrito para reducir ruido visual.
- Las tarjetas usan menos padding, controles de cantidad más compactos y menor altura general.
- Pizza de un sabor muestra únicamente tamaño y borde; el nombre del producto ya representa el sabor.
- Pizza de dos sabores mantiene Sabor 1 y Sabor 2.
- Ingredientes adicionales siguen mostrándose como etiquetas.
- Pizza y combo continúan siendo editables haciendo clic sobre la línea del carrito.

## Configuradores de pizza y combo

Los modales de configuración adoptan la misma shell visual del modal Nuevo cliente:

- fondo oscurecido con blur;
- cabecera negra con acento rojo;
- título blanco y subtítulo tenue;
- botón Cerrar integrado en la cabecera;
- fondo cálido en el cuerpo;
- secciones blancas con borde suave;
- footer blanco con precio y acción principal roja.

La lógica de tamaños, sabores, bordes, modificadores, combos y edición no cambia. Estos cambios son exclusivamente visuales y no requieren cambios de Prisma.
