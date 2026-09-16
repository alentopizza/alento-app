# Integridad de datos de pedidos para inventario y costos

Este documento define una regla estructural crítica de Alentó App: **cada pedido debe conservar exactamente qué producto se vendió y cómo fue configurado**, porque esa información será la base futura para inventarios, consumo de insumos, recetas y costos reales.

## Principio rector

El detalle visible para una persona no es suficiente como fuente operativa.

Ejemplo legible:

```text
Pizza Mediana Chicharrona · Borde Cheddar · + Pepperoni
```

Ese texto puede servir para Cocina o impresión, pero **no debe ser la fuente para inventario**.

La fuente válida debe guardar identificadores estructurados y snapshots de cada selección.

## Regla obligatoria para órdenes nuevas

Toda línea configurable debe persistir una configuración estructurada con IDs reales del catálogo.

No se deben crear nuevas órdenes de pizza o combo basadas únicamente en `POS_SNAPSHOT` o texto libre.

`POS_SNAPSHOT` queda permitido únicamente como compatibilidad histórica para órdenes creadas antes de completar este refactor.

## Pizza de un sabor

Una pizza debe conservar al menos:

```ts
{
  kind: "PIZZA",
  productId: number,
  size: {
    id: number,
    name: string,
    diameterCm: number
  },
  flavors: [
    {
      productId: number,
      name: string,
      portion: 1
    }
  ],
  crust: {
    id: number,
    name: string
  } | null,
  modifiers: [
    {
      productId: number,
      name: string,
      quantity: number
    }
  ]
}
```

La propiedad `portion` es importante para el futuro motor de inventario.

## Pizza de dos sabores

Debe guardar ambos sabores por separado:

```ts
flavors: [
  {
    productId: 12,
    name: "Chicharrona",
    portion: 0.5
  },
  {
    productId: 18,
    name: "Pollo & Champiñones",
    portion: 0.5
  }
]
```

No basta guardar el texto `½ Chicharrona + ½ Pollo & Champiñones`.

El factor `0.5` permitirá que una futura receta descuente solo media porción de los ingredientes correspondientes a cada sabor.

## Tamaño

El tamaño debe guardarse por ID y snapshot de nombre/diámetro.

El inventario futuro podrá usar `PizzaSize.id` para determinar consumos dependientes del tamaño, por ejemplo:

- peso de la bola de masa;
- cantidad de salsa;
- cantidad base de queso;
- cantidad de ingredientes por receta;
- empaque utilizado.

Nunca inferir tamaño a partir del nombre impreso.

## Borde

El borde debe conservar `PizzaCrust.id` y su nombre snapshot.

Esto permitirá asociar posteriormente recetas específicas, por ejemplo:

- tradicional;
- mozzarella;
- cheddar;
- salchiborde;
- bocadillo.

El inventario consumirá la receta vinculada al ID del borde, no el texto del ticket.

## Modificadores / ingredientes extra

Cada adicional debe guardar:

- `productId` o identificador estable del modificador;
- nombre snapshot;
- cantidad seleccionada.

Ejemplo:

```ts
modifiers: [
  { productId: 44, name: "Pepperoni", quantity: 1 },
  { productId: 51, name: "Queso Mozzarella", quantity: 2 }
]
```

La cantidad es obligatoria para poder multiplicar consumos posteriormente.

## Combos

Un combo debe conservar el producto padre y cada elemento escogido dentro de él.

Ejemplo conceptual:

```ts
{
  kind: "COMBO",
  comboProductId: 80,
  comboName: "Combo Inseparable",
  pizzas: [
    {
      sizeId: 2,
      flavorProductId: 15,
      portion: 1
    }
  ],
  groups: [
    {
      groupId: 7,
      name: "Antojo",
      selections: [
        { productId: 90, name: "Palitos con queso", quantity: 1 }
      ]
    },
    {
      groupId: 8,
      name: "Bebida",
      selections: [
        { productId: 102, name: "Coca Cola 1.5LT", quantity: 1 }
      ]
    }
  ]
}
```

