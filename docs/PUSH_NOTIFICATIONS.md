# Push y campañas de notificación

## Fuente única de verdad

Alentó usa un solo centro de notificaciones en `/notificaciones`.

Ese centro contiene:

- **Push PWA**: campañas manuales con historial y estadísticas.
- **Automatizaciones WhatsApp**: plantillas de Meta existentes.

No crear un segundo centro ni un segundo motor Push.

## Canal oficial: PWA / Web Push

Servidor:

- `src/lib/driverPush.ts`

Cliente:

- `src/lib/webPushClient.ts`
- `public/sw.js`

Las suscripciones se guardan en `DriverPushSubscription`.

El mismo motor Web Push se reutiliza para repartidores, Cocina y demás roles internos. No crear un canal móvil paralelo para un rol específico.

## Campañas manuales

Reglas y audiencias:

- `src/lib/pushCampaigns.ts`

API:

- `src/app/api/push-campaigns/route.ts`
- `src/app/api/push-campaigns/image/route.ts`
- `src/app/api/push-campaigns/[id]/open/route.ts`

UI:

- `src/components/PushCampaignManager.tsx`

Persistencia:

- `PushCampaign`
- `PushCampaignOpen`

Toda campaña nueva se registra y entrega por el canal `WEB`.

## Estadísticas

- **Objetivo**: suscripciones PWA encontradas antes del envío.
- **Entregas**: mensajes aceptados correctamente por Web Push.
- **Fallos**: intentos rechazados por el servicio Push.
- **Vistas**: aperturas únicas registradas al tocar la notificación.

“Entrega” no significa que una persona leyó el mensaje; significa que el proveedor Web Push aceptó la entrega.

## Configuración

Variables requeridas:

`WEB_PUSH_VAPID_SUBJECT`

`WEB_PUSH_VAPID_PUBLIC_KEY`

`WEB_PUSH_VAPID_PRIVATE_KEY`

Las claves VAPID pertenecen al servidor. El navegador recibe únicamente la clave pública.

## Repartidor PWA

La aplicación oficial del repartidor es la PWA en `/repartidor`.

- La disponibilidad se mantiene en `User.driverAvailable`.
- La ubicación general se obtiene mediante `navigator.geolocation.watchPosition()`.
- `/api/repartidor/location` acepta únicamente la sesión autenticada del repartidor y registra `driverLocationSource = "WEB"`.
- El Push del repartidor usa `/api/repartidor/push` y Web Push.
- La navegación externa abre Google Maps desde el navegador.

No crear bridges, tokens o canales Android paralelos. Si una limitación del navegador requiere calibración, se resuelve primero dentro del flujo PWA.

## Compatibilidad histórica de base de datos

El esquema puede conservar temporalmente columnas o tablas históricas de integraciones móviles anteriores para evitar que `prisma db push` ejecute eliminaciones destructivas durante un despliegue. Esos registros no forman parte del flujo activo y no deben volver a ser consumidos por código nuevo.
