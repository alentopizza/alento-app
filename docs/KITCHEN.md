# Cocina

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Ruta: `/cocina`

Este documento describe el funcionamiento vigente del tablero de producción.

## Objetivo

Cocina debe mostrar únicamente la información necesaria para preparar correctamente un pedido, con lectura rápida a distancia y sin información financiera.

Responsabilidades:

- ver pedidos que requieren preparación;
- identificar prioridad;
- interpretar configuración real;
- ver observaciones;
- marcar cantidades preparadas;
- completar preparación;
- liberar el pedido a la siguiente etapa.

Cocina no edita:

- precios;
- descuentos;
- pagos;
- cliente;
- domicilio;
- totales.

## Pedidos visibles

Cocina trabaja con pedidos en estados operativos de preparación como:

- `CONFIRMED` cuando existe compatibilidad histórica;
- `PREPARING`;
- `PREPARED`.

Una orden `READY` desaparece de Cocina.

## Bebidas

Las bebidas **no son tareas de Cocina**.

Reglas:

- no se muestran como línea preparable;
- no cuentan para completar preparación;
- no bloquean `PREPARED`;
- agregar/editar únicamente una bebida no debe reactivar Cocina;
- un pedido compuesto solo por productos que no requieren preparación no debe quedar bloqueado en Cocina.

La identificación se basa en la categoría real `bebidas`, no en el nombre visible.

## Orden de preparación

Dentro de un pedido se prioriza:

```text
1. Pizzas
2. Antojos
3. Otros productos que sí requieren preparación
```

Los combos que contienen pizza se priorizan junto a pizzas.

## Distribución del tablero

En escritorio amplio se muestran hasta **3 pedidos por fila**.

Cada tarjeta usa altura natural; no se estira para igualar a otras tarjetas de la misma fila.

Esto evita espacio muerto.

## Encabezado general

El header de Cocina usa el lenguaje visual compartido de Alentó.

Texto vigente:

`Lo que entra, lo que se prepara y lo que ya puede salir.`

El contador superior muestra únicamente:

- etiqueta `COCINA`;
- número de pedidos.

## Encabezado de cada pedido

Muestra:

- código comercial, por ejemplo `POS-0011`;
- modalidad;
- estado;
- nombre del cliente de forma sutil;
- reloj + minutos transcurridos.

El nombre del cliente usa peso moderado y `font-synthesis: none` para mantener nitidez.

No se muestra barra de progreso general.

## Cronómetro

El contador muestra:

- icono de reloj;
- número de minutos.

No muestra la palabra `MIN`.

El color cambia con la antigüedad para facilitar lectura operativa.

## Producto

Cada línea preparable muestra:

- cantidad;
- nombre;
- controles de preparación si todavía está pendiente;
- configuración necesaria;
- observación, si existe.

Cuando una línea ya está completamente preparada, los controles `− N/N +` desaparecen porque dejan de aportar una acción válida.

## Jerarquía visual de una pizza

La lectura se organiza en este orden:

```text
[TAMAÑO] [BORDE]
[SABOR] o [SABOR 1] - [SABOR 2]
[+ EXTRA] [+ EXTRA]
[! NOTA]
```

### Tamaño y borde

Tamaño y borde usan chips con la misma estética.

Los tamaños tienen color diferenciado para reconocimiento rápido:

- Personal;
- Mediana;
- Grande;
- Extra.

Los bordes también tienen diferenciación visual, incluyendo reglas para:

- Tradicional;
- Mozzarella;
- Bocadillo;
- Salchiborde;
- fallback neutral para otros bordes.

El valor visible incluye el snapshot recibido, por ejemplo:

`MEDIANA · 27 CM`

## Sabores

Los sabores se muestran como chips sin etiquetas redundantes `Sabor 1` / `Sabor 2`.

Un sabor:

`[ CHICHARRONA ]`

Dos sabores:

`[ CHICHARRONA ] − [ NAPOLITANA ]`

En Cocina se elimina visualmente el prefijo `½`; la proporción estructurada sigue existiendo en `OrderItem.configuration`.

## Ingredientes extra

Los extras aparecen después de los sabores, en una misma zona visual:

```text
[+ PEPPERONI] [+ PLÁTANO MADURO] [+ CEBOLLA]
```

No se presentan como texto corrido `Extra: ...`.

## Nota de preparación

Si una pizza tiene `OrderItem.notes`, Cocina la destaca con un bloque ámbar.

Características:

- sin título redundante `Nota de preparación`;
- icono de alerta;
- texto en mayúsculas visuales;
- no modifica el valor almacenado;
- no existe línea divisoria antes de la nota.

Ejemplo:

`! SOLO PIÑA`

## Preparación por cantidades

Cada `OrderItem` tiene:

- `quantity`;
- `preparedQuantity`.

Mientras una línea esté incompleta aparecen controles compactos en la esquina superior derecha:

```text
− 0/2 +
```

El operador puede preparar unidad por unidad.

Cuando:

`preparedQuantity >= quantity`

la línea se considera completa y los controles dejan de mostrarse.

## Cambio automático a PREPARED

El endpoint de preparación recalcula solo líneas que requieren Cocina.

Cuando todas las líneas de Cocina cumplen:

`preparedQuantity >= quantity`

el pedido pasa automáticamente a:

`PREPARED`

Si una cantidad se revierte antes de marcar READY, el pedido puede volver a `PREPARING`.

## Acción PREPARED → READY

Cuando el pedido está `PREPARED`, el header muestra un botón:

`✓`

Características:

- verde;
- cuadrado;
- bordes redondeados;
- pulso suave;
- `aria-label` y `title`;
- ubicado junto al cronómetro.

No existe un footer adicional de `Marcar como listo`.

Al pulsarlo:

`PREPARED → READY`

y el pedido sale de Cocina.

## Ediciones provenientes de Pedidos

Si Pedidos modifica una línea que requiere preparación:

- nuevas unidades empiezan pendientes;
- una nueva pizza vuelve a requerir Cocina;
- cambiar una nota de una pizza preparada reinicia su preparación para que Cocina vea la nueva instrucción;
- agregar únicamente bebidas no debe reactivar Cocina.

## Refresco

La pantalla refresca pedidos periódicamente sin necesitar un botón manual de actualización.

## Consecutivo

Cocina usa el mismo código comercial global que POS y Pedidos.

No construir códigos desde `Order.id`.

## UI cerrada para esta etapa

Se eliminó información considerada ruido:

- progreso porcentual total;
- texto `Completa todos los productos...`;
- duplicados `1/1 preparado` cuando ya existen controles;
- texto `MIN`;
- bebidas;
- footer grande para READY.

La interfaz está optimizada para lectura a distancia.

## Archivos principales

- `src/app/cocina/page.tsx`
- `src/app/api/orders/route.ts`
- `src/app/api/orders/[id]/items/[itemId]/prepared/route.ts`
- `src/app/api/orders/[id]/status/route.ts`
- `src/lib/orderPresentation.ts`
- `src/lib/orderWorkflow.ts`
- `src/lib/orderCode.ts`

## Reglas de no regresión

- no volver a mostrar bebidas como preparación;
- no bloquear PREPARED por una bebida;
- no ocultar notas de producto;
- no mostrar información financiera en Cocina;
- no reconstruir configuración desde texto si existe estructura;
- no volver a mostrar barras/progreso redundante;
- no reintroducir controles de cantidad cuando una línea ya está completa;
- conservar prioridad pizzas → antojos → otros.

## Prisma

Los cambios de cierre documentados no requieren un cambio adicional del schema.
