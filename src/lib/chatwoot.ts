type ChatwootContact = {
  id: number;
  name?: string;
  identifier?: string | null;
  phone_number?: string | null;
};

type ChatwootConversation = {
  id: number;
  inbox_id: number;
  status?: string;
  updated_at?: number;
};

type OrderCreatedNotificationInput = {
  customerId: number;
  customerName: string;
  phone: string;
  orderCode: string;
  total: number;
  fulfillmentType: string;
};

export type ChatwootNotificationResult =
  | { ok: true; status: "sent"; conversationId: number; contactId: number }
  | { ok: false; status: "skipped" | "failed"; reason: string };

function requiredConfig() {
  const baseUrl = process.env.CHATWOOT_BASE_URL?.trim().replace(/\/$/, "");
  const accountId = Number(process.env.CHATWOOT_ACCOUNT_ID);
  const inboxId = Number(process.env.CHATWOOT_WHATSAPP_INBOX_ID);
  const token = process.env.CHATWOOT_API_ACCESS_TOKEN?.trim();

  if (!baseUrl || !Number.isInteger(accountId) || !Number.isInteger(inboxId) || !token) {
    return null;
  }

  return { baseUrl, accountId, inboxId, token };
}

function normalizePhone(countryOrPhone: string) {
  const digits = countryOrPhone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+57${digits}`;
  return `+${digits}`;
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

async function chatwootFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const config = requiredConfig();
  if (!config) throw new Error("Chatwoot no está configurado.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        api_access_token: config.token,
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      const detail =
        typeof body === "string"
          ? body
          : JSON.stringify(body ?? { status: response.status });
      throw new Error(`Chatwoot ${response.status}: ${detail}`);
    }

    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function findContact(
  customerId: number,
  phone: string,
): Promise<ChatwootContact | null> {
  const config = requiredConfig();
  if (!config) return null;

  const identifier = `alento_customer_${customerId}`;
  const queries = [identifier, normalizePhone(phone)].filter(Boolean);

  for (const query of queries) {
    const data = await chatwootFetch<{ payload?: ChatwootContact[] }>(
      `/api/v1/accounts/${config.accountId}/contacts/search?q=${encodeURIComponent(query)}`,
    );

    const contacts = data.payload ?? [];
    const exact =
      contacts.find((contact) => contact.identifier === identifier) ??
      contacts.find(
        (contact) =>
          normalizePhone(contact.phone_number ?? "") === normalizePhone(phone),
      );

    if (exact) return exact;
  }

  return null;
}

async function findWhatsappConversation(
  contactId: number,
): Promise<ChatwootConversation | null> {
  const config = requiredConfig();
  if (!config) return null;

  const data = await chatwootFetch<{ payload?: ChatwootConversation[] }>(
    `/api/v1/accounts/${config.accountId}/contacts/${contactId}/conversations`,
  );

  const conversations = (data.payload ?? [])
    .filter((conversation) => conversation.inbox_id === config.inboxId)
    .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));

  return conversations[0] ?? null;
}

function templateBodyParams(input: OrderCreatedNotificationInput) {
  const raw = process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_BODY_PARAMS?.trim();

  if (!raw) {
    return {
      "1": input.customerName,
      "2": input.orderCode,
      "3": money(input.total),
    };
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error(
      "CHATWOOT_ORDER_CREATED_TEMPLATE_BODY_PARAMS no contiene JSON válido.",
    );
  }

  const replacements: Record<string, string> = {
    "{{customer_name}}": input.customerName,
    "{{order_code}}": input.orderCode,
    "{{total}}": money(input.total),
    "{{fulfillment_type}}": input.fulfillmentType,
    "{{phone}}": normalizePhone(input.phone),
  };

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      Object.entries(replacements).reduce(
        (result, [token, replacement]) => result.split(token).join(replacement),
        String(value),
      ),
    ]),
  );
}

export async function notifyOrderCreated(
  input: OrderCreatedNotificationInput,
): Promise<ChatwootNotificationResult> {
  const config = requiredConfig();
  if (!config) {
    return {
      ok: false,
      status: "skipped",
      reason: "Integración Chatwoot no configurada.",
    };
  }

  const templateName =
    process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return {
      ok: false,
      status: "skipped",
      reason: "Falta CHATWOOT_ORDER_CREATED_TEMPLATE_NAME.",
    };
  }

  const language =
    process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_LANGUAGE?.trim() || "es";
  const category =
    process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_CATEGORY?.trim() || "UTILITY";

  try {
    const contact = await findContact(input.customerId, input.phone);
    if (!contact) {
      return {
        ok: false,
        status: "failed",
        reason: "No se encontró el cliente en Chatwoot.",
      };
    }

    const conversation = await findWhatsappConversation(contact.id);
    if (!conversation) {
      return {
        ok: false,
        status: "failed",
        reason:
          "El cliente existe en Chatwoot pero todavía no tiene conversación en la bandeja de WhatsApp.",
      };
    }

    const bodyParams = templateBodyParams(input);
    const transcript =
      process.env.CHATWOOT_ORDER_CREATED_TRANSCRIPT?.trim() ||
      `Pedido ${input.orderCode} recibido por ${money(input.total)}.`;

    await chatwootFetch(
      `/api/v1/accounts/${config.accountId}/conversations/${conversation.id}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: transcript,
          message_type: "outgoing",
          private: false,
          template_params: {
            name: templateName,
            category,
            language,
            processed_params: {
              body: bodyParams,
            },
          },
        }),
      },
    );

    return {
      ok: true,
      status: "sent",
      conversationId: conversation.id,
      contactId: contact.id,
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      reason:
        error instanceof Error
          ? error.message
          : "No fue posible enviar la notificación.",
    };
  }
}