El combo no debe convertirse en un producto opaco para inventario. Deben conservarse sus componentes reales.

## Producto estándar

Bebidas, antojos u otros productos simples deben conservar al menos:

- `productId`;
- nombre snapshot;
- cantidad;
- precio unitario snapshot.

## IDs + snapshots

La orden debe guardar ambas cosas:

1. **ID estable** para enlazar con recetas, inventario y costos.
2. **Snapshot legible** para conservar el histórico aunque el catálogo cambie después.

Ejemplo: si el producto `Chicharrona` se renombra dentro de seis meses, una orden histórica debe seguir mostrando el nombre vendido en su momento, pero el ID debe conservar la relación lógica con la entidad original mientras exista.

## Precio y receta son conceptos diferentes

`unitPrice` y `lineTotal` son snapshots comerciales.

La configuración estructurada describe qué se vendió.

El costo futuro no debe inferirse desde el precio de venta. Se calculará utilizando recetas e inventario asociados a los IDs guardados.

## Motor de inventario futuro

La arquitectura prevista es:

```text
Order
  ↓
OrderItem
  ↓
Configuración estructurada
  ↓
IDs de tamaño / sabores / borde / modificadores / componentes de combo
  ↓
Recetas vigentes o snapshot de receta según la política futura
  ↓
Consumo de insumos
  ↓
Costo teórico del pedido
```

Ejemplo futuro para una pizza dos sabores:

```text
Tamaño Grande
→ masa Grande × 1
→ salsa Grande × 1
→ queso base Grande × 1

½ Hawaiana
→ receta Hawaiana Grande × 0.5

½ Chicharrona
→ receta Chicharrona Grande × 0.5

Borde Cheddar
→ receta Borde Cheddar Grande × 1

Extra Pepperoni
→ receta Extra Pepperoni Grande × 1
```

## Reglas de creación del pedido

`POST /api/orders` debe evolucionar para:

1. recibir `CartItem.configuration` estructurada;
2. validar todos los IDs contra PostgreSQL;
3. comprobar que tamaño/sabores/borde/opciones pertenecen a combinaciones permitidas;
4. recalcular precio desde datos reales del servidor;
5. rechazar configuraciones incompletas o manipuladas;
6. guardar configuración estructurada como snapshot inmutable de la venta.

## Regla de presentación

Pedidos, Cocina y comprobante térmico deben leer la configuración estructurada y producir el texto visible.

Nunca usar el proceso inverso para órdenes nuevas:

```text
texto → intentar adivinar IDs
```

El parser de `POS_SNAPSHOT` existe únicamente para compatibilidad con órdenes históricas.

## Regla para edición

Si una orden `CONFIRMED` se modifica:

- cualquier nueva pizza o combo debe guardarse estructuradamente;
- una reconfiguración debe sustituir explícitamente los IDs de tamaño/sabores/borde/modificadores correspondientes;
- los totales deben recalcularse desde el servidor;
- no se debe editar el texto descriptivo manualmente para representar un cambio de producto.

## Prioridad antes de Cocina e Inventario

Antes de avanzar con un motor de inventario real, y preferiblemente antes de consolidar Cocina, se debe completar el refactor del carrito para eliminar `POS_SNAPSHOT` en órdenes nuevas de pizzas y combos.

La integridad de configuración del pedido es una dependencia de:

- Cocina;
- impresión confiable;
- edición completa;
- inventario;
- costos teóricos;
- consumo de insumos;
- análisis de rentabilidad por producto;
- futuras órdenes desde Chatwoot o app de clientes.

## Regla de no regresión

A partir de que el refactor estructurado quede activo:

- no introducir nuevos flujos que creen pizzas o combos sin IDs estructurados;
- no usar nombres como claves de negocio;
- no calcular inventario a partir de textos del ticket;
- no permitir que un canal externo omita la configuración necesaria.

Este documento debe tratarse como requisito de arquitectura, no como mejora opcional.