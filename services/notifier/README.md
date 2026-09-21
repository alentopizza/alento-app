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
ALENTO_APP_BASE_URL=https://pos.alentopizza.com
```

Las plantillas, imágenes, variables y reglas ya no se configuran como variables de entorno del notifier. Se administran desde Alentó App.

`ALENTO_APP_BASE_URL` permite al notifier consultar la cola de notificaciones programadas. Cuando el dominio oficial reemplace a `pos.alentopizza.com`, actualizar esta variable a `https://alentopizza.com`.

No usa JSON ni placeholders en variables de entorno.
