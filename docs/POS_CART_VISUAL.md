# POS — Carrito y resumen visual

Última actualización: 2026-09-17.

Este documento registra el pulido visual del panel derecho del Punto de Venta.

## Objetivo

Mantener el POS compacto y operativo, con una jerarquía clara entre modalidad, cliente, carrito y cierre del pedido, sin modificar las reglas de negocio existentes.

## Cliente seleccionado

Cuando existe un cliente seleccionado, el bloque de información usa el mismo lenguaje visual moderno definido para Pedidos:

- superficie crema muy suave;
- borde y sombra discretos;
- avatar neutro a la izquierda;
- nombre del cliente como dato principal;
- teléfono en una línea secundaria independiente;
- dirección en una tercera línea cuando el pedido es a domicilio;
- tipografía de sistema moderna y legible;
- mayor respiración interna sin convertir el bloque en una tarjeta dominante.

Referencia visual:

```text
Ivan Garzon
• +57 3243755611
• Calle 8a #92-72
```

Las acciones del cliente se mantienen, pero se presentan únicamente como iconos compactos:

- lápiz → editar cliente;
- intercambio → cambiar/quitar cliente seleccionado.

El texto original de las acciones permanece en el DOM y la lógica de los botones no cambia. El ajuste es exclusivamente visual.

Archivo específico:

`src/app/pos-customer-card.css`

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

Estilos principales relacionados:

- `src/app/pos-order-panel-polish.css`
- `src/app/pos-customer-card.css`
- `src/app/pos-cart-polish.css`
- `src/app/pos-cart-line.css`

Se importan desde:

`src/app/layout.tsx`

La página activa del POS es:

`src/components/StructuredPosPageV2.tsx`

Los ajustes visuales no modifican la lógica de selección/edición de clientes, carrito o checkout.

## Base de datos

Estos cambios son únicamente de interfaz. No modifican Prisma ni requieren `npx prisma db push`.
