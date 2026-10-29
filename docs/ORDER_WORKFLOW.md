# Flujo operativo de pedidos

Este documento define el ciclo de vida oficial de una orden en Alentó App.

## Regla de entrada

Todo pedido nuevo creado desde el POS entra directamente al estado interno `PREPARING`, mostrado en interfaz como **EN PREPARACIÓN**, y aparece en la pestaña **Cocina**.

El sistema conserva compatibilidad temporal con pedidos antiguos que estén en `CONFIRMED`; Cocina también los considera dentro del inicio de producción.

## Domicilio

Flujo oficial:

1. `PREPARING` — **EN PREPARACIÓN**
2. `PREPARED` — **PREPARADO**
3. `READY` — **LISTO**
4. `OUT_FOR_DELIVERY` — **EN CAMINO**
5. `ARRIVED` — **HA LLEGADO**
6. `DELIVERED` — **ENTREGADO**
7. `COMPLETED` — **FINALIZADO**

## Recoger y Local

Flujo oficial:

1. `PREPARING` — **EN PREPARACIÓN**
2. `PREPARED` — **PREPARADO**
3. `READY` — **LISTO**
4. `COMPLETED` — **FINALIZADO**

`PICKUP` y `STORE` comparten el mismo ciclo corto.

## Cocina

Cocina controla las tres primeras etapas operativas:

`EN PREPARACIÓN → PREPARADO → LISTO`

### Preparación por producto

Cada `OrderItem` almacena `preparedQuantity`.

Ejemplos:

- una línea `1 × Pizza` inicia `0/1` y pasa a `1/1` al prepararla;
- una línea `2 × Pizza` puede avanzar `0/2 → 1/2 → 2/2`;
- una bebida, antojo, combo u otra línea se controla de la misma forma.

La pantalla Cocina muestra botones `−` y `+` por línea para registrar cuántas unidades están preparadas.

### Paso automático a PREPARADO

Mientras alguna unidad siga pendiente, la orden permanece `PREPARING` (**EN PREPARACIÓN**).

Cuando todas las líneas cumplen:

`preparedQuantity >= quantity`

la API cambia automáticamente la orden a `PREPARED` (**PREPARADO**).

Si antes de marcar el pedido como Listo se revierte una unidad preparada, la orden vuelve a `PREPARING`.

### Paso a LISTO

Solo cuando la orden ya está `PREPARED`, Cocina habilita el botón **MARCAR COMO LISTO**.

`LISTO` significa que el pedido ya completó el proceso de cocina/horno y puede continuar al flujo de entrega, recogida o consumo local.

Al pasar a `READY`, la orden deja de aparecer en Cocina.

La pantalla también:

- ordena las comandas desde la más antigua;
- muestra número comercial, modalidad, cliente y minutos transcurridos;
- muestra la configuración estructurada de cada producto;
- muestra progreso total de preparación en unidades y porcentaje;
- resalta pedidos que llevan más tiempo;
- se actualiza automáticamente cada 15 segundos.

## Pedidos

La pestaña **Pedidos** usa una sola tarjeta por orden y muestra siempre el estado actual.

La acción operativa principal de cada tarjeta se llama **ESTADOS**. Al pulsarla se abre un selector con las etapas válidas según la modalidad del pedido.

### Selector directo de estados

El selector no obliga a recorrer las etapas una por una, pero solo permite avanzar. El estado actual y las etapas ya superadas quedan bloqueados para evitar retrocesos por error.

Ejemplos válidos:

- Local / Recoger: `PREPARADO → FINALIZADO`;
- Domicilio: `LISTO → ENTREGADO`;
- Local / Recoger: `PREPARADO → FINALIZADO`;
- Domicilio: `LISTO → ENTREGADO`.

El estado actual aparece resaltado y las etapas anteriores se muestran como **Etapa superada**, pero no se pueden volver a seleccionar.

`CANCELED` no aparece en este selector. La cancelación sigue siendo un flujo separado porque conserva un significado comercial distinto a las etapas operativas.

### Coherencia con Cocina

