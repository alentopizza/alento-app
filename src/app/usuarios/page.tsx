"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "ADMIN" | "POS" | "KITCHEN" | "CASHIER" | "DRIVER";
type Permission = "CANCEL_ORDERS" | "DELETE_ORDERS";

type StaffUser = {
  id: number;
  name: string;
  email: string;
  whatsappCountryCode: string;
  whatsappPhone: string | null;
  roles: Role[];
  permissions: Permission[];
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLE_OPTIONS: Array<{ id: Role; label: string; description: string }> = [
  { id: "ADMIN", label: "Administrador", description: "Acceso total, usuarios, menú y configuración." },
  { id: "POS", label: "Punto de venta", description: "POS, pedidos y clientes." },
  { id: "KITCHEN", label: "Cocina", description: "Acceso al panel de preparación." },
  { id: "CASHIER", label: "Caja", description: "Caja, pagos y consulta operativa." },
  { id: "DRIVER", label: "Repartidor", description: "Domicilios asignados, entrega y seguimiento del pedido." },
];

const PERMISSION_OPTIONS: Array<{ id: Permission; label: string; description: string; tone: string }> = [
  {
    id: "CANCEL_ORDERS",
    label: "Cancelar pedidos",
    description: "Permite sacar un pedido de la operación conservando su trazabilidad.",
    tone: "amber",
  },
  {
    id: "DELETE_ORDERS",
    label: "Eliminar pedidos cancelados",
    description: "Permite borrar definitivamente un pedido después de cancelarlo.",
    tone: "red",
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ id?: number; name: string; email: string; password: string; whatsappCountryCode: string; whatsappPhone: string; roles: Role[]; permissions: Permission[]; active: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible cargar los usuarios.");
      setUsers(result.users ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  const activeCount = useMemo(() => users.filter((user) => user.active).length, [users]);

  function toggleRole(role: Role) {
    if (!editor) return;

    const nextRoles = editor.roles.includes(role)
      ? editor.roles.filter((item) => item !== role)
      : [...editor.roles, role];

    const canManageSensitiveOrders =
      nextRoles.includes("ADMIN") ||
      nextRoles.includes("POS") ||
      nextRoles.includes("CASHIER");

    setEditor({
      ...editor,
      roles: nextRoles,
      permissions: canManageSensitiveOrders ? editor.permissions : [],
    });
  }

  function togglePermission(permission: Permission) {
    if (!editor || editor.roles.includes("ADMIN")) return;
    setEditor({
      ...editor,
      permissions: editor.permissions.includes(permission)
        ? editor.permissions.filter((item) => item !== permission)
        : [...editor.permissions, permission],
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editor.id ? `/api/users/${editor.id}` : "/api/users", {
        method: editor.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editor),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el usuario.");
      setEditor(null);
      setNotice(editor.id ? "Usuario actualizado." : "Usuario creado.");
      await loadUsers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-4 lg:p-5">
      <div className="w-full space-y-4">
        <header className="alento-dark rounded-[28px] px-7 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/45">Administración</p>
              <h1 className="mt-0.5 text-3xl font-semibold tracking-[-0.03em]">Usuarios y Roles</h1>
              <p className="mt-1.5 text-[13px] leading-5 text-white/65">Crea colaboradores y controla a qué áreas internas pueden acceder.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-center">
                <span className="block text-[8px] font-semibold uppercase tracking-[0.14em] text-white/40">Activos</span>
                <b className="mt-0.5 block text-[26px] font-semibold leading-none text-white">{activeCount}</b>
              </div>
              <button onClick={() => setEditor({ name: "", email: "", password: "", whatsappCountryCode: "+57", whatsappPhone: "", roles: ["POS"], permissions: [], active: true })} className="h-[52px] rounded-2xl bg-[var(--brand-red)] px-5 text-[12px] font-semibold text-white">
                + Crear usuario
              </button>
            </div>
          </div>
        </header>

        {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] text-red-700">{error}</p>}
        {notice && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[11px] text-emerald-700">{notice}</p>}

        <section className="alento-card overflow-hidden rounded-[24px]">
          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1.8fr)_100px_80px] gap-3 border-b border-neutral-100 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            <span>Colaborador</span><span>Correo</span><span>WhatsApp</span><span>Roles</span><span>Último acceso</span><span></span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-neutral-400">Cargando usuarios...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-400">No hay usuarios registrados.</div>
          ) : users.map((user) => (
            <div key={user.id} className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1.8fr)_100px_80px] items-center gap-3 border-b border-neutral-100 px-5 py-4 last:border-b-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <b className="truncate text-[14px] font-semibold text-neutral-950">{user.name}</b>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>{user.active ? "ACTIVO" : "INACTIVO"}</span>
                </div>
              </div>
              <span className="truncate text-[12px] text-neutral-600">{user.email}</span>
              <span className="truncate text-[12px] text-neutral-600">{user.whatsappPhone ? `${user.whatsappCountryCode} ${user.whatsappPhone}` : "—"}</span>
              <div className="flex flex-wrap gap-1.5">
                {user.roles.map((role) => <span key={role} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[9px] font-semibold text-neutral-600">{ROLE_OPTIONS.find((item) => item.id === role)?.label ?? role}</span>)}
                {!user.roles.includes("ADMIN") && user.permissions?.includes("CANCEL_ORDERS") && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700">Cancela pedidos</span>
                )}
                {!user.roles.includes("ADMIN") && user.permissions?.includes("DELETE_ORDERS") && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[9px] font-semibold text-red-700">Elimina pedidos</span>
                )}
              </div>
              <span className="text-[10px] text-neutral-500">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("es-CO") : "Nunca"}</span>
              <button onClick={() => setEditor({ id: user.id, name: user.name, email: user.email, password: "", whatsappCountryCode: user.whatsappCountryCode || "+57", whatsappPhone: user.whatsappPhone || "", roles: user.roles, permissions: user.permissions ?? [], active: user.active })} className="rounded-xl border border-neutral-200 px-3 py-2 text-[11px] font-semibold">Editar</button>
            </div>
          ))}
        </section>
      </div>

      {editor && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
          <form onSubmit={save} className="w-full max-w-[860px] overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-[var(--brand-red)] bg-[linear-gradient(135deg,#09090a,#281516)] px-6 py-5 text-white">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45">{editor.id ? "Editar colaborador" : "Nuevo colaborador"}</p>
                <h2 className="mt-1 text-[24px] font-semibold">{editor.id ? editor.name : "Crear usuario"}</h2>
              </div>
              <button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-[11px] font-semibold">Cerrar</button>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-4">
                <label className="block"><span className="text-[12px] font-semibold text-neutral-700">Nombre</span><input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} className="alento-input mt-2 h-12 w-full rounded-xl px-4 text-sm" /></label>
                <label className="block"><span className="text-[12px] font-semibold text-neutral-700">Correo</span><input type="email" value={editor.email} onChange={(e) => setEditor({ ...editor, email: e.target.value })} className="alento-input mt-2 h-12 w-full rounded-xl px-4 text-sm" /></label>
                <label className="block"><span className="text-[12px] font-semibold text-neutral-700">{editor.id ? "Nueva contraseña · opcional" : "Contraseña"}</span><input type="password" value={editor.password} onChange={(e) => setEditor({ ...editor, password: e.target.value })} className="alento-input mt-2 h-12 w-full rounded-xl px-4 text-sm" placeholder="Mínimo 8 caracteres" /></label>
                <div>
                  <span className="text-[12px] font-semibold text-neutral-700">WhatsApp {editor.roles.includes("DRIVER") ? "· obligatorio para repartidor" : "· opcional"}</span>
                  <div className="mt-2 grid grid-cols-[100px_1fr] gap-2">
                    <input value={editor.whatsappCountryCode} onChange={(e) => setEditor({ ...editor, whatsappCountryCode: e.target.value })} className="alento-input h-12 w-full rounded-xl px-3 text-sm" placeholder="+57" />
                    <input inputMode="tel" value={editor.whatsappPhone} onChange={(e) => setEditor({ ...editor, whatsappPhone: e.target.value.replace(/\D/g, "") })} className="alento-input h-12 w-full rounded-xl px-4 text-sm" placeholder="3001234567" />
                  </div>
                  {editor.roles.includes("DRIVER") && <p className="mt-1.5 text-[10px] leading-4 text-neutral-500">Aquí recibirá la orden asignada y el enlace operativo del domicilio.</p>}
                </div>
                {editor.id && (
                  <label className="flex items-center justify-between rounded-xl border border-neutral-200 bg-[#faf9f7] px-4 py-3">
                    <span><b className="block text-[12px] font-semibold">Usuario activo</b><span className="text-[10px] text-neutral-500">Permite o bloquea el inicio de sesión.</span></span>
                    <input type="checkbox" checked={editor.active} onChange={(e) => setEditor({ ...editor, active: e.target.checked })} className="h-5 w-5" />
                  </label>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Roles</p>
                <div className="mt-3 space-y-2">
                  {ROLE_OPTIONS.map((role) => {
                    const selected = editor.roles.includes(role.id);
                    return (
                      <button type="button" key={role.id} onClick={() => toggleRole(role.id)} className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition ${selected ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-white"}`}>
                        <span><b className="block text-[12px] font-semibold text-neutral-900">{role.label}</b><span className="mt-0.5 block text-[10px] leading-4 text-neutral-500">{role.description}</span></span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${selected ? "bg-emerald-500 text-white" : "bg-neutral-100 text-neutral-400"}`}>{selected ? "✓" : ""}</span>
                      </button>
                    );
                  })}
                </div>

                {(editor.roles.includes("ADMIN") || editor.roles.includes("POS") || editor.roles.includes("CASHIER")) && (
                  <div className="mt-5 border-t border-neutral-100 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Permisos especiales</p>
                      <p className="mt-1 text-[10px] leading-4 text-neutral-500">Acciones sensibles que no se conceden automáticamente por el rol.</p>
                    </div>
                    {editor.roles.includes("ADMIN") && (
                      <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[9px] font-semibold text-white">Incluidos en Admin</span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {PERMISSION_OPTIONS.map((permission) => {
                      const inherited = editor.roles.includes("ADMIN");
                      const selected = inherited || editor.permissions.includes(permission.id);
                      const danger = permission.tone === "red";

                      return (
                        <button
                          type="button"
                          key={permission.id}
                          disabled={inherited}
                          onClick={() => togglePermission(permission.id)}
                          className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition disabled:cursor-default ${selected ? danger ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"}`}
                        >
                          <span>
                            <b className="block text-[12px] font-semibold text-neutral-900">{permission.label}</b>
                            <span className="mt-0.5 block text-[10px] leading-4 text-neutral-500">{permission.description}</span>
                          </span>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] ${selected ? danger ? "bg-red-500 text-white" : "bg-amber-500 text-white" : "bg-neutral-100 text-neutral-400"}`}>
                            {selected ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 bg-[#faf9f7] px-5 py-4">
              <button type="button" onClick={() => setEditor(null)} className="h-11 rounded-xl border border-neutral-200 bg-white px-5 text-[12px] font-semibold">Cancelar</button>
              <button disabled={saving} className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-[12px] font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar usuario"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
