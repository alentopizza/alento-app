import { createOrderTrackingToken } from "@/lib/orderTracking";

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
  orderId: number;
  orderCode: string;
  total: number;
  fulfillmentType: string;
};

type OrderCreatedNotificationOptions = {
  templateName?: string;
  requirePhoneMatch?: boolean;
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
  requirePhoneMatch = false,
): Promise<ChatwootContact | null> {
  const config = requiredConfig();
  if (!config) return null;

  const identifier = `alento_customer_${customerId}`;
  const normalizedPhone = normalizePhone(phone);
  const queries = requirePhoneMatch
    ? [normalizedPhone].filter(Boolean)
    : [identifier, normalizedPhone].filter(Boolean);

  for (const query of queries) {
    const data = await chatwootFetch<{ payload?: ChatwootContact[] }>(
      `/api/v1/accounts/${config.accountId}/contacts/search?q=${encodeURIComponent(query)}`,
    );

    const contacts = data.payload ?? [];
    const phoneMatch = contacts.find(
      (contact) =>
        normalizePhone(contact.phone_number ?? "") === normalizedPhone,
    );

    if (phoneMatch) return phoneMatch;

    if (!requirePhoneMatch) {
      const identifierMatch = contacts.find(
        (contact) => contact.identifier === identifier,
      );
      if (identifierMatch) return identifierMatch;
    }
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

function templateReplacements(input: OrderCreatedNotificationInput) {
  return {
    "__CUSTOMER_NAME__": input.customerName,
    "__ORDER_ID__": String(input.orderId),
    "__ORDER_CODE__": input.orderCode,
    "__TOTAL__": money(input.total),
    "__FULFILLMENT_TYPE__": input.fulfillmentType,
    "__PHONE__": normalizePhone(input.phone),
    "__TRACKING_PATH__": `seguimiento/${createOrderTrackingToken(input.orderId)}`,
    "{{customer_name}}": input.customerName,
    "{{order_id}}": String(input.orderId),
    "{{order_code}}": input.orderCode,
    "{{total}}": money(input.total),
    "{{fulfillment_type}}": input.fulfillmentType,
    "{{phone}}": normalizePhone(input.phone),
    "{{tracking_path}}": `seguimiento/${createOrderTrackingToken(input.orderId)}`,
  };
}

function renderTemplateValue(value: string, input: OrderCreatedNotificationInput) {
  return Object.entries(templateReplacements(input)).reduce(
    (result, [token, replacement]) => result.split(token).join(replacement),
    value,
  );
}

function templateBodyParams(input: OrderCreatedNotificationInput) {
  const raw = process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_BODY_PARAMS?.trim();

  if (!raw) {
    return {
      "1": input.customerName,
      "2": input.orderCode,
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

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      renderTemplateValue(String(value), input),
    ]),
  );
}

export async function notifyOrderCreated(
  input: OrderCreatedNotificationInput,
  options: OrderCreatedNotificationOptions = {},
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
    options.templateName?.trim() ||
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
    const contact = await findContact(
      input.customerId,
      input.phone,
      options.requirePhoneMatch === true,
    );
    if (!contact) {
      return {
        ok: false,
        status: "failed",
        reason:
          options.requirePhoneMatch === true
            ? `No se encontró en Chatwoot un contacto con el teléfono actual ${normalizePhone(input.phone)}.`
            : "No se encontró el cliente en Chatwoot.",
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
    const headerImageUrl =
      process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_HEADER_IMAGE_URL?.trim();
    const buttonParamTemplate =
      process.env.CHATWOOT_ORDER_CREATED_TEMPLATE_BUTTON_PARAM?.trim() ||
      "__TRACKING_PATH__";
    const buttonParameter = renderTemplateValue(buttonParamTemplate, input);

    const processedParams: {
      body: Record<string, string>;
      header?: { media_url: string; media_type: "image" };
      buttons?: Array<{ type: "url"; parameter: string }>;
    } = {
      body: bodyParams,
    };

    if (headerImageUrl) {
      processedParams.header = {
        media_url: headerImageUrl,
        media_type: "image",
      };
    }

    if (buttonParameter) {
      processedParams.buttons = [
        {
          type: "url",
          parameter: buttonParameter,
        },
      ];
    }

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
            processed_params: processedParams,
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
