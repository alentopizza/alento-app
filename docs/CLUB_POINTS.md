# Club Puntos

Última actualización: **2026-10-26**.

Estado: **IMPLEMENTADO; CANJE TRANSACCIONAL PENDIENTE**

## Objetivo

Club Puntos administra únicamente fidelización por puntos.

No debe medir instalaciones PWA, dispositivos ni alcance de notificaciones. Esas métricas pertenecen al módulo de Notificaciones Push.

## UI

- `/club-alento`
- `src/components/ClubPointsAdmin.tsx`

La vista administrativa muestra:

- estado maestro **Activo / Inactivo**;
- clientes con saldo;
- puntos en circulación;
- puntos acumulados;
- puntos redimidos;
- regla actual de acumulación;
- porcentaje de acumulación y compra mínima de redención;
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

Las reglas activas se centralizan en:

- `src/lib/clubAlento.ts`

Configuración vigente:

- `enabled`: interruptor maestro;
- `earnRatePercent`: porcentaje sobre subtotal elegible;
- `minimumRedemptionPurchase`: compra mínima configurada para futura redención;
- `pointValueCop`: valor nominal del punto.

La acreditación ocurre cuando el pedido llega a `COMPLETED`, está pagado, tiene cliente y cumple las reglas de elegibilidad.

Reglas actuales:

- combos/promociones no generan puntos;
- si el pedido tiene cupón/descuento, las líneas afectadas no generan puntos;
- el domicilio no genera puntos;
- un pedido acredita una sola vez mediante `ClubPointTransaction.orderId`;
- pedidos cancelados no conservan puntos.

## Activar / desactivar Club

El administrador puede cambiar **Club Puntos en la app** desde:

`/club-alento → Ajustes`

Cuando `enabled = false`:

- Club desaparece de la navegación pública inferior;
- una visita directa a `/club` redirige a `/menu`;
- no se acreditan puntos nuevos al completar pedidos;
- los puntos y movimientos existentes no se eliminan;
- porcentaje, compra mínima y demás configuración permanecen guardados.

Al reactivar Club, la navegación reaparece y la acumulación continúa con los saldos históricos existentes.

El GET público de `/api/club-settings` puede exponer la configuración necesaria para decidir visibilidad. El PUT continúa protegido para ADMIN.

## Rendimiento de la superficie pública

La página `/club` debe evitar trabajo periódico innecesario:

- sesión de cliente y configuración Club se consultan en paralelo;
- invitados no ejecutan refresco completo cada pocos segundos;
- clientes autenticados usan refresco periódico menos agresivo y eventos de datos cuando corresponda;
- existe `src/app/club/loading.tsx` para dar feedback inmediato durante navegación.

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


## Archivos principales

- `src/lib/clubAlento.ts`;
- `src/components/ClubPointsAdmin.tsx`;
- `src/components/PublicMobileNav.tsx`;
- `src/app/club/page.tsx`;
- `src/app/club/loading.tsx`;
- `src/app/api/club-settings/route.ts`;
- `src/app/api/club-points/route.ts`;
- `src/app/api/orders/[id]/status/route.ts`.

## Regla de no regresión

Desactivar Club debe pausar únicamente la fidelización. No debe interrumpir el cierre normal del pedido, notificaciones, estado operativo ni otros efectos de `COMPLETED`.
