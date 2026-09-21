import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const SHARED_SECRET = process.env.NOTIFIER_SHARED_SECRET || "";
const CHATWOOT_BASE_URL = (process.env.CHATWOOT_BASE_URL || "").replace(/\/$/, "");
const CHATWOOT_ACCOUNT_ID = Number(process.env.CHATWOOT_ACCOUNT_ID || 0);
const CHATWOOT_INBOX_ID = Number(process.env.CHATWOOT_WHATSAPP_INBOX_ID || 0);
const CHATWOOT_TOKEN = process.env.CHATWOOT_API_ACCESS_TOKEN || "";
const TEMPLATE_NAME = process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_NAME || "nuevo_pedido_v2";
const TEMPLATE_LANGUAGE = process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_LANGUAGE || "es";
const TEMPLATE_CATEGORY = process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_CATEGORY || "MARKETING";
const TEMPLATE_HEADER_IMAGE =
  process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_HEADER_IMAGE_URL || "";

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+57${digits}`;
  return `+${digits}`;
}

async function cw(path, init = {}) {
  const response = await fetch(`${CHATWOOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      api_access_token: CHATWOOT_TOKEN,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`Chatwoot ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function findContact(customerId, phone) {
  const identifier = `alento_customer_${customerId}`;
  for (const q of [identifier, normalizePhone(phone)]) {
    const result = await cw(
      `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/search?q=${encodeURIComponent(q)}`,
    );
    const contacts = result?.payload || [];
    const exact =
      contacts.find((item) => item.identifier === identifier) ||
      contacts.find(
        (item) => normalizePhone(item.phone_number) === normalizePhone(phone),
      );
    if (exact) return exact;
  }
  return null;
}

async function findConversation(contactId) {
  const result = await cw(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/${contactId}/conversations`,
  );
  return (result?.payload || [])
    .filter((item) => Number(item.inbox_id) === CHATWOOT_INBOX_ID)
    .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0))[0] || null;
}

async function sendOrderCreated(data) {
  const contact = await findContact(data.customerId, data.phone);
  if (!contact) throw new Error("No se encontró el cliente en Chatwoot.");

  const conversation = await findConversation(contact.id);
  if (!conversation) {
    throw new Error(
      "El cliente existe en Chatwoot pero aún no tiene conversación en la bandeja de WhatsApp.",
    );
  }

  const processedParams = {
    body: {
      "1": data.customerName,
      "2": data.orderCode,
    },
    buttons: [
      {
        type: "url",
        parameter: data.trackingPath,
      },
    ],
  };

  if (TEMPLATE_HEADER_IMAGE) {
    processedParams.header = {
      media_url: TEMPLATE_HEADER_IMAGE,
      media_type: "image",
    };
  }

  await cw(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversation.id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: `Pedido ${data.orderCode} recibido.`,
        message_type: "outgoing",
        private: false,
        template_params: {
          name: TEMPLATE_NAME,
          category: TEMPLATE_CATEGORY,
          language: TEMPLATE_LANGUAGE,
          processed_params: processedParams,
        },
      }),
    },
  );

  return { contactId: contact.id, conversationId: conversation.id };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true, service: "alento-notifier" });
  }

  if (req.method !== "POST" || req.url !== "/events") {
    return json(res, 404, { error: "Not found" });
  }

  if (!SHARED_SECRET || req.headers["x-alento-notifier-secret"] !== SHARED_SECRET) {
    return json(res, 401, { error: "Unauthorized" });
  }

  try {
    const payload = await readBody(req);
    if (payload?.event !== "order.created") {
      return json(res, 400, { error: "Unsupported event" });
    }

    const result = await sendOrderCreated(payload.data || {});
    return json(res, 200, { ok: true, result });
  } catch (error) {
    console.error("Notifier error", error);
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Alento notifier listening on :${PORT}`);
});
