import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { assertInboxConversation, getInboxMessages, sendInboxMessage } from "@/lib/chatwootInbox";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ conversationId: string }> };

async function conversationIdFrom(context: Context) {
  const params = await context.params;
  const id = Number(params.conversationId);
  if (!Number.isInteger(id) || id < 1) throw new Error("Conversación inválida.");
  return id;
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
    const id = await conversationIdFrom(context);
    await assertInboxConversation(id);
    return NextResponse.json({ messages: await getInboxMessages(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible cargar los mensajes.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 502;
    return NextResponse.json({ error: status === 502 ? message : "No tienes permiso para consultar los mensajes." }, { status });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
    const id = await conversationIdFrom(context);
    await assertInboxConversation(id);
    const body = await request.json().catch(() => null) as { content?: unknown } | null;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ error: "Escribe un mensaje antes de enviarlo." }, { status: 400 });
    if (content.length > 4000) return NextResponse.json({ error: "El mensaje supera el límite de 4.000 caracteres." }, { status: 400 });
    await sendInboxMessage(id, content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible enviar el mensaje.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 502;
    return NextResponse.json({ error: status === 502 ? message : "No tienes permiso para enviar mensajes." }, { status });
  }
}
