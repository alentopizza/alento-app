"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Search, Send, RefreshCw, CheckCheck, Clock3, Inbox, AlertCircle } from "lucide-react";

type Conversation = {
  id: number; status: string; unreadCount: number; updatedAt: number;
  lastActivityAt: number; contactName: string; phoneNumber: string; lastMessage: string;
};
type Message = {
  id: number; content: string; messageType: string; createdAt: number;
  senderName: string; private: boolean;
  attachments: Array<{ id: number; fileType?: string; dataUrl?: string; fileName?: string }>;
};
type Status = "open" | "pending" | "resolved";

function timeLabel(value: number) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(value * 1000));
}
function dateLabel(value: number) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(value * 1000));
}

export default function MessagesPage() {
  const [status, setStatus] = useState<Status>("open");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingList(true);
    try {
      const response = await fetch(`/api/chatwoot/inbox?status=${status}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No fue posible cargar las conversaciones.");
      const items = Array.isArray(body.conversations) ? body.conversations as Conversation[] : [];
      setConversations(items);
      setError("");
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible conectar con Chatwoot.");
    } finally {
      if (!quiet) setLoadingList(false);
    }
  }, [status]);

  const loadMessages = useCallback(async (id: number, quiet = false) => {
    if (!quiet) setLoadingMessages(true);
    try {
      const response = await fetch(`/api/chatwoot/inbox/${id}/messages`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No fue posible cargar el chat.");
      setMessages(Array.isArray(body.messages) ? body.messages as Message[] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar los mensajes.");
    } finally {
      if (!quiet) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    void loadMessages(selectedId);
    const timer = window.setInterval(() => void loadMessages(selectedId, true), 6000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadMessages]);
  useEffect(() => {
    const timer = window.setInterval(() => void loadConversations(true), 12000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, selectedId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    if (!needle) return conversations;
    return conversations.filter((item) => [item.contactName, item.phoneNumber, item.lastMessage].some((value) => value.toLocaleLowerCase("es").includes(needle)));
  }, [conversations, query]);
  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/chatwoot/inbox/${selectedId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No fue posible enviar el mensaje.");
      setDraft("");
      await Promise.all([loadMessages(selectedId, true), loadConversations(true)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar el mensaje.");
    } finally { setSending(false); }
  }

  return (
    <main className="min-h-[calc(100vh-24px)] p-3 md:p-5">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[1600px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#101113] shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#171719] to-[#2a1012] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#20c96b]/15 text-[#27d977]"><MessageCircle size={22}/></span>
            <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#f06b70]">Atención al cliente</p><h1 className="text-xl font-black">Mensajes</h1><p className="text-xs text-white/50">WhatsApp conectado mediante Chatwoot</p></div>
          </div>
          <button type="button" onClick={() => { void loadConversations(); if (selectedId) void loadMessages(selectedId); }} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10"><RefreshCw size={14}/> Actualizar</button>
        </header>
        {error ? <div className="flex items-center gap-2 border-b border-red-400/20 bg-red-950/40 px-5 py-3 text-sm text-red-200"><AlertCircle size={16}/>{error}</div> : null}
        <div className="grid min-h-[620px] flex-1 grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex min-h-[360px] flex-col border-b border-white/10 bg-[#151619] md:border-b-0 md:border-r">
            <div className="border-b border-white/10 p-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conversación" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#20c96b]/60"/></div>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-black/25 p-1">
                {(["open","pending","resolved"] as Status[]).map((value) => <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded-lg px-2 py-2 text-[11px] font-bold capitalize transition ${status === value ? "bg-[#20c96b] text-[#062513]" : "text-white/50 hover:text-white"}`}>{value === "open" ? "Abiertos" : value === "pending" ? "Pendientes" : "Resueltos"}</button>)}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingList ? <p className="p-6 text-center text-sm text-white/40">Cargando conversaciones…</p> : filtered.length ? filtered.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`flex w-full gap-3 border-b border-white/[0.06] px-4 py-4 text-left transition hover:bg-white/[0.04] ${selectedId === item.id ? "bg-[#20c96b]/10" : ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b3b3f] to-[#222327] text-sm font-black text-white/80">{(item.contactName || "C").trim().slice(0,1).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-white">{item.contactName}</strong><small className="shrink-0 text-[10px] text-white/35">{timeLabel(item.lastActivityAt || item.updatedAt)}</small></span><span className="mt-1 block truncate text-xs text-white/45">{item.lastMessage}</span><span className="mt-1 block truncate text-[10px] text-white/25">{item.phoneNumber}</span></span>
                {item.unreadCount > 0 ? <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#20c96b] px-1 text-[10px] font-black text-black">{item.unreadCount}</span> : null}
              </button>) : <div className="p-8 text-center text-white/35"><Inbox className="mx-auto mb-3" size={26}/><p className="text-sm">No hay conversaciones en esta bandeja.</p></div>}
            </div>
          </aside>
          <section className="flex min-h-[520px] flex-col bg-[#0f1012]">
            {selected ? <>
              <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0"><h2 className="truncate text-sm font-black text-white">{selected.contactName}</h2><p className="mt-1 truncate text-xs text-white/40">{selected.phoneNumber || "Conversación de WhatsApp"}</p></div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#20c96b]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4fe08c]"><span className="h-1.5 w-1.5 rounded-full bg-current"/>{status === "open" ? "Abierta" : status === "pending" ? "Pendiente" : "Resuelta"}</span>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-6">
                {loadingMessages && !messages.length ? <p className="py-8 text-center text-sm text-white/35">Cargando mensajes…</p> : null}
                {messages.map((message) => {
                  const outgoing = message.messageType === "outgoing";
                  return <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                    <article className={`max-w-[min(82%,620px)] rounded-2xl px-4 py-3 shadow-lg ${outgoing ? "rounded-br-md bg-[#075e50] text-white" : "rounded-bl-md border border-white/10 bg-[#202226] text-white/90"}`}>
                      {message.private ? <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-amber-300">Nota privada</p> : null}
                      {message.content ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p> : null}
                      {message.attachments.map((file) => <p key={file.id} className="mt-2 text-xs underline">{file.fileName || "Archivo adjunto"}</p>)}
                      <p className={`mt-2 flex items-center justify-end gap-1 text-[9px] ${outgoing ? "text-white/50" : "text-white/30"}`}>{message.senderName ? `${message.senderName} · ` : ""}{dateLabel(message.createdAt)}{outgoing ? <CheckCheck size={11}/> : null}</p>
                    </article>
                  </div>;
                })}
                <div ref={bottomRef}/>
              </div>
              <form onSubmit={sendMessage} className="border-t border-white/10 bg-[#17181b] p-4">
                <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/25 p-2 focus-within:border-[#20c96b]/50">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(e as unknown as FormEvent); } }} rows={2} placeholder="Escribe un mensaje…" className="max-h-36 min-h-[48px] flex-1 resize-y bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/30"/>
                  <button type="submit" disabled={!draft.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#20c96b] text-[#062513] transition hover:bg-[#3de783] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar mensaje">{sending ? <Clock3 size={18}/> : <Send size={18}/>}</button>
                </div>
                <p className="mt-2 px-2 text-[10px] text-white/25">Los mensajes se envían por el canal de WhatsApp configurado en Chatwoot.</p>
              </form>
            </> : <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-white/35"><MessageCircle size={42} className="mb-4 text-[#20c96b]/50"/><h2 className="text-lg font-bold text-white/70">Tus conversaciones, dentro de Alentó</h2><p className="mt-2 max-w-sm text-sm">Selecciona una conversación para ver el historial y responder sin abrir otra ventana.</p></div>}
          </section>
        </div>
      </section>
    </main>
  );
}
