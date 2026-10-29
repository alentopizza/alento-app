# POS - Panel integrado de tipo de pedido y cliente

Fecha: 2026-09-16.

Este documento registra el rediseño visual del bloque superior del panel derecho del POS.

## Objetivo

Evitar que modalidad + cliente parezcan un formulario independiente pegado sobre el carrito. El bloque debe sentirse como parte nativa del mismo panel operativo.

## Diseño aprobado

- se elimina la apariencia de tarjeta anidada dentro del panel derecho;
- se mantiene una sola superficie visual para el armado del pedido;
- los rótulos visibles pasan a ser `TIPO DE PEDIDO` y `CLIENTE`;
- los rótulos son pequeños, alineados a la izquierda y en gris neutro;
- el rojo se reserva para estado activo y acciones principales;
- Domicilio / Recoger / Local se presentan como segmented control plano;
- la modalidad seleccionada usa fondo rojo sólido con texto blanco;
- las opciones inactivas usan fondo neutro sin borde rojo;
- búsqueda de cliente usa una superficie compacta con input + lupa;
- el botón `+` conserva rojo Alentó y el mismo tamaño visual de la lupa;
- los resultados de búsqueda flotan para no empujar el panel;
- cuando hay cliente seleccionado, se muestra como fila informativa compacta y no como una tarjeta dominante;
- `Editar` y `Cambiar` siguen siendo acciones secundarias.

## Lógica preservada

Este cambio es exclusivamente visual. No modifica:

- `fulfillmentType`;
- obligatoriedad de cliente para Domicilio y Recoger;
- dirección obligatoria para Domicilio;
- búsqueda/creación/edición de clientes;
- carrito ni configuraciones estructuradas;
- validaciones de `Continuar pedido`;
- creación de órdenes.

## Archivos

- `src/app/pos-order-panel-polish.css`
- `src/app/layout.tsx`

El CSS está encapsulado al layout real del POS para no afectar `/menu`, `/pedidos`, `/clientes` o `/configuracion`.
