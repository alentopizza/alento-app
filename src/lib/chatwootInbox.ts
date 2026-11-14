type ChatwootConfig = {
  baseUrl: string;
  accountId: number;
  inboxId: number;
  token: string;
};

export type InboxConversation = {
  id: number;
  status: string;
  unreadCount: number;
  updatedAt: number;
  lastActivityAt: number;
  contactName: string;
  phoneNumber: string;
  lastMessage: string;
};

export type InboxMessage = {
  id: number;
  content: string;
  messageType: string;
  createdAt: number;
  senderName: string;
  private: boolean;
  attachments: Array<{ id: number; fileType?: string; dataUrl?: string; fileName?: string }>;
};

function config(): ChatwootConfig | null {
  const baseUrl = process.env.CHATWOOT_BASE_URL?.trim().replace(/\/$/, "");
  const accountId = Number(process.env.CHATWOOT_ACCOUNT_ID);
  const inboxId = Number(process.env.CHATWOOT_WHATSAPP_INBOX_ID);
  const token = process.env.CHATWOOT_API_ACCESS_TOKEN?.trim();
  if (!baseUrl || !Number.isInteger(accountId) || accountId < 1 || !Number.isInteger(inboxId) || inboxId < 1 || !token) return null;
  return { baseUrl, accountId, inboxId, token };
}

export function isChatwootInboxConfigured() {
  return Boolean(config());
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const settings = config();
  if (!settings) throw new Error("Falta configurar la conexión de Chatwoot para la bandeja de WhatsApp.");
  const response = await fetch(`${settings.baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      api_access_token: settings.token,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!response.ok) {
    const detail = typeof body === "string" ? body : body?.message ?? body?.error ?? `HTTP ${response.status}`;
    throw new Error(`Chatwoot: ${detail}`);
  }
  return body as T;
}

function payloadArray(body: any): any[] {
  if (Array.isArray(body?.data?.payload)) return body.data.payload;
  if (Array.isArray(body?.payload)) return body.payload;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function textFromMessage(message: any): string {
  if (typeof message?.content === "string" && message.content.trim()) return message.content;
  if (Array.isArray(message?.attachments) && message.attachments.length) return "Adjunto";
  return "Sin mensajes";
}

export async function listInboxConversations(status: "open" | "pending" | "resolved" = "open"): Promise<InboxConversation[]> {
  const settings = config();
  if (!settings) throw new Error("Falta configurar la conexión de Chatwoot para la bandeja de WhatsApp.");
  const query = new URLSearchParams({ inbox_id: String(settings.inboxId), status, page: "1" });
  const body = await request<any>(`/api/v1/accounts/${settings.accountId}/conversations?${query.toString()}`);
  return payloadArray(body).map((item: any) => {
    const messages = Array.isArray(item.messages) ? item.messages : [];
    const last = messages[messages.length - 1] ?? {};
    const sender = item.meta?.sender ?? item.contact ?? {};
    return {
      id: Number(item.id),
      status: String(item.status ?? status),
      unreadCount: Number(item.unread_count ?? 0),
      updatedAt: Number(item.updated_at ?? item.timestamp ?? 0),
      lastActivityAt: Number(item.last_activity_at ?? item.timestamp ?? 0),
      contactName: String(sender.name ?? item.meta?.assignee?.name ?? "Cliente"),
      phoneNumber: String(sender.phone_number ?? ""),
      lastMessage: textFromMessage(last),
    };
  }).filter((item: InboxConversation) => Number.isInteger(item.id) && item.id > 0);
}

export async function assertInboxConversation(conversationId: number) {
  const settings = config();
  if (!settings) throw new Error("Falta configurar la conexión de Chatwoot para la bandeja de WhatsApp.");
  const body = await request<any>(`/api/v1/accounts/${settings.accountId}/conversations/${conversationId}`);
  const conversation = body?.id ? body : body?.data;
  if (Number(conversation?.inbox_id) !== settings.inboxId) throw new Error("La conversación no pertenece a la bandeja de WhatsApp de Alentó.");
}

export async function getInboxMessages(conversationId: number): Promise<InboxMessage[]> {
  const settings = config();
  if (!settings) throw new Error("Falta configurar la conexión de Chatwoot para la bandeja de WhatsApp.");
  const body = await request<any>(`/api/v1/accounts/${settings.accountId}/conversations/${conversationId}/messages`);
  return payloadArray(body).map((item: any) => ({
    id: Number(item.id),
    content: String(item.content ?? ""),
    messageType: String(item.message_type ?? ""),
    createdAt: Number(item.created_at ?? 0),
    senderName: String(item.sender?.name ?? ""),
    private: Boolean(item.private),
    attachments: Array.isArray(item.attachments) ? item.attachments.map((file: any) => ({
      id: Number(file.id), fileType: file.file_type, dataUrl: file.data_url, fileName: file.file_name,
    })) : [],
  })).filter((item: InboxMessage) => Number.isInteger(item.id));
}

export async function sendInboxMessage(conversationId: number, content: string) {
  const settings = config();
  if (!settings) throw new Error("Falta configurar la conexión de Chatwoot para la bandeja de WhatsApp.");
  return request<any>(`/api/v1/accounts/${settings.accountId}/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, message_type: "outgoing", private: false }),
  });
}