Cuando el estado se cambia manualmente desde Pedidos:

- las etapas anteriores al estado actual no pueden seleccionarse desde Pedidos ni enviarse directamente a la API;
- si se selecciona `PREPARED`, `READY` o cualquier etapa posterior, cada `OrderItem.preparedQuantity` se sincroniza con su `quantity`, porque el operador está declarando que la preparación ya fue superada;
- si se selecciona el mismo estado actual, no se altera el progreso de preparación.

Esto evita que el pedido quede en una etapa posterior con productos internamente pendientes.

### Estados por modalidad

Domicilio muestra:

`En preparación → Preparado → Listo → En camino → Ha llegado → Entregado → Finalizado`

Recoger y Local muestran:

`En preparación → Preparado → Listo → Finalizado`

### Finalizado requiere pago completo

`COMPLETED` (**FINALIZADO**) no registra dinero ni modifica Caja automáticamente, pero solo puede seleccionarse cuando el pedido está pagado en su totalidad.

El saldo se calcula con `Order.total - suma(Payment.amount donde status = PAID)`. Si el saldo es mayor que `0`, el selector muestra `FINALIZADO` deshabilitado y la API rechaza cualquier intento de finalizar.

Los pagos parciales siguen permitidos. Una orden puede avanzar por sus etapas operativas con saldo pendiente, pero no puede cerrarse definitivamente hasta completar el pago.

## API de preparación por producto

Endpoint:

`PATCH /api/orders/:id/items/:itemId/prepared`

Body:

```json
{
  "preparedQuantity": 1
}
```

La API limita el valor al `quantity` real de la línea y recalcula automáticamente si el pedido debe estar en `PREPARING` o `PREPARED`.

## API de estados

Endpoint:

`PATCH /api/orders/:id/status`

Body:

```json
{
  "status": "READY"
}
```

La API acepta cualquier estado posterior que pertenezca al flujo de la modalidad del pedido, sin exigir que sea la siguiente etapa secuencial. Los retrocesos quedan bloqueados.

Validaciones principales:

- un pedido `CANCELED` no puede cambiarse mediante este endpoint operativo;
- Domicilio solo acepta estados de `DELIVERY_FLOW`;
- Recoger / Local solo aceptan estados de `STORE_FLOW`;
- no se permite volver a una etapa anterior;
- seleccionar `PREPARED` o una etapa posterior sincroniza la preparación de todas las líneas como completa;
- `COMPLETED` requiere saldo pendiente igual a `0`, calculado exclusivamente con pagos `PAID`;
- el endpoint no registra ni modifica pagos.

Cocina sigue utilizando este mismo endpoint para `PREPARED → READY`, pero su interfaz mantiene el flujo guiado de producción.

## Base de datos

El flujo usa estos estados adicionales:

- `PREPARED`
- `ARRIVED`
- `DELIVERED`

`OrderItem` incluye:

- `preparedQuantity Int @default(0)`

Migraciones relacionadas:

- `20260916215000_order_workflow`
- `20260916223000_kitchen_item_progress`

En la instalación actual se sincronizó el esquema con `npx prisma db push`; por eso la creación de pedidos ya guarda directamente `PREPARING` y no depende del trigger de las migraciones.

## Compatibilidad

`CONFIRMED` se conserva temporalmente porque pueden existir pedidos anteriores y futuras integraciones pueden usarlo como estado previo a producción. No forma parte del flujo visual final.

## Archivos principales

- `prisma/schema.prisma`
- `src/lib/orderWorkflow.ts`
- `src/app/api/orders/route.ts`
- `src/app/api/orders/[id]/status/route.ts`
- `src/app/api/orders/[id]/items/[itemId]/prepared/route.ts`
- `src/app/cocina/page.tsx`
- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV3.tsx`
- `src/components/OrdersStatusController.tsx`
- `src/components/OrderStatusSelector.tsx`
- `src/components/AppShell.tsx`

## Despliegue

Este cambio no modifica Prisma. Si la base ya fue sincronizada, no requiere ejecutar `npx prisma db push` nuevamente.
