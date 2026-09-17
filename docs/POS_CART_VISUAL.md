# POS — Carrito y resumen visual

Última actualización: 2026-09-16.

Este documento registra el pulido visual del área inferior del carrito del Punto de Venta.

## Objetivo

Eliminar la apariencia antigua basada en múltiples líneas divisorias, un estado vacío demasiado alto y un resumen de totales visualmente pesado.

## Estado vacío

Cuando el carrito no tiene productos:

- se usa una tarjeta compacta con borde sólido suave;
- se elimina el rectángulo punteado dominante;
- se reduce la altura del estado vacío;
- se muestra un icono discreto de carrito;
- el mensaje visual es `Aún no hay productos`;
- el texto secundario indica `Agrega productos del menú para comenzar.`;
- el estado vacío no debe competir visualmente con el selector de pedido/cliente ni con el resumen inferior.

## Resumen inferior

El resumen funciona como una sola superficie visual:

- fondo gris cálido muy suave;
- borde único sutil;
- radio aproximado de 18 px;
- sombra mínima;
- subtotal como dato secundario;
- una sola separación tenue antes del total;
- el rótulo visible pasa de `Total productos` a `Total`;
- el valor total mantiene rojo Alentó como elemento principal.

## Botón Continuar pedido

- mantiene rojo Alentó cuando está habilitado;
- usa un estado deshabilitado gris cálido en lugar de gris plano;
- conserva la lógica existente de validación;
- no cambia reglas de tipo de pedido, cliente, dirección ni contenido del carrito.

## Carrito con productos

Las tarjetas de líneas del carrito:

- usan borde gris suave;
- radio más consistente con el resto del POS;
- sombra ligera;
- evitan bordes negros fuertes.

## Implementación

Archivo de estilos:

`src/app/pos-cart-polish.css`

Se importa al final de los estilos específicos del POS desde:

`src/app/layout.tsx`

De esta manera tiene prioridad visual sin modificar la lógica de `StructuredPosPage.tsx`.

## Base de datos

Este cambio es únicamente de interfaz. No modifica Prisma ni requiere `prisma db push`.
