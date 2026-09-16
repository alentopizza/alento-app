"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CustomerAddress = {
  id: number;
  address: string;
  neighborhood: string | null;
  city: string | null;
  notes: string | null;
  isDefault: boolean;
};

type Customer = {
  id: number;
  name: string;
  countryCode: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  addresses: CustomerAddress[];
  _count: { orders: number };
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadCustomers() {
    setLoading(true);
    try {
      const response = await fetch("/api/customers?all=1", { cache: "no-store" });
      const data = await response.json();
      setCustomers(data.customers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.addresses?.[0]?.address]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value)),
    );
  }, [customers, query]);

  function openEdit(customer: Customer) {
    setEditing(customer);
    setName(customer.name);
    setCountryCode(customer.countryCode || "+57");
    setPhone(customer.phone || "");
    setAddress(customer.addresses?.[0]?.address || "");
    setEmail(customer.email || "");
    setNotes(customer.notes || "");
    setMessage("");
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/customers/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, countryCode, phone, address, email, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el cliente.");
      setEditing(null);
      await loadCustomers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible actualizar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    if (customer._count.orders > 0) return;
    if (!window.confirm(`¿Eliminar a ${customer.name}? Esta acción no se puede deshacer.`)) return;

    const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error || "No fue posible eliminar el cliente.");
      return;
    }
    await loadCustomers();
  }

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">Directorio</p>
            <h1 className="text-3xl font-black tracking-tight">Clientes</h1>
            <p className="mt-1 text-sm text-neutral-500">Consulta, edita y administra los datos de tus clientes.</p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-neutral-200">
            <span className="text-neutral-500">Total</span> <strong className="ml-2 text-lg">{customers.length}</strong>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-black focus:bg-white"
            placeholder="Buscar por nombre, teléfono, correo o dirección"
          />
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200">
          {loading ? (
            <p className="p-6 text-sm text-neutral-500">Cargando clientes...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">No hay clientes para mostrar.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {filtered.map((customer) => {
                const primaryAddress = customer.addresses?.[0]?.address;
                const canDelete = customer._count.orders === 0;
                return (
                  <article key={customer.id} className="grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold">{customer.name}</h2>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                          {customer._count.orders} {customer._count.orders === 1 ? "pedido" : "pedidos"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-600">{customer.countryCode} {customer.phone || "Sin teléfono"}</p>
                      {customer.email && <p className="text-sm text-neutral-500">{customer.email}</p>}
                    </div>

                    <div className="text-sm text-neutral-600">
                      <p className="font-medium text-neutral-800">{primaryAddress || "Sin dirección registrada"}</p>
                      {customer.notes && <p className="mt-1 line-clamp-2 text-neutral-500">{customer.notes}</p>}
                    </div>

                    <div className="flex gap-2 lg:justify-end">
                      <button onClick={() => openEdit(customer)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold hover:bg-neutral-50">Editar</button>
                      <button
                        onClick={() => deleteCustomer(customer)}
                        disabled={!canDelete}
                        title={canDelete ? "Eliminar cliente" : "No se puede eliminar porque tiene pedidos asociados"}
                        className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300 disabled:hover:bg-white"
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-neutral-500">Cliente #{editing.id}</p>
                <h2 className="text-2xl font-black">Editar cliente</h2>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm">Cerrar</button>
            </div>

            <form onSubmit={saveCustomer} className="space-y-4">
              <label className="block space-y-1.5"><span className="text-sm font-semibold">Nombre *</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-black" /></label>
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <label className="block space-y-1.5"><span className="text-sm font-semibold">Indicativo</span><select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-3 py-3"><option>+57</option><option>+1</option><option>+34</option><option>+52</option><option>+51</option><option>+593</option></select></label>
                <label className="block space-y-1.5"><span className="text-sm font-semibold">Teléfono *</span><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-black" /></label>
              </div>
              <label className="block space-y-1.5"><span className="text-sm font-semibold">Dirección</span><input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-black" placeholder="Opcional" /></label>
              <label className="block space-y-1.5"><span className="text-sm font-semibold">Correo</span><input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-black" placeholder="Opcional" /></label>
              <label className="block space-y-1.5"><span className="text-sm font-semibold">Notas</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-black" /></label>

              {message && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 font-semibold">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar cambios"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
