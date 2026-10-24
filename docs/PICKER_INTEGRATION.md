# Integración Picker Express — respaldo logístico opcional

Última actualización: 2026-10-24

## Objetivo

Picker Express se integra como **proveedor logístico opcional** para pedidos `DELIVERY` cuando Alentó no puede cubrir una entrega con su flota propia.

La integración **no reemplaza**:

- asignación de repartidores Alentó;
- navegación y mapa propios;
- cálculo comercial actual de domicilio;
- ganancias de repartidores;
- estados internos del pedido;
- seguimiento público de Alentó.

Picker funciona como un respaldo seleccionable por pedido.

Documentación oficial usada:

- https://www.pickerexpress.com/desarrollador/documentacion
- https://app.theneo.io/pickerexpress/picker-api-suite/api-reference/bookings/pre-checkout
- https://app.theneo.io/pickerexpress/picker-api-suite/api-reference/bookings/create-booking
- https://app.theneo.io/pickerexpress/picker-api-suite/api-reference/bookings/cancel-booking
- https://app.theneo.io/pickerexpress/picker-api-suite/webhooks/add-store-webhooks

---

## Estado de implementación

| Componente | Estado | Nota |
| --- | --- | --- |
| Modelo 1:1 Pedido ↔ Picker | IMPLEMENTADO | `PickerDelivery` |
| Cotización Pre Checkout | IMPLEMENTADO | No crea servicio |
| Comparación tarifa Alentó / Picker | IMPLEMENTADO | Drawer de pedido |
| ETA Picker | IMPLEMENTADO | Se guarda con la cotización |
| Crear Booking Picker | IMPLEMENTADO | Solo manual |
| Evitar doble despacho | IMPLEMENTADO | Bloqueo en ambas direcciones |
| Cancelar Booking Picker | IMPLEMENTADO | Endpoint propio |
| Guardar tracking Picker | IMPLEMENTADO | Si Picker lo retorna |
| Guardar conductor/proveedor externo | IMPLEMENTADO | Vía webhook |
| Webhook receptor | IMPLEMENTADO | No altera estados Alentó |
| Indicador en Configuración → Domicilios | IMPLEMENTADO | No expone API Key |
| Sandbox Picker | REQUIERE CREDENCIAL | API Key de desarrollo |
| Registro de webhooks en Picker | REQUIERE CONFIGURACIÓN EXTERNA | Ver sección Webhooks |
| Validación de Create Booking real | PENDIENTE DE SANDBOX | No activar producción antes |
| Mapeo automático Picker → estados Alentó | NO ACTIVADO A PROPÓSITO | Evita afectar operación hasta validar |
| Producción | BLOQUEADA HASTA APROBACIÓN | Picker exige testing/validación |

---

## Arquitectura

### Sistema propio sigue siendo principal

```text
Pedido DELIVERY
      |
      +--> Repartidor Alentó
      |
      +--> Picker Express (opcional)
```

Nunca deben operar ambos simultáneamente.

Protecciones implementadas:

- el endpoint de creación Picker rechaza el pedido si existe `order.driverId`;
- el endpoint de asignación de repartidor Alentó rechaza la asignación si existe un booking Picker activo;
- un pedido con Picker activo no puede editar cliente, dirección, productos o modalidad;
- un pedido con Picker activo no puede cancelarse en Alentó hasta cancelar primero el booking Picker.

### Persistencia

Modelo:

`PickerDelivery`

Relación:

```text
Order 1 ───── 0..1 PickerDelivery
```

Campos importantes:

- `bookingId`
- `bookingNumericId`
- `status`
- `pickerStatus`
- `quoteAmount`
- `quoteAmountWithTax`
- `quoteEtaMinutes`
- `quoteDistanceKm`
- `externalDriverName`
- `externalDriverPhone`
- `deliveryProvider`
- `trackingUrl`
- `bookingDetailUrl`
- `lastWebhookAt`
- `lastError`
- `metadata`

No se modifica `Order.driverId` cuando Picker se utiliza.

---

## Variables de entorno

Agregar únicamente en EasyPanel.

```env
PICKER_ENABLED="false"
PICKER_ENVIRONMENT="development"
PICKER_API_KEY=""
PICKER_API_BASE_URL=""
PICKER_CREATE_BOOKING_PATH="/bookings"
PICKER_FALLBACK_CUSTOMER_EMAIL=""
PICKER_SEND_TRACKING_LINK="false"
PICKER_DEFAULT_VEHICLE="BIKE"
PICKER_WEBHOOK_SECRET=""
```

### PICKER_ENABLED

`false`:

