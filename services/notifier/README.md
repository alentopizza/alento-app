# Alentó Notifier

Microservicio de notificaciones de Alentó. Recibe eventos de la app principal, resuelve/crea el contacto y la conversación de WhatsApp en Chatwoot, y envía la plantilla aprobada configurada desde el módulo **Notificaciones**.

También consulta periódicamente la cola persistente de la app para enviar notificaciones programadas, como la solicitud de reseña 60 minutos después de finalizar el pedido.

## Endpoints

- `GET /health`
- `POST /events`

## Variables

```
PORT=3000
NOTIFIER_SHARED_SECRET=
CHATWOOT_BASE_URL=https://chat.operadoranordecolombia.com
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_WHATSAPP_INBOX_ID=13
CHATWOOT_API_ACCESS_TOKEN=
ALENTO_APP_BASE_URL=https://alentopizza.com
```

Las plantillas, imágenes, variables y reglas ya no se configuran como variables de entorno del notifier. Se administran desde Alentó App.

Nota de inventario: en el entorno EasyPanel productivo se observaron también `CHATWOOT_ORDER_CREATED_TEMPLATE_NAME`, `CHATWOOT_ORDER_CREATED_TEMPLATE_LANGUAGE`, `CHATWOOT_ORDER_CREATED_TEMPLATE_CATEGORY` y `CHATWOOT_ORDER_CREATED_TEMPLATE_HEADER_IMAGE_URL`. La versión actual de `server.mjs` no lee esas cuatro variables; la plantilla activa y sus parámetros llegan en el payload desde Alentó App. Se conservan documentadas como variables heredadas observadas, no como requisitos funcionales del servicio.

`ALENTO_APP_BASE_URL` debe apuntar al dominio oficial de producción: `https://alentopizza.com`. Se usa para consultar trabajos programados y convertir las imágenes administradas por Alentó en URLs públicas para WhatsApp.

No usa JSON ni placeholders en variables de entorno.
