# Push y campañas de notificación

## Fuente única de verdad

Alentó usa un solo centro de notificaciones en `/notificaciones`.

Ese centro contiene:

- **Push APK / PWA**: campañas manuales con historial y estadísticas.
- **Automatizaciones WhatsApp**: plantillas de Meta existentes.

No crear un segundo centro ni un segundo motor Push.

## Canales

### PWA / Web Push

Servidor:

- `src/lib/driverPush.ts`

Cliente:

- `src/lib/webPushClient.ts`
- `public/sw.js`

Las suscripciones existentes se guardan en `DriverPushSubscription`.

### APK Repartidor 004 / Firebase Cloud Messaging

Servidor:

- `src/lib/nativePush.ts`
- `src/app/api/repartidor/native-push/register/route.ts`

Android:

- `NativePushManager.kt`
- `AlentoFirebaseMessagingService.kt`
- `AlentoDriverApplication.kt`

Los dispositivos se guardan en `NativePushDevice`.

El registro Android reutiliza el token nativo firmado de 30 días que ya usa ubicación. No crear un segundo mecanismo de autenticación para la APK.

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

## Estadísticas

- **Objetivo**: dispositivos suscritos encontrados antes del envío.
- **Entregas**: mensajes aceptados correctamente por Web Push o FCM.
- **Fallos**: intentos rechazados por el servicio Push.
- **Vistas**: aperturas únicas registradas al tocar la notificación.

“Entrega” no significa que una persona leyó el mensaje; significa que el proveedor Push aceptó la entrega.

## Firebase Android

Variables requeridas en producción:

`FIREBASE_ANDROID_API_KEY`

`FIREBASE_ANDROID_APP_ID`

`FIREBASE_PROJECT_ID`

`FIREBASE_MESSAGING_SENDER_ID`

`FIREBASE_SERVICE_ACCOUNT_JSON`

La cuenta de servicio es secreta. Nunca enviarla al navegador ni incluirla en la APK.

## Seguridad operativa

- La APK se registra solo para usuarios activos con rol DRIVER/DISPATCH.
- Estar **Inactivo** no elimina el Push: un repartidor inactivo puede recibir una novedad.
- **Cerrar sesión** sí desactiva la asociación del dispositivo con ese usuario.
- La ubicación 003/004 funciona por un flujo independiente; no modificar GPS para cambios exclusivamente de Push.
