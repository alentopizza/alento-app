# Integración POS con Rappi

Estado: preparada en código y deshabilitada por defecto mientras Rappi habilita el ambiente de pruebas, credenciales y webhooks.

## Identificación

- Comercio: Alentó Pizza
- Rappi Store ID: `900489414`
- Endpoint receptor: `/api/integrations/rappi/webhook`
- Endpoint administrativo: `/api/integrations/rappi`

El URL público que se entregue a Rappi debe ser el dominio HTTPS de Alentó seguido de:

```
/api/integrations/rappi/webhook
```

## Variables de entorno

```dotenv
RAPPI_ENABLED="false"
RAPPI_ENVIRONMENT="sandbox"
RAPPI_API_BASE_URL=""
RAPPI_STORE_ID="900489414"
RAPPI_CLIENT_ID=""
RAPPI_CLIENT_SECRET=""
RAPPI_WEBHOOK_SECRET=""
RAPPI_WEBHOOK_SECRETS=""
RAPPI_AUTO_ACCEPT="false"
RAPPI_REJECT_CANCEL_TYPE=""
```

Reglas:

- Mantener `RAPPI_ENABLED=false` hasta cargar credenciales válidas.
- Sandbox usa por defecto `https://api.dev.rappi.com`.
- Producción Colombia usa por defecto `https://api.rappi.com.co`.
- Nunca exponer `RAPPI_CLIENT_SECRET` ni secretos de webhook al navegador.
- `RAPPI_WEBHOOK_SECRET` mantiene compatibilidad con una sola firma.
- Si Rappi genera un secreto distinto por evento, guardar todos en
  `RAPPI_WEBHOOK_SECRETS`, separados por coma.
- `RAPPI_REJECT_CANCEL_TYPE` se deja vacío hasta que Rappi confirme el tipo
  de rechazo disponible en homologación.
- `RAPPI_AUTO_ACCEPT=false` hace que el operador acepte la orden desde Alentó.
  Solo activar aceptación automática después de homologarla.

## Flujo operativo implementado

1. Rappi envía `NEW_ORDER` al webhook firmado.
2. Alentó valida `Rappi-Signature` con HMAC-SHA256 sobre el cuerpo crudo.
3. La orden se importa de forma idempotente con `source=RAPPI`.
4. Se conserva el payload original para auditoría y la relación
   `provider + externalOrderId` evita pedidos duplicados.
5. Los SKU de Rappi se intentan mapear a `ProductVariant.sku`. Si un SKU no
   existe, la línea igual entra con su nombre y configuración externa para no
   perder el pedido.
6. El pedido queda inicialmente en `CONFIRMED`, dispara la alerta existente de
   Cocina y se identifica visualmente como Rappi.
7. Al pasar de Confirmado a Preparación, Alentó llama al endpoint `take` de
   Rappi. Si Rappi no confirma, el estado local no avanza.
8. Cocina solo permite marcar productos después de que la orden haya sido
   aceptada en Rappi.
9. Al pasar a `READY`, Alentó llama a `ready-for-pickup`.
10. Eventos de Rappi actualizan estado remoto, RappiTendero, ETA y ubicación
    cuando esos datos estén presentes.
11. Una cancelación recibida desde Rappi cancela el pedido local y sus
    movimientos pendientes sin borrar la trazabilidad.

## Cobros y Caja

La integración operativa no convierte automáticamente una venta Rappi en dinero
recibido por la caja física.

- El pedido sí cuenta como venta.
- El movimiento de cobro Rappi queda `PENDING`.
- No se permite registrar ni borrar ese cobro manualmente desde Alentó.
- El comprobante indica que el cobro es administrado por Rappi.
- Los pedidos Rappi pueden completar su flujo operativo sin exigir un pago
  local.
- La conciliación de comisiones, descuentos, ajustes y transferencias de Rappi
  debe implementarse después con la Financial API, como una fase separada.

Esto evita inflar el efectivo o las transferencias recibidas antes de que Rappi
realmente liquide el dinero.

## Webhooks a solicitar/configurar

Prioridad operativa:

- `NEW_ORDER`
- `ORDER_EVENT_CANCEL`
- `ORDER_OTHER_EVENT`
- `PING`
- `ORDER_RT_TRACKING`

Opcionales para pedidos programados:

- `NEW_ORDER_SCHEDULED`
- `NEW_ORDER_SCHEDULED_CANCELLED`

`NEW_ORDER_SCHEDULED` se reconoce pero no crea una orden operativa porque Rappi
envía sus valores monetarios provisionales en cero. Alentó espera el
`NEW_ORDER` definitivo.

### Seguridad

Cada webhook debe conservar el secreto que entrega Rappi. La aplicación valida
la firma recibida en `Rappi-Signature` usando el timestamp, un punto y el cuerpo
exacto recibido:

```
<timestamp>.<raw-body>
```

Si ninguna firma coincide, el endpoint devuelve un status no exitoso y no
procesa el evento.

## PING

El mismo endpoint responde al PING de Rappi con:

```json
{
  "status": "OK",
  "description": "Store on"
}
```

La firma se valida antes de responder.

## Recuperación por consulta

Un administrador autenticado puede usar:

- `GET /api/integrations/rappi`: muestra únicamente estado seguro de la
  configuración; nunca devuelve secretos.
- `POST /api/integrations/rappi` con `{"action":"test"}`: prueba token/API y
  cuenta órdenes pendientes.
- `POST /api/integrations/rappi` con `{"action":"sync"}`: consulta órdenes
  pendientes e importa las que aún no existan.

La sincronización manual es un respaldo; el mecanismo principal son webhooks.

## Productos

La primera homologación debe revisar los SKU que Rappi envía frente a los SKU de
las variantes de Alentó. Un faltante de mapeo no bloquea la orden: se conserva
el nombre, cantidad, precio, toppings/subitems y observaciones recibidas.

## Checklist cuando lleguen las credenciales

1. Confirmar dominio/API asignados por Rappi para pruebas.
2. Cargar `RAPPI_CLIENT_ID` y `RAPPI_CLIENT_SECRET` como secretos del servidor.
3. Mantener `RAPPI_ENVIRONMENT=sandbox`.
4. Configurar la URL pública del webhook para los eventos acordados.
5. Guardar todos los secretos de firma devueltos por Rappi.
6. Definir `RAPPI_REJECT_CANCEL_TYPE` solo con el valor confirmado por Rappi.
7. Activar `RAPPI_ENABLED=true` y desplegar.
8. Ejecutar la prueba administrativa de conexión.
9. Homologar PING y firma HMAC válida/inválida.
10. Crear un pedido de prueba y verificar:
   - recepción automática;
   - alerta;
   - datos del cliente y dirección;
   - productos, toppings y comentarios;
   - aceptación desde Alentó;
   - preparación en Cocina;
   - `ready-for-pickup`;
   - evento del RappiTendero y ETA;
   - cancelación;
   - impresión sin cobro doble.
11. Verificar un webhook repetido para confirmar que no duplica la orden.
12. Solo después de pasar homologación cambiar a producción.

## Referencias oficiales usadas para el diseño

- Authentication Process:
  https://dev-portal.rappi.com/en/authentication-process/
- NEW Rest API of Orders:
  https://dev-portal.rappi.com/en/api-reference/orders-rests-api/
- Webhook Events:
  https://dev-portal.rappi.com/en/webhook-events/
- Webhooks API:
  https://dev-portal.rappi.com/en/api-reference/webhooks/
