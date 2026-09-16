# Layout operativo del POS

Última actualización: 2026-09-16.

Este documento describe la organización visual aprobada para el Punto de Venta de Alentó App.

## Objetivo

La pantalla debe priorizar velocidad de operación y mantener visibles al mismo tiempo el catálogo y el pedido en construcción. La integridad estructurada de productos sigue siendo interna y no debe ocupar espacio visual del cajero.

## Layout principal aprobado

En escritorio el POS usa dos columnas:

### Columna izquierda

Contiene únicamente:

1. encabezado compacto de `Punto de venta`;
2. categorías del catálogo;
3. tarjetas de productos.

El encabezado ocupa todo el ancho disponible de la columna izquierda y llega visualmente hasta el panel del pedido, dejando únicamente el gap entre columnas. No debe limitarse a un ancho menor arbitrario.

### Columna derecha

El panel derecho es el centro operativo del pedido y permanece fijo/sticky en escritorio.

El orden dentro del panel es:

1. tipo de pedido;
2. cliente;
3. productos agregados;
4. subtotal y total de productos;
5. botón `Continuar pedido`.

El listado de productos es la zona que debe hacer scroll. Los controles iniciales y el cierre del pedido deben mantenerse visibles tanto como permita la altura disponible.

## Tipo de pedido

El selector vive dentro del panel del pedido y usa tres opciones compactas:

- `DOMICILIO` → `DELIVERY`;
- `RECOGER` → `PICKUP` / Recoger en tienda;
- `LOCAL` → `STORE`.

La interfaz no muestra emojis en estas opciones. Los rótulos se presentan en mayúsculas para mantener una lectura limpia y uniforme.

`RECOGER` es solo una abreviación visual. El valor persistido y las reglas internas continúan usando `PICKUP`.

## Cliente

El cliente también se administra dentro del panel derecho.

No mostrar un título grande adicional como `Tipo de pedido y cliente`; el bloque ya queda suficientemente explicado por `Preparar pedido`, `1. Tipo` y `2. Cliente`.

### Sin cliente seleccionado

Mostrar en una sola línea operativa:

- campo de búsqueda por nombre, teléfono o correo;
- botón negro cuadrado de búsqueda representado solo por una lupa;
- botón rojo cuadrado de nuevo cliente representado solo por `+`.

Ambos botones deben tener exactamente el mismo tamaño, radio y peso visual; solo cambia el color de acción.

El objetivo es maximizar el ancho disponible del campo del cliente y evitar texto redundante dentro de controles muy pequeños.

Los resultados de búsqueda pueden desplegarse por encima del contenido siguiente para no aumentar innecesariamente la altura del panel.

### Con cliente seleccionado

Mostrar una tarjeta compacta con:

- nombre;
- teléfono;
- dirección cuando el pedido sea Domicilio;
- botones `Editar` y `Cambiar`.

Cuando ya existe un cliente seleccionado, la acción de nuevo cliente no necesita permanecer visible de forma prominente.

Domicilio y Recoger requieren cliente. Local lo mantiene opcional.

## Catálogo

El catálogo debe comenzar inmediatamente debajo del encabezado, sin un bloque independiente de tipo/cliente ocupando una fila completa.

Esto permite:

- mostrar productos más arriba;
- reducir scroll de página;
- mantener el pedido siempre visible a la derecha;
- concentrar toda la información propia del pedido dentro de un solo módulo.

## Productos y totales

No mostrar un bloque intermedio con textos como:

```text
Pedido actual
Sin productos
Local
```

Ese bloque no agrega información operativa porque:

- el tipo ya está visible arriba;
- el cliente ya está visible arriba;
- si no hay productos, el estado vacío del carrito ya lo comunica;
- si hay productos, la lista de líneas ya funciona como contenido principal del pedido.

El panel debe pasar directamente desde Cliente hacia el carrito/listado de productos y luego a los totales.

El cierre mantiene:

```text
Subtotal
Total productos
Continuar pedido
```

## Responsabilidad de datos

Este cambio es exclusivamente de layout. No modifica las reglas de `docs/ORDER_DATA_INTEGRITY.md`.

Las pizzas, combos, tamaños, sabores, bordes y modificadores siguen transportando configuración estructurada con IDs aunque la interfaz no exponga esos detalles técnicos.

## Responsive

En pantallas donde las dos columnas no tengan espacio suficiente, el diseño puede apilarse. El orden de prioridad debe conservarse:

1. encabezado;
2. preparación del pedido;
3. catálogo;
4. productos/totales según el flujo responsive definido por la implementación.

En escritorio, la referencia principal sigue siendo catálogo a la izquierda y pedido sticky a la derecha.

## Regla para cambios futuros

No volver a crear un bloque horizontal separado de `Tipo de pedido y cliente` por encima del catálogo salvo que exista una razón operativa validada. Tipo y cliente pertenecen al contexto del pedido actual y deben mantenerse dentro del panel derecho.
