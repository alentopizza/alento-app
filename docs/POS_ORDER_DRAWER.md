# POS — Drawer lateral de pedido

Última actualización: 2026-09-16.

## Objetivo

El panel derecho del POS se transforma visualmente en un **drawer lateral operativo** inspirado en interfaces de toma de pedidos de escritorio, pero adaptado a la identidad de Alentó.

La meta es que el pedido se perciba como una herramienta continua e integrada, no como varias tarjetas independientes apiladas.

## Alcance

Este cambio es principalmente visual. No modifica:

- creación del carrito;
- configuración estructurada de pizzas y combos;
- reglas de cliente obligatorio;
- validación de domicilio;
- checkout;
- creación real de órdenes;
- integridad de datos para inventario futuro.

## Estructura del drawer

1. Cabecera negra con acento rojo y rótulo `NUEVO PEDIDO`.
2. Selector compacto de tipo de pedido.
3. Bloque de cliente integrado.
4. Cuerpo central con scroll propio para productos.
5. Estado vacío simple cuando todavía no hay productos.
6. Footer fijo con subtotal, total y `Continuar pedido`.

## Diseño

- El drawer ocupa la altura útil de la ventana en escritorio.
- Tiene scroll interno solo en el cuerpo de productos.
- El selector de modalidad usa un segmented control plano.
- El rojo se reserva para la modalidad activa y las acciones principales.
- Cliente sin seleccionar usa input + lupa + botón `+` en una sola fila.
- Cliente seleccionado se presenta como una fila informativa compacta.
- El estado vacío no usa borde punteado ni una tarjeta interna gigante.
- El resumen inferior usa una separación mínima y permanece siempre visible.

## Responsive

A partir de anchos inferiores a `1280px`, el drawer deja de ser sticky de altura completa y vuelve al flujo normal para evitar problemas en tablets o pantallas pequeñas.

## Archivos

- `src/app/pos-order-drawer.css`
- `src/app/layout.tsx`

## Regla de mantenimiento

Los estilos del drawer deben permanecer encapsulados al layout real del POS. No deben afectar `/menu`, `/pedidos`, `/clientes`, `/cupones`, `/caja` ni `/configuracion`.

Antes de modificar selectores globales, preferir un archivo específico del POS cargado al final del orden de estilos.
