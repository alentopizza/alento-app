import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const SHARED_SECRET = process.env.NOTIFIER_SHARED_SECRET || "";
const CHATWOOT_BASE_URL = (process.env.CHATWOOT_BASE_URL || "").replace(/\/$/, "");
const CHATWOOT_ACCOUNT_ID = Number(process.env.CHATWOOT_ACCOUNT_ID || 0);
const CHATWOOT_INBOX_ID = Number(process.env.CHATWOOT_WHATSAPP_INBOX_ID || 0);
const CHATWOOT_TOKEN = process.env.CHATWOOT_API_ACCESS_TOKEN || "";
const ALENTO_APP_BASE_URL = (process.env.ALENTO_APP_BASE_URL || "").replace(/\/$/, "");

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

function sourceIdForPhone(value) {
  return normalizePhone(value).replace(/\D/g, "");
}

function absoluteMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) return raw;

  if (raw.startsWith("/")) {
    if (!ALENTO_APP_BASE_URL) {
      throw new Error(
        "La plantilla usa una imagen administrada por Alentó, pero falta ALENTO_APP_BASE_URL en el notifier.",
      );
    }
    return `${ALENTO_APP_BASE_URL}${raw}`;
  }

  throw new Error(
    `URL de imagen inválida para plantilla: ${raw}. Debe ser una URL http/https o una ruta interna de Alentó.`,
  );
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

function contactFromResponse(result) {
  return result?.payload?.contact || result?.payload || result?.contact || result || null;
}

async function findContact(data) {
  const identifier = data.recipientKind === "DRIVER"
    ? `alento_driver_${data.recipientId}`
    : `alento_customer_${data.recipientId}`;

  for (const q of [identifier, normalizePhone(data.phone)]) {
    if (!q) continue;
    const result = await cw(
      `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/search?q=${encodeURIComponent(q)}`,
    );
    const contacts = result?.payload || [];
    const exact =
      contacts.find((item) => item.identifier === identifier) ||
      contacts.find((item) => normalizePhone(item.phone_number) === normalizePhone(data.phone));
    if (exact) return exact;
  }
  return null;
}

async function createContact(data) {
  const identifier = data.recipientKind === "DRIVER"
    ? `alento_driver_${data.recipientId}`
    : `alento_customer_${data.recipientId}`;

  const result = await cw(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts`,
    {
      method: "POST",
      body: JSON.stringify({
        inbox_id: CHATWOOT_INBOX_ID,
        name: data.recipientName || data.customerName || data.driverName || "Alentó",
        phone_number: normalizePhone(data.phone),
        identifier,
      }),
    },
  );

  return contactFromResponse(result);
}

async function findConversation(contactId) {
  const result = await cw(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/${contactId}/conversations`,
  );
  return (result?.payload || [])
    .filter((item) => Number(item.inbox_id) === CHATWOOT_INBOX_ID)
    .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0))[0] || null;
}

async function createConversation(contactId, phone) {
  const result = await cw(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations`,
    {
      method: "POST",
      body: JSON.stringify({
        source_id: sourceIdForPhone(phone),
        inbox_id: CHATWOOT_INBOX_ID,
        contact_id: contactId,
        status: "open",
      }),
    },
  );
  return result?.id ? result : result?.payload || result;
}

function processedParamsFor(data) {
  const template = data.template || {};
  const body = {};
  for (const variable of template.variables || []) {
    const value = data?.[variable.source];
    body[String(variable.key)] = value == null ? "" : String(value);
  }

  const processed = {};
  if (Object.keys(body).length) processed.body = body;

  if (template.headerImageUrl) {
    processed.header = {
      media_url: absoluteMediaUrl(template.headerImageUrl),
      media_type: "image",
    };
  }

  if (template.button?.type === "tracking" && data.trackingPath) {
    processed.buttons = [{ type: "url", parameter: data.trackingPath }];
  } else if (template.button?.type === "driver_tracking" && data.driverTrackingPath) {
    processed.buttons = [{ type: "url", parameter: data.driverTrackingPath }];
  } else if (template.button?.type === "static" && template.button?.value) {
    processed.buttons = [{ type: "url", parameter: template.button.value }];
  }

  return processed;
}

async function sendTemplate(data) {
  if (!data?.template?.templateName) throw new Error("Evento sin plantilla configurada.");
  if (!data?.recipientId || !data?.phone) throw new Error("Evento sin destinatario válido.");

  let contact = await findContact(data);
  if (!contact) {
    try {
      contact = await createContact(data);
    } catch (error) {
      contact = await findContact(data);
      if (!contact) throw error;
    }
  }

  if (!contact?.id) throw new Error("No se pudo resolver el contacto en Chatwoot.");

  let conversation = await findConversation(contact.id);
  if (!conversation) {
    conversation = await createConversation(contact.id, data.phone);
  }

  if (!conversation?.id) {
    throw new Error("No se pudo crear o encontrar la conversación de WhatsApp.");
  }

  await cw(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversation.id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        // Chatwoot muestra este contenido como transcripción interna de la conversación.
        // El envío real a WhatsApp sigue siendo la plantilla indicada en template_params.
        content: `${data.template.title || "Notificación Alentó"} · ${data.orderCode || ""}`.trim(),
        message_type: "outgoing",
        content_type: "text",
        private: false,
        template_params: {
          name: data.template.templateName,
          category: data.template.category || "MARKETING",
          language: data.template.language || "es",
          content_mode: "rendered",
          processed_params: processedParamsFor(data),
        },
      }),
    },
  );

  return { contactId: contact.id, conversationId: conversation.id, template: data.template.templateName };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

let polling = false;
async function runScheduledJobs() {
  if (!ALENTO_APP_BASE_URL || !SHARED_SECRET || polling) return;
  polling = true;
  try {
    const response = await fetch(`${ALENTO_APP_BASE_URL}/api/internal/notification-jobs/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-alento-notifier-secret": SHARED_SECRET,
      },
      body: "{}",
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("Scheduled notification poll failed", response.status, text);
    }
  } catch (error) {
    console.error("Scheduled notification poll error", error);
  } finally {
    polling = false;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, {
      ok: true,
      service: "alento-notifier",
      scheduledJobs: Boolean(ALENTO_APP_BASE_URL),
    });
  }

  if (req.method !== "POST" || req.url !== "/events") {
    return json(res, 404, { error: "Not found" });
  }

  if (!SHARED_SECRET || req.headers["x-alento-notifier-secret"] !== SHARED_SECRET) {
    return json(res, 401, { error: "Unauthorized" });
  }

  try {
    const payload = await readBody(req);
    if (!payload?.event || !payload?.data?.template) {
      return json(res, 400, { error: "Unsupported event" });
    }

    const result = await sendTemplate(payload.data);
    return json(res, 200, { ok: true, event: payload.event, result });
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
  if (ALENTO_APP_BASE_URL) {
    console.log("Scheduled notification polling enabled");
    setTimeout(() => void runScheduledJobs(), 15_000);
    setInterval(() => void runScheduledJobs(), 60_000);
  }
});
