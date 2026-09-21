# Alentó Notifier

Microservicio de notificaciones de Alentó.

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
CHATWOOT_ORDER_CREATED_TEMPLATE_NAME=nuevo_pedido_v2
CHATWOOT_ORDER_CREATED_TEMPLATE_LANGUAGE=es
CHATWOOT_ORDER_CREATED_TEMPLATE_CATEGORY=MARKETING
CHATWOOT_ORDER_CREATED_TEMPLATE_HEADER_IMAGE_URL=https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/arG6qTss0Dye7zuwPYrR.png
```

No usa JSON ni placeholders en variables de entorno.
