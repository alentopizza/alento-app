# Club Puntos

## Objetivo

Club Puntos administra únicamente fidelización por puntos.

No debe medir instalaciones PWA, dispositivos ni alcance de notificaciones. Esas métricas pertenecen al módulo de Notificaciones Push.

## UI

- `/club-alento`
- `src/components/ClubPointsAdmin.tsx`

La vista administrativa muestra:

- clientes con saldo;
- puntos en circulación;
- puntos acumulados;
- puntos redimidos;
- regla actual de acumulación;
- ranking por saldo;
- compras que generaron puntos;
- último movimiento.

## API

- `src/app/api/club-points/route.ts`
- `src/app/api/club-settings/route.ts`

`/api/club-points` no consulta información PWA ni instalaciones de dispositivos.

## Persistencia

Puntos:

- `ClubPointTransaction`

Configuración:

- `AppSetting` con la clave usada por `src/lib/clubAlento.ts`.

## Reglas

Las reglas activas de acumulación se centralizan en:

- `src/lib/clubAlento.ts`

La acreditación ocurre cuando el pedido llega a estado finalizado y cumple las reglas de elegibilidad.

## Separación con Notificaciones

Club Puntos no debe responder preguntas como:

- cuántas personas instalaron la PWA;
- cuántos dispositivos tienen la app;
- qué plataforma usa el cliente;
- cuántos clientes pueden recibir Push.

El alcance real para comunicaciones se obtiene desde las suscripciones Web Push en el módulo de Notificaciones.

Ver:

- `docs/PUSH_NOTIFICATIONS.md`

## Tracking de instalaciones retirado

El tracking activo de instalaciones de clientes fue eliminado:

- eliminado `src/components/PwaCustomerInstallTracker.tsx`;
- eliminado `src/app/api/customer-app/install/route.ts`;
- retirado del layout global;
- retiradas las consultas y filtros de Club Puntos.

El modelo histórico `CustomerAppInstallation` puede conservarse temporalmente en Prisma solo para evitar cambios destructivos durante `prisma db push`. No debe consumirse desde código nuevo.
