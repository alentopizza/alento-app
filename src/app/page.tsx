"use client";

import { FormEvent, useState } from "react";

type CustomerAddress = {
  id: number;
  address: string;
  neighborhood: string | null;
  city: string | null;
  notes: string | null;
};

type Customer = {
  id: number;
  name: string;
  countryCode: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  addresses: CustomerAddress[];
};

const categories = ["Pizzas", "Bebidas", "Acompañantes"];

const products = [
  { name: "Hawaiana", description: "Jamón, piña y mozzarella", price: "Desde $—", accent: "Piña & jamón" },
  { name: "Fiesta Pepperoni", description: "Pepperoni y mozzarella", price: "Desde $—", accent: "Favorita" },
  { name: "Carnes", description: "Selección de carnes y mozzarella", price: "Desde $—", accent: "Clásica" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");

  async function searchCustomers() {
    const value = query.trim();
    if (value.length < 2) {
      setCustomers([]);
      setSearchMessage("Escribe al menos 2 caracteres para buscar.");
      return;
    }

    setSearching(true);
    setSearchMessage("");
    try {
      const response = await fetch(`/api/customers?q=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible buscar clientes.");
      setCustomers(data.customers ?? []);
      setSearchMessage((data.customers ?? []).length === 0 ? "No encontramos clientes con ese dato." : "");
    } catch (error) {
      setCustomers([]);
      setSearchMessage(error instanceof Error ? error.message : "No fue posible buscar clientes.");
    } finally {
      setSearching(false);
    }
  }

  function chooseCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setQuery(customer.phone || customer.name);
    setCustomers([]);
    setSearchMessage("");
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomerError("");

    if (!name.trim() || !phone.trim()) {
      setCustomerError("Nombre y teléfono son obligatorios.");
      return;
    }

    setSavingCustomer(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, countryCode, phone, address, notes, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible crear el cliente.");

      chooseCustomer(data.customer);
      setName("");
      setCountryCode("+57");
      setPhone("");
      setAddress("");
      setNotes("");
      setEmail("");
      setShowCreateCustomer(false);
    } catch (error) {
      setCustomerError(error instanceof Error ? error.message : "No fue posible crear el cliente.");
    } finally {
      setSavingCustomer(false);
    }
  }

  const selectedAddress = selectedCustomer?.addresses?.[0];

  return (
    <main className="min-h-screen p-4 sm:p-5 lg:p-7 xl:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="alento-dark overflow-hidden rounded-[32px] px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-red)] shadow-[0_0_16px_rgba(229,28,17,.9)]" />
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Operación Alentó</p>
              </div>
              <h1 className="text-3xl font-black tracking-[-0.04em] md:text-4xl">Punto de venta</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">Toma pedidos, consulta clientes y arma cada orden desde una sola pantalla.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-right backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Estado</p>
                <p className="mt-1 text-sm font-bold text-white">POS activo</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/70">MVP</span>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <div className="alento-card rounded-[28px] p-5 md:p-6">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Cliente</p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">{selectedCustomer ? selectedCustomer.name : "Nuevo pedido"}</h2>
                  {selectedCustomer ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                      <span>{selectedCustomer.countryCode} {selectedCustomer.phone || "Sin teléfono"}</span>
                      {selectedAddress?.address && <span>• {selectedAddress.address}</span>}
                      {selectedCustomer.notes && <span>• {selectedCustomer.notes}</span>}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">Busca un cliente existente o crea uno nuevo para comenzar.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedCustomer && (
                    <button
                      onClick={() => { setSelectedCustomer(null); setQuery(""); }}
                      className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                    >
                      Cambiar cliente
                    </button>
                  )}
                  <button
                    onClick={() => setShowCreateCustomer(true)}
                    className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-4 py-2.5 text-sm font-black text-white hover:bg-[var(--brand-red-dark)]"
                  >
                    + Nuevo cliente
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        searchCustomers();
                      }
                    }}
                    className="alento-input w-full rounded-2xl py-3.5 pl-10 pr-4"
                    placeholder="Nombre, teléfono o correo del cliente"
                  />
                </div>
                <button
                  onClick={searchCustomers}
                  disabled={searching}
                  className="rounded-2xl bg-[var(--brand-black)] px-5 py-3.5 text-sm font-black text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {searching ? "Buscando..." : "Buscar cliente"}
                </button>
              </div>

              {(customers.length > 0 || searchMessage) && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_14px_35px_rgba(20,20,20,.07)]">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => chooseCustomer(customer)}
                      className="flex w-full items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3.5 text-left last:border-b-0 hover:bg-[#faf9f7]"
                    >
                      <div>
                        <p className="font-black">{customer.name}</p>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">{customer.countryCode} {customer.phone || "Sin teléfono"}</p>
                        {customer.addresses?.[0]?.address && <p className="mt-0.5 text-xs text-neutral-400">{customer.addresses[0].address}</p>}
                      </div>
                      <span className="rounded-xl bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-600">Seleccionar</span>
                    </button>
                  ))}
                  {searchMessage && <p className="px-4 py-3 text-sm text-[var(--muted)]">{searchMessage}</p>}
                </div>
              )}
            </div>

            <div className="alento-scroll flex gap-2 overflow-x-auto pb-1">
              {categories.map((category, index) => (
                <button
                  key={category}
                  className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold ${
                    index === 0
                      ? "bg-[var(--brand-black)] text-white shadow-[0_10px_24px_rgba(0,0,0,.15)]"
                      : "border border-[var(--border)] bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {products.map((product, index) => (
                <article key={product.name} className="alento-card-soft group overflow-hidden rounded-[28px]">
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#111112]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(229,28,17,.25),transparent_35%)]" />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
                    <span className="absolute left-4 top-4 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/75 backdrop-blur">{product.accent}</span>
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-5xl shadow-[0_18px_50px_rgba(0,0,0,.25)] transition-transform duration-300 group-hover:scale-105">🍕</div>
                    <span className="absolute bottom-4 right-4 text-xs font-bold text-white/35">0{index + 1}</span>
                  </div>

                  <div className="p-5">
                    <h3 className="text-xl font-black tracking-[-0.025em]">{product.name}</h3>
                    <p className="mt-1.5 min-h-10 text-sm leading-5 text-[var(--muted)]">{product.description}</p>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Precio base</p>
                        <span className="mt-1 block text-lg font-black">{product.price}</span>
                      </div>
                      <button className="alento-red-glow rounded-2xl bg-[var(--brand-red)] px-4 py-2.5 text-sm font-black text-white hover:bg-[var(--brand-red-dark)]">Agregar</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="alento-card h-fit rounded-[30px] p-5 xl:sticky xl:top-7">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Pedido actual</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">Sin productos</h2>
                {selectedCustomer && <p className="mt-1 text-sm text-[var(--muted)]">Para {selectedCustomer.name}</p>}
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[#faf9f7] px-3 py-1.5 text-[11px] font-bold text-neutral-500">#Nuevo</span>
            </div>

            <div className="rounded-[22px] border border-dashed border-neutral-300 bg-[#faf9f7] px-5 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm">＋</div>
              <p className="mt-3 text-sm font-bold text-neutral-700">Tu pedido está vacío</p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">Agrega productos para comenzar el pedido.</p>
            </div>

            <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-5 text-sm">
              <div className="flex justify-between text-neutral-600"><span>Subtotal</span><strong className="text-neutral-900">$0</strong></div>
              <div className="flex justify-between text-neutral-600"><span>Domicilio</span><strong className="text-neutral-900">$0</strong></div>
              <div className="mt-2 flex items-end justify-between border-t border-dashed border-neutral-200 pt-4">
                <span className="font-black text-neutral-900">Total</span>
                <strong className="text-3xl font-black tracking-[-0.04em] text-[var(--brand-red)]">$0</strong>
              </div>
            </div>

            <button disabled className="mt-5 w-full cursor-not-allowed rounded-2xl bg-neutral-200 px-4 py-3.5 font-black text-neutral-400">Confirmar pedido</button>
          </aside>
        </section>
      </div>

      {showCreateCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="alento-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[30px] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Cliente</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">Nuevo cliente</h2>
              </div>
              <button onClick={() => setShowCreateCustomer(false)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold text-neutral-600">Cerrar</button>
            </div>

            <form onSubmit={createCustomer} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">Nombre *</span>
                <input value={name} onChange={(event) => setName(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Nombre del cliente" autoFocus />
              </label>

              <div className="grid grid-cols-[110px_1fr] gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold">Indicativo *</span>
                  <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="alento-input w-full rounded-2xl px-3 py-3">
                    <option value="+57">+57</option><option value="+1">+1</option><option value="+34">+34</option><option value="+52">+52</option><option value="+51">+51</option><option value="+593">+593</option>
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold">Teléfono *</span>
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Ej. 3133864377" inputMode="tel" />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-bold">Dirección <span className="font-normal text-neutral-400">(opcional)</span></span>
                <input value={address} onChange={(event) => setAddress(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="Dirección de entrega" />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-bold">Notas</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="alento-input min-h-24 w-full rounded-2xl px-4 py-3" placeholder="Torre, apto, referencia, preferencias del cliente..." />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-bold">Correo <span className="font-normal text-neutral-400">(opcional)</span></span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} className="alento-input w-full rounded-2xl px-4 py-3" placeholder="cliente@correo.com" inputMode="email" />
              </label>

              {customerError && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{customerError}</div>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateCustomer(false)} className="flex-1 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 font-bold text-neutral-700">Cancelar</button>
                <button type="submit" disabled={savingCustomer} className="alento-red-glow flex-1 rounded-2xl bg-[var(--brand-red)] px-4 py-3 font-black text-white hover:bg-[var(--brand-red-dark)] disabled:opacity-50">{savingCustomer ? "Guardando..." : "Crear cliente"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
