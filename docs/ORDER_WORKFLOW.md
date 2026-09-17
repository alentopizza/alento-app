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
- muestra número ALT, modalidad, cliente y minutos transcurridos;
- muestra la configuración estructurada de cada producto;
- muestra progreso total de preparación en unidades y porcentaje;
- resalta pedidos que llevan más tiempo;
- se actualiza automáticamente cada 15 segundos.

## Pedidos

La pestaña **Pedidos** incluye un bloque de **Pedidos activos** que usa el mismo motor de estados.

Mientras una orden se encuentre en `PREPARING` o `PREPARED`, el control operativo permanece en Cocina y Pedidos muestra acceso directo a esa pestaña.

Una vez `READY`:

- Domicilio continúa por En camino → Ha llegado → Entregado → Finalizado.
- Recoger / Local continúan de Listo → Finalizado.

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

La transición `PREPARING → PREPARED` está protegida: no se permite si existen productos pendientes. Normalmente esta transición ocurre automáticamente mediante el progreso de Cocina.

La transición `PREPARED → READY` sí la ejecuta Cocina mediante **MARCAR COMO LISTO**.

Después de `READY`, la API valida siempre la siguiente etapa permitida según la modalidad del pedido.

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

La primera migración también instala un trigger que transforma nuevas órdenes insertadas como `CONFIRMED` a `PREPARING`, garantizando que entren directamente a Cocina.

## Compatibilidad

`CONFIRMED` se conserva temporalmente porque pueden existir pedidos anteriores y futuras integraciones pueden usarlo como estado previo a producción. No forma parte del flujo visual final.

## Archivos principales

- `prisma/schema.prisma`
- `prisma/migrations/20260916215000_order_workflow/migration.sql`
- `prisma/migrations/20260916223000_kitchen_item_progress/migration.sql`
- `src/lib/orderWorkflow.ts`
- `src/components/OrderStatusFlow.tsx`
- `src/components/OrdersWorkflowManager.tsx`
- `src/app/api/orders/[id]/status/route.ts`
- `src/app/api/orders/[id]/items/[itemId]/prepared/route.ts`
- `src/app/cocina/page.tsx`

## Despliegue

Este bloque requiere `prisma migrate deploy` porque agrega `PREPARED` al enum `OrderStatus` y `preparedQuantity` a `OrderItem`.

No es un cambio únicamente visual.