- integración invisible en operación;
- endpoints no consumen Picker.

`true`:

- aparece el bloque Picker en pedidos DELIVERY;
- permite cotizar si la credencial está configurada.

### PICKER_ENVIRONMENT

`development`

Base automática:

`https://dev-external-api.pickerexpress.com`

`production`

Base automática:

`https://external-api.pickerexpress.com`

### PICKER_API_KEY

API Key del local/negocio de Picker.

Nunca debe exponerse al navegador.

### PICKER_API_BASE_URL

Normalmente vacío.

Permite reemplazar temporalmente el host si Picker cambia el ambiente o entrega un endpoint particular.

### PICKER_CREATE_BOOKING_PATH

Default:

`/bookings`

Se dejó configurable porque Picker puede cambiar/versionar rutas entre cuentas o suites.

### PICKER_FALLBACK_CUSTOMER_EMAIL

La documentación de Create Booking marca `customerEmail` como requerido.

Alentó permite clientes sin correo, por lo tanto:

1. si el cliente tiene correo, se usa ese;
2. si no, se usa `PICKER_FALLBACK_CUSTOMER_EMAIL`;
3. si ambos faltan, la creación Picker se bloquea.

No afecta la cotización.

### PICKER_SEND_TRACKING_LINK

`false` recomendado inicialmente.

Alentó ya posee seguimiento propio.

Activar solo si se decide que Picker también envíe su enlace por los canales configurados en su cuenta.

### PICKER_DEFAULT_VEHICLE

`BIKE` recomendado para pizzas.

Valores soportados por Picker:

- `BIKE`
- `LITE`

### PICKER_WEBHOOK_SECRET

Se usa como protección adicional del receptor de Alentó.

Ejemplo de URL a registrar:

```text
https://alentopizza.com/api/integrations/picker/webhook?token=SECRETO
```

---

## Flujo operativo

### 1. Pedido normal

El pedido se crea exactamente como antes.

El domicilio que paga el cliente se calcula con las zonas propias de Alentó.

### 2. Cotizar Picker

Desde:

`Pedidos → abrir pedido DELIVERY → Logística externa → Cotizar Picker`

Endpoint interno:

`POST /api/orders/:id/picker/quote`

Alentó envía a Picker Pre Checkout:

- coordenadas Google del cliente;
- método de pago;
- monto de productos;
- vehículo;
- configuración de tracking.

Picker retorna:

- tarifa estimada;
- tarifa con impuestos;
- ETA;
- distancia;
- moneda.

La cotización se guarda en `PickerDelivery`.

**Cotizar no crea ningún servicio.**

### 3. Comparación

El drawer muestra:

- tarifa que Alentó ya cobra al cliente;
- costo estimado Picker;
- ETA Picker.

La tarifa Picker es un **costo operativo**.

No reemplaza automáticamente `Order.deliveryFee`.

### 4. Solicitar Picker

Botón:

`Usar Picker`

Requisitos actuales:

- pedido `DELIVERY`;
- dirección con coordenadas Google;
- cliente con teléfono;
- integración activa;
- pedido en `PREPARED` (Horneando) o `READY`;
- ningún repartidor propio asignado;
- correo de cliente o fallback configurado.

Antes de crear el booking se vuelve a ejecutar Pre Checkout para refrescar la tarifa.

Endpoint:

`POST /api/orders/:id/picker/create`

### 5. Pedido creado en Picker

Se guarda:

- booking ID;
- ID numérico;
- tarifa más reciente;
- tracking;
- estado Picker;
- metadata de respuesta.

El estado interno de Alentó NO cambia automáticamente.

### 6. Cancelación

Endpoint:

`POST /api/orders/:id/picker/cancel`

Picker documenta que la cancelación depende del estado actual del booking.

Si Picker rechaza la cancelación, Alentó conserva el error en `lastError`.

---

## Pago enviado a Picker

Regla:

- pago pendiente en efectivo → `CASH`;
- cualquier otro medio → `CARD`.

Esto sigue la recomendación de Picker:

- `CASH`: conductor debe cobrar;
- `CARD`: el conductor solo recoge y entrega.

El campo `orderAmount` se envía como:

```text
subtotal - descuento
```

El domicilio cobrado al cliente se envía aparte como:

`businessDeliveryFee`

---

## Webhooks

Endpoint Alentó:

`POST /api/integrations/picker/webhook`

Eventos que Picker documenta:

- `DRIVER_ASSIGNED`
- `UPDATE_BOOKING_STATUS`

El receptor intenta asociar por:

1. `bookingId`;
2. `bookingNumericId`;
3. `externalBookingId`.

