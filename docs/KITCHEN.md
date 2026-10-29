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

Cocina trabaja únicamente con pedidos en estados operativos de preparación:

- `CONFIRMED` cuando existe compatibilidad histórica;
- `PREPARING`.

Cuando el pedido cambia a `PREPARED`, sale de Cocina inmediatamente.

Convención importante:

- `PREPARING` = Preparando en Cocina;
- `PREPARED` = Horneando, fuera de Cocina;
- `READY` = salió del horno / listo.

## Pedidos programados

Cocina respeta `Order.scheduledFor`.

Regla vigente:

- el pedido programado no aparece durante toda la espera;
- entra al tablero exactamente al comenzar la ventana de **30 minutos antes** de la hora solicitada;
- se identifica con borde/acento violeta, icono de reloj y texto `PROGRAMADO`;
- el cronómetro de Cocina empieza a contar desde la entrada a la ventana, no desde la hora de facturación;
- el refresco operativo se realiza cada 5 segundos, por lo que la aparición ocurre con una tolerancia máxima aproximada de ese intervalo;
- al aparecer como un ID nuevo, `KitchenOrderAlerts` reproduce la alerta sonora si las alertas de Cocina están habilitadas en ese dispositivo;
- si el pedido se reprograma fuera de Cocina y luego vuelve a entrar, puede volver a generar la alerta;
- el endpoint de preparación bloquea cualquier intento de preparación antes de la ventana.

Esto evita que un pedido de las 18:30, tomado a las 16:35, sea preparado inmediatamente: Cocina lo recibe alrededor de las 18:00.

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

Los **pedidos** se ordenan por su hora real de entrada a Cocina, del más antiguo al más nuevo.

Reglas:

- pedidos normales usan `createdAt`;
- pedidos programados usan `scheduledFor - ORDER_KITCHEN_LEAD_MS`;
- el pedido con mayor tiempo de espera ocupa siempre la primera posición;
- si dos pedidos tienen exactamente la misma hora de entrada, se desempata por `order.id`;
- el primer pedido visible se identifica además con `MÁS ANTIGUO`.

Dentro de cada pedido se prioriza:

```text
1. Pizzas
2. Antojos
3. Otros productos que sí requieren preparación
```

Los combos que contienen pizza se priorizan junto a pizzas.

## Distribución del tablero

En escritorio se muestran como máximo **2 pedidos por fila**.

No se vuelve a usar una tercera columna porque reduce demasiado el área útil de lectura de producto.

Dentro de cada pedido:

- se muestra **un producto por línea**;
- pizzas normales, antojos, combos y `PIZZA_CUSTOM` usan el mismo ancho disponible;
- tamaño, borde, sabor, extras, ingredientes y notas mantienen siempre una lectura horizontal consistente;
- cada tarjeta usa altura natural; no se estira artificialmente.

No volver a dividir productos de un mismo pedido en dos columnas: visualmente puede parecer que pertenecen a bloques distintos y reduce la claridad operativa.

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
- número de minutos;
- sufijo visible `min`.

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

Tamaño y borde ya no usan chips pequeños equivalentes.

Cada uno tiene un distintivo grande propio:

- **Tamaño**: icono de regla, etiqueta `TAMAÑO`, valor grande y color según tamaño;
- **Borde**: icono circular, etiqueta `BORDE`, valor grande y color según tipo de borde.

La intención es que el cocinero no dependa solo del texto para diferenciarlos.

### Sabores y especialidades

Los sabores usan el mismo lenguaje visual que Tamaño y Borde:

- tarjeta grande con etiqueta `SABOR`;
- icono propio de pizza;
- nombre de la especialidad en mayúscula y alto contraste;
- color estable por especialidad para reconocimiento rápido;
- en pizzas normales se muestran en la **misma fila de configuración** que Tamaño y Borde;
- solo saltan a una segunda línea si el ancho disponible no alcanza.

Paleta vigente:

- La Paisa → ámbar;
- Hawaiana Clásica → fucsia;
- Hawaiana Chick → morado;
- Chicharrona → naranja;
- Napolitana → rojo;
- Pollo & Champiñón → teal;
- Fiesta Pepperoni → rosa/rojo;
- Tropical → rosa;
- Carnes Tradicional → piedra/oscuro;
- Criolla Tradicional → amarillo;
- Vegetariana → verde lima;
- Mexicana Especial → rojo intenso;
- especialidades nuevas sin regla explícita → violeta como fallback.

En pizzas de dos sabores, cada mitad recibe su propia tarjeta (`MITAD 1` / `MITAD 2`) y conserva el color de la especialidad elegida.

No volver a mostrar sabores como chips pequeños de texto si tamaño y borde usan distintivos grandes.

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

## Antojos e ingredientes

Los antojos incluidos en combos se muestran como tarjetas de lectura rápida, con icono, nombre en mayúscula y color estable según el producto. Las opciones que no correspondan a antojos conservan su presentación compacta.

Los ingredientes de `PIZZA_CUSTOM` y los extras de pizza usan una paleta por ingrediente para reconocerlos más rápido:

