import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { isChatwootInboxConfigured, listInboxConversations } from "@/lib/chatwootInbox";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
    if (!isChatwootInboxConfigured()) {
      return NextResponse.json({ error: "Falta configurar CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_WHATSAPP_INBOX_ID y CHATWOOT_API_ACCESS_TOKEN en el servidor." }, { status: 503 });
    }
    const rawStatus = request.nextUrl.searchParams.get("status") ?? "open";
    const status = rawStatus === "pending" || rawStatus === "resolved" ? rawStatus : "open";
    const conversations = await listInboxConversations(status);
    return NextResponse.json({ conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible consultar la bandeja.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 502;
    return NextResponse.json({ error: status === 502 ? message : "No tienes permiso para consultar los mensajes." }, { status });
  }
}
