# Push y campañas de notificación

## Objetivo

Alentó usa un solo motor Web Push para clientes y equipo interno.

No crear motores Push paralelos por módulo. Repartidor, Cocina, Administración y clientes reutilizan la misma infraestructura, las mismas claves VAPID, el mismo service worker y el mismo endpoint base.

El centro administrativo está en:

- UI: `/notificaciones`
- componente: `src/components/PushCampaignManager.tsx`

## Arquitectura activa

### Cliente Web Push

- `src/lib/webPushClient.ts`

Responsabilidades:

- comprobar soporte del navegador;
- solicitar permiso;
- crear o reutilizar la `PushSubscription` del navegador;
- sincronizarla con el servidor;
- desactivar la suscripción cuando el usuario lo solicite.

### Endpoint único

- `src/app/api/push/route.ts`

Scopes:

- `/api/push?scope=customer`
- `/api/push?scope=staff`

El endpoint es único. El scope solo indica a qué audiencia pertenece la activación.

Nunca deducir la audiencia únicamente por la presencia de una sesión interna: un mismo dispositivo puede pertenecer simultáneamente a Staff y Clientes.

### Persistencia

La fuente activa de suscripciones es:

- `DriverPushSubscription`

Aunque el nombre del modelo es histórico, almacena tanto suscripciones internas como de clientes.

Campos relevantes:

- `endpoint`: identifica de forma única la PushSubscription del navegador.
- `userId`: usuario interno asociado, cuando aplica.
- `customerId`: cliente asociado, cuando aplica.
- `staffOptIn`: el dispositivo participa en audiencias internas.
- `customerOptIn`: el dispositivo participa en audiencias de clientes.
- `lastSuccessAt`: última entrega aceptada por Web Push.

Una sola suscripción puede tener ambos opt-in activos mientras exista una asociación Staff válida. No duplicar filas para el mismo `endpoint`.

Regla de aislamiento:

- una suscripción sin `userId` nunca puede tener `staffOptIn = true`;
- al sincronizar el scope Cliente sin una sesión Staff vigente, cualquier asociación Staff heredada del mismo endpoint se elimina;
- al cerrar sesión interna se retira el scope Staff del navegador sin destruir una posible suscripción de Cliente.

### Servicio de envío

- `src/lib/driverPush.ts`

Funciones relevantes:

- `sendDriverPush()`
- `sendStaffPushToRoles()`
- `sendCustomerPush()`
- `sendCustomerPushToCustomer()`

`sendCustomerPush()` sirve para campañas generales de clientes.

`sendCustomerPushToCustomer(customerId, ...)` es el único flujo permitido para notificaciones transaccionales dirigidas a un cliente específico.

## Audiencias

Las campañas manuales usan:

- Clientes
- Repartidores
- Cocina
- POS / Caja
- Administración
- Todo el equipo

Reglas:

- Clientes se determina por `customerOptIn = true`.
- Staff se determina por `staffOptIn = true` y el rol del usuario.
- El contador mostrado en Notificaciones representa suscripciones Push disponibles para la audiencia seleccionada.
- No confundir este número con instalaciones PWA.

La antigua medición de “clientes con app instalada” fue retirada del flujo activo. El público útil para campañas se mide por suscripciones Push reales.

## Campañas manuales

Reglas y destinos:

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

### Imágenes

La imagen opcional:

1. se optimiza en el navegador;
2. se convierte a WebP cuando es posible;
3. se almacena en `NotificationImage`;
4. se entrega en el payload Push como `image`.

El endpoint de carga siempre debe responder JSON, incluso en errores.

### Destino al tocar

Las campañas soportan:

- Aplicación
- Sección
- Web
- Nada

El service worker usa `payload.url` para navegar al destino:

- `public/sw.js`

## Notificaciones transaccionales de pedidos

Archivo principal:

- `src/lib/customerOrderPush.ts`

### Regla de seguridad funcional

Una notificación de pedido nunca se envía a “todos los clientes”.

Siempre se resuelve así:

```
Order.customerId
  -> DriverPushSubscription.customerId
  -> customerOptIn = true
  -> envío únicamente a ese cliente
```

La búsqueda exacta se realiza mediante:

- `sendCustomerPushToCustomer(customerId, ...)`

Esto garantiza que el estado de un pedido no se publique a otra cuenta.

### Creación del pedido

- `src/app/api/orders/route.ts`

Al crear un pedido con cliente asociado se envía un Push específico al propietario.

El título incluye el número del pedido.

### Cambios operativos

- `src/app/api/orders/[id]/status/route.ts`

Los cambios desde POS, Administración y Cocina llaman a:

- `sendCustomerOrderStatusPush()`

### Cambios desde Reparto

- `src/app/api/repartidor/pedido/[token]/status/route.ts`

Se notifican:

- En camino
- Llegó
- Entregado

Siempre usando el `customerId` del pedido.

### Cancelaciones y regresos automáticos

- `src/app/api/orders/[id]/route.ts`

También se envía Push cuando:

- el pedido se cancela;
- una edición obliga al pedido a volver a preparación.

### Seguimiento

Cada Push transaccional genera el enlace seguro con:

- `src/lib/orderTracking.ts`

Destino:

```
/seguimiento/<token>
```

Al tocar la notificación, el service worker abre el seguimiento de ese pedido específico.

## Estados y mensajes

Los mensajes se centralizan en:

- `src/lib/customerOrderPush.ts`

Estados cubiertos:

- CONFIRMED
- PREPARING
- PREPARED
- READY
- OUT_FOR_DELIVERY
- ARRIVED
- DELIVERED
- COMPLETED
- CANCELED

No dispersar copias de los textos por distintas rutas.

## Controles de usuario

### Clientes

- prompt público: `src/components/CustomerPushPrompt.tsx`
- ajuste en perfil: `src/components/CustomerPushControl.tsx`

Ambos usan:

`/api/push?scope=customer`

### Repartidor

- `src/components/DriverPushControl.tsx`

Usa:

`/api/push?scope=staff`

### Cocina

- `src/components/KitchenOrderAlerts.tsx`

Combina sonido local y el mismo flujo Push Staff.

### Administración / Staff

- `src/components/StaffPushDeviceControl.tsx`

Permite activar el dispositivo y enviar una prueba Push.

## Métricas

En campañas:

- **Objetivo**: suscripciones encontradas antes del envío.
- **Entregas**: mensajes aceptados correctamente por Web Push.
- **Fallos**: intentos rechazados.
- **Vistas**: aperturas únicas registradas al tocar la notificación.

“Entrega” no significa que una persona leyó el mensaje. Significa que Web Push aceptó la entrega.

## Configuración

Variables requeridas:

```
WEB_PUSH_VAPID_SUBJECT
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
```

La clave privada nunca se envía al navegador.

## PWA e instalaciones

El sistema ya no mantiene un tracker activo de instalaciones PWA de clientes.

Se retiraron:

- `PwaCustomerInstallTracker`
- `/api/customer-app/install`

La audiencia útil se calcula con suscripciones Push reales, no con señales de instalación.

La tabla histórica `CustomerAppInstallation` puede permanecer temporalmente en Prisma únicamente para evitar que `prisma db push` provoque una eliminación destructiva durante un despliegue. Ningún flujo activo debe leerla ni escribirla.

## Compatibilidad histórica

También puede existir temporalmente `CustomerPushSubscription` por compatibilidad de base de datos. El flujo activo escribe en `DriverPushSubscription` y migra registros históricos cuando corresponde.

No crear código nuevo contra modelos históricos.