- Albahaca y orégano → verde.
- Tomate → rojo.
- Cebolla → violeta.
- Pimentón y ají → verde lima.
- Champiñón, chicharrón y carnes → piedra/oscuro.
- Quesos → ámbar.
- Jamón y tocineta → rosa.
- Pepperoni, chorizo y salchicha → naranja.
- Pollo → teal.
- Aceitunas y anchoas → gris.
- Piña, maíz y plátano maduro → amarillo.
- Ingredientes nuevos sin regla explícita → violeta como fallback.

El texto del ingrediente siempre permanece visible en mayúscula y con contraste alto: el color ayuda a reconocerlo, pero no reemplaza el nombre.

## Arma Tu Pizza

`PIZZA_CUSTOM` se trata como pizza de prioridad alta en Cocina.

La configuración llega estructurada desde el pedido y debe mostrar:

- tamaño;
- borde;
- forma: `Completa` o `Mitad y mitad`;
- ingredientes completos o separados como `Mitad 1` / `Mitad 2`.

Ejemplo conceptual:

```text
1× Arma Tu Pizza
[MEDIANA · 27 CM] [BORDE MOZZARELLA]
MITAD Y MITAD
Mitad 1: Piña, Jamón
Mitad 2: Plátano Maduro, Chicharrón Carnudo, Jamón
```

Cocina **no recalcula precio**. El valor fue normalizado server-side al crear/editar el pedido; Cocina consume el snapshot estructurado únicamente para preparación.

La UI de Cocina presenta `PIZZA_CUSTOM` de forma operacional:

- `Pizza completa`: un bloque único con todos los ingredientes separados;
- `Mitad y mitad`: dos bloques visualmente distintos, `Mitad 1` y `Mitad 2`;
- cada ingrediente se muestra como etiqueta individual;
- tamaño, borde y forma permanecen visibles arriba;
- no se muestra el cálculo monetario de ingredientes en Cocina para evitar ruido durante preparación.

No convertir las mitades en una nota libre: los IDs de los ingredientes deben permanecer en `OrderItem.configuration`.

Los ingredientes de `PIZZA_CUSTOM` se muestran en Cocina en **MAYÚSCULA**, con tipografía reforzada y chips de mayor altura para lectura rápida a distancia.

## Combos con pizza

Los combos que contienen pizza deben conservar una lectura visual similar a una pizza individual.

Regla de presentación en Cocina:

- el nombre del combo permanece como título principal;
- cada pizza del combo se muestra en un subbloque propio;
- el tamaño se presenta con el mismo estilo de chip usado por pizzas;
- el sabor se presenta como chip destacado;
- si el combo contiene más de una pizza, se identifican como `Pizza 1`, `Pizza 2`, etc.;
- antojos y otros acompañantes se muestran debajo como bloques secundarios con el nombre real del grupo;
- bebidas/gaseosas no se muestran en Cocina;
- no reconstruir bordes ni extras que el `ComboOrderConfiguration` actual no persista;
- evitar volver al formato de texto corrido tipo `Pizza 1: ... Antojo: ...`.

Ejemplo conceptual:

```text
1× Combo Inseparable

PIZZA
[MEDIANA · 27 CM] [HAWAIANA CLÁSICA]

ANTOJO
[PALITOS CON QUESO]
```

La prioridad es que Cocina pueda identificar de un vistazo qué pizza debe preparar dentro del combo.

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

## Entrega de Cocina al horno

El endpoint de preparación recalcula solo líneas que requieren Cocina.

Cuando todas las líneas cumplen:

`preparedQuantity >= quantity`

el pedido pasa automáticamente al estado técnico:

`PREPARED`

En la operación de Alentó, `PREPARED` significa **Horneando**.

En ese mismo momento:

- el pedido desaparece de `/cocina`;
- Cocina ya no tiene acciones sobre ese pedido;
- no existe en Cocina un botón “Salió del horno”;
- el hornero/operación controla la siguiente transición.

Flujo:

`PREPARING → PREPARED → READY`

Lectura visible:

`Preparando → Horneando → Listo`

La transición:

`PREPARED → READY`

la realiza el hornero cuando el producto realmente sale del horno.

Para Recoger/Local, `READY` se presenta al cliente como **Listo para recoger**. Para Domicilio, se presenta como **Listo** antes de pasar a En camino.

Esta separación evita saturar el tablero de Cocina con pedidos que ya terminaron su fase de preparación.

## Ediciones provenientes de Pedidos

Si Pedidos modifica una línea que requiere preparación:

- nuevas unidades empiezan pendientes;
- una nueva pizza vuelve a requerir Cocina;
- cambiar una nota de una pizza preparada reinicia su preparación para que Cocina vea la nueva instrucción;
- agregar únicamente bebidas no debe reactivar Cocina.

## Refresco

La pantalla refresca pedidos cada 5 segundos sin necesitar un botón manual de actualización. Este intervalo también controla la entrada visual y sonora de pedidos programados.

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
- no volver a mostrar pedidos PREPARED/Horneando en Cocina;
- no reintroducir en Cocina la acción PREPARED → READY; esa acción corresponde al hornero/operación;
- no ocultar notas de producto;
- no mostrar información financiera en Cocina;
- no reconstruir configuración desde texto si existe estructura;
- no volver a mostrar barras/progreso redundante;
- no reintroducir controles de cantidad cuando una línea ya está completa;
- conservar prioridad pizzas → antojos → otros.

## Prisma

Los cambios de cierre documentados no requieren un cambio adicional del schema.
