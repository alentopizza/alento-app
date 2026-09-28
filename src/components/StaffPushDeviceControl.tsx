"use client";

import { BellRing, CheckCircle2, RefreshCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  disableWebPush,
  enableWebPush,
  loadWebPushState,
  type WebPushCapability,
} from "@/lib/webPushClient";

const ENDPOINT = "/api/staff/push";

type StaffPushUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

function roleLabel(role: string) {
  if (role === "ADMIN") return "Administración";
  if (role === "KITCHEN") return "Cocina";
  if (role === "DRIVER" || role === "DISPATCH") return "Repartidor";
  if (role === "POS" || role === "CASHIER") return "POS / Caja";
  return role;
}

export default function StaffPushDeviceControl({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [state, setState] =
    useState<WebPushCapability>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [user, setUser] = useState<StaffPushUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setState("loading");
    setMessage("");

    try {
      const [pushState, response] = await Promise.all([
        loadWebPushState(ENDPOINT),
        fetch(ENDPOINT, { cache: "no-store" }),
      ]);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "No fue posible consultar este dispositivo.",
        );
      }

      setPublicKey(pushState.publicKey);
      setState(pushState.state);
      setUser((body.user ?? null) as StaffPushUser | null);
    } catch (error) {
      setState("off");
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible consultar este dispositivo.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function enable() {
    if (busy || !publicKey) return;

    setBusy(true);
    setMessage("");

    try {
      const result = await enableWebPush(ENDPOINT, publicKey);

      if (!result.enabled) {
        setState(result.denied ? "denied" : "off");
        setMessage(
          result.denied
            ? "Las notificaciones están bloqueadas para esta PWA."
            : "No fue posible activar Push en este dispositivo.",
        );
        return;
      }

      setState("on");
      setMessage("Este dispositivo quedó registrado para recibir Push.");
      onChanged?.();
    } catch (error) {
      setState("off");
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible registrar este dispositivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      await disableWebPush(ENDPOINT);
      setState("off");
      setMessage("Push desactivado en este dispositivo.");
      onChanged?.();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible desactivar este dispositivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const active = state === "on";

  return (
    <section className="rounded-[26px] border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " +
              (active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-neutral-100 text-neutral-500")
            }
          >
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[.12em] text-neutral-400">
              Este dispositivo
            </p>
            <b className="mt-1 block text-[12px] text-neutral-950">
              {state === "loading"
                ? "Comprobando Push..."
                : active
                  ? "PWA registrada"
                  : state === "denied"
                    ? "Notificaciones bloqueadas"
                    : state === "unsupported"
                      ? "Web Push no disponible"
                      : state === "unconfigured"
                        ? "Servidor sin configurar"
                        : "PWA sin registrar"}
            </b>
            {user && (
              <p className="mt-1 text-[9px] leading-4 text-neutral-500">
                {user.name} ·{" "}
                {user.roles.map(roleLabel).join(", ") || "Sin rol"}
              </p>
            )}
          </div>
        </div>

        <span
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
            (state === "loading" || busy
              ? "bg-amber-100 text-amber-700"
              : active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-neutral-100 text-neutral-400")
          }
        >
          {state === "loading" || busy ? (
            <RefreshCcw className="h-4 w-4 animate-spin" />
          ) : active ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </span>
      </div>

      {message && (
        <p className="mt-3 rounded-xl bg-[#faf9f7] px-3 py-2 text-[9px] leading-4 text-neutral-600">
          {message}
        </p>
      )}

      {state === "denied" && (
        <p className="mt-3 text-[9px] leading-4 text-red-600">
          Habilita las notificaciones de Alentó desde los ajustes del navegador
          o del sistema y vuelve a abrir la PWA.
        </p>
      )}

      {state === "unsupported" && (
        <p className="mt-3 text-[9px] leading-4 text-neutral-500">
          En iPhone/iPad abre Alentó desde la aplicación añadida a la pantalla
          de inicio. Web Push no funciona desde una pestaña normal de Safari.
        </p>
      )}

      {(state === "off" || state === "on") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void (active ? disable() : enable())}
          className={
            "mt-3 h-10 w-full rounded-xl text-[10px] font-black transition disabled:opacity-50 " +
            (active
              ? "border border-neutral-200 bg-white text-neutral-600"
              : "bg-neutral-950 text-white")
          }
        >
          {busy
            ? "Procesando..."
            : active
              ? "Desactivar en este dispositivo"
              : "Activar este dispositivo"}
        </button>
      )}
    </section>
  );
}
