# Flujo operativo de pedidos

Este documento define el ciclo de vida oficial de una orden en Alentó App.

## Regla de entrada

Todo pedido nuevo creado desde el POS entra directamente al estado interno `PREPARING` y aparece en la pestaña **Cocina**.

El sistema conserva compatibilidad temporal con pedidos antiguos que estén en `CONFIRMED`; Cocina también los muestra y los normaliza antes de avanzar.

## Domicilio

Flujo oficial:

1. `PREPARING` — **PREPARADO**
2. `READY` — **LISTO**
3. `OUT_FOR_DELIVERY` — **EN CAMINO**
4. `ARRIVED` — **HA LLEGADO**
5. `DELIVERED` — **ENTREGADO**
6. `COMPLETED` — **FINALIZADO**

El pedido solo puede avanzar al siguiente estado válido. No se permiten saltos de etapas desde la API de estado.

## Recoger y Local

Flujo oficial:

1. `PREPARING` — **PREPARADO**
2. `READY` — **LISTO**
3. `COMPLETED` — **FINALIZADO**

`PICKUP` y `STORE` comparten el mismo ciclo corto.

## Cocina

Cocina muestra únicamente órdenes en preparación (`PREPARING`) y, temporalmente, órdenes antiguas `CONFIRMED`.

La pantalla:

- ordena las comandas desde la más antigua;
- muestra número ALT, modalidad, cliente y minutos transcurridos;
- muestra la configuración estructurada de cada producto;
- resalta visualmente pedidos que llevan más tiempo;
- permite **Marcar como listo**;
- al pasar a `READY`, la orden deja de aparecer en Cocina.

La pantalla se actualiza automáticamente cada 15 segundos y también se refresca después de cambiar una orden.

## Pedidos

La pestaña **Pedidos** incluye un bloque superior de **Pedidos activos** que usa el mismo motor de estados.

Comportamiento:

- muestra solo órdenes activas;
- cada orden tiene su barra visual de progreso;
- `PREPARING` se gestiona desde Cocina y muestra acceso directo a esa pestaña;
- una vez `READY`, los avances posteriores se realizan desde Pedidos;
- Domicilio continúa por En camino → Ha llegado → Entregado → Finalizado;
- Recoger / Local continúan directamente de Listo → Finalizado;
- el bloque se actualiza automáticamente cada 15 segundos.

El listado histórico y las herramientas existentes de detalle, edición, cancelación e impresión permanecen debajo del bloque operativo.

## API de estados

Endpoint:

`PATCH /api/orders/:id/status`

Body:

```json
{
  "status": "READY"
}
```

La API valida el estado actual, la modalidad del pedido y la siguiente transición permitida. Un pedido cancelado o finalizado no puede continuar avanzando.

## Base de datos

Se agregaron los estados:

- `ARRIVED`
- `DELIVERED`

La migración también instala un trigger de base de datos que transforma nuevas órdenes insertadas como `CONFIRMED` a `PREPARING`. Esto mantiene compatible la creación actual del POS y garantiza que una orden nueva ingrese directamente a Cocina.

## Compatibilidad

`CONFIRMED` se conserva temporalmente en el enum porque pueden existir registros anteriores y porque otras integraciones futuras podrían utilizarlo antes de entrar al flujo de producción. No forma parte del flujo visual final.

## Archivos principales

- `prisma/schema.prisma`
- `prisma/migrations/20260916215000_order_workflow/migration.sql`
- `src/lib/orderWorkflow.ts`
- `src/components/OrderStatusFlow.tsx`
- `src/components/OrdersWorkflowManager.tsx`
- `src/components/AppShell.tsx`
- `src/app/api/orders/[id]/status/route.ts`
- `src/app/cocina/page.tsx`

## Despliegue

Este bloque **sí requiere migración de Prisma/PostgreSQL** porque agrega valores al enum `OrderStatus`.

El despliegue debe ejecutar la migración antes de arrancar la versión nueva de la aplicación. No es un cambio únicamente visual.