### DRIVER_ASSIGNED

Se guardan cuando están disponibles:

- nombre del conductor;
- teléfono;
- proveedor logístico.

Un DRIVER_ASSIGNED puede llegar más de una vez si Picker reasigna conductor.

### UPDATE_BOOKING_STATUS

Se guarda el estado Picker en `pickerStatus`.

### Decisión de seguridad

Los webhooks **NO modifican todavía**:

- `Order.status`;
- `Order.driverId`;
- `driverAssignedAt`;
- ganancias de repartidores.

Esta decisión es deliberada.

Primero se deben capturar payloads reales en sandbox y validar todos los estados de Colombia.

---

## Registro de webhooks

Una vez Picker entregue/active la API Key de sandbox:

Registrar la URL:

```text
https://alentopizza.com/api/integrations/picker/webhook?token=<PICKER_WEBHOOK_SECRET>
```

para:

- `DRIVER_ASSIGNED`
- `UPDATE_BOOKING_STATUS`

Después confirmar en base de datos:

- `lastWebhookAt`;
- `externalDriverName`;
- `deliveryProvider`;
- `pickerStatus`.

---

## Archivos principales

Cliente Picker:

`src/lib/picker.ts`

Mapeo del pedido:

`src/lib/pickerOrder.ts`

Estado de integración:

`GET /api/integrations/picker/status`

Cotización:

`POST /api/orders/[id]/picker/quote`

Crear servicio:

`POST /api/orders/[id]/picker/create`

Cancelar:

`POST /api/orders/[id]/picker/cancel`

Webhook:

`POST /api/integrations/picker/webhook`

UI:

`src/components/OrdersCardsDashboardV3.tsx`

Configuración:

`src/app/configuracion/page.tsx`

Persistencia:

`prisma/schema.prisma`

---

## Checklist sandbox

### Antes de activar

- [ ] Crear/obtener cuenta de desarrollo Picker.
- [ ] Obtener API Key de sandbox.
- [ ] Configurar `PICKER_ENVIRONMENT=development`.
- [ ] Configurar `PICKER_API_KEY`.
- [ ] Configurar `PICKER_FALLBACK_CUSTOMER_EMAIL`.
- [ ] Configurar `PICKER_WEBHOOK_SECRET`.
- [ ] Mantener `PICKER_SEND_TRACKING_LINK=false`.
- [ ] Ejecutar deploy para que `prisma db push` cree `PickerDelivery`.
- [ ] Activar `PICKER_ENABLED=true`.

### Pruebas obligatorias

- [ ] Cotizar cliente con dirección Google válida.
- [ ] Comparar tarifa contra domicilio Alentó.
- [ ] Confirmar que cotizar NO cree pedido en Picker.
- [ ] Confirmar bloqueo si hay repartidor Alentó.
- [ ] Crear Picker desde pedido PREPARED.
- [ ] Capturar booking ID.
- [ ] Confirmar DRIVER_ASSIGNED.
- [ ] Confirmar UPDATE_BOOKING_STATUS.
- [ ] Abrir tracking.
- [ ] Cancelar booking permitido.
- [ ] Validar pedido en efectivo.
- [ ] Validar pedido ya pagado / Nequi.
- [ ] Confirmar que estados internos Alentó no cambian por webhook.
- [ ] Validar funcionamiento con pedido sin email usando fallback.

---

## Paso a producción

No cambiar directamente a producción después de una prueba aislada.

Picker describe un proceso de:

1. integración;
2. validación;
3. testing completo;
4. aprobación;
5. activación productiva.

Cuando sandbox esté aprobado:

```env
PICKER_ENVIRONMENT="production"
PICKER_API_KEY="<API KEY PRODUCCIÓN>"
PICKER_ENABLED="true"
```

y registrar nuevamente los webhooks en el ambiente productivo.

---

## Próxima fase después de validar sandbox

Solo después de observar los payloads reales:

1. definir tabla de equivalencias Picker → Alentó;
2. decidir si ACCEPTED implica alguna etiqueta visual;
3. decidir cuándo pasar automáticamente a `OUT_FOR_DELIVERY`;
4. decidir si estado final Picker debe marcar `DELIVERED`;
5. incorporar conductor Picker al mapa de entregas si Picker expone coordenadas en tiempo real;
6. agregar analítica:
   - pedidos propios vs Picker;
   - costo promedio Picker;
   - diferencia entre tarifa cobrada y costo Picker;
   - porcentaje de respaldo externo;
   - tiempos promedio.

Hasta esa validación, no automatizar los estados internos.
