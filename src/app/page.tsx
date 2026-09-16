"use client";

import { FormEvent, useState } from "react";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
};

const categories = ["Pizzas", "Bebidas", "Acompañantes"];

const products = [
  { name: "Hawaiana", description: "Jamón, piña y mozzarella", price: "Desde $—" },
  { name: "Fiesta Pepperoni", description: "Pepperoni y mozzarella", price: "Desde $—" },
  { name: "Carnes", description: "Selección de carnes y mozzarella", price: "Desde $—" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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

      if (!response.ok) {
        throw new Error(data.error || "No fue posible buscar clientes.");
      }

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

    if (!name.trim()) {
      setCustomerError("El nombre es obligatorio.");
      return;
    }

    setSavingCustomer(true);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible crear el cliente.");
      }

      chooseCustomer(data.customer);
      setName("");
      setPhone("");
      setEmail("");
      setShowCreateCustomer(false);
    } catch (error) {
      setCustomerError(error instanceof Error ? error.message : "No fue posible crear el cliente.");
    } finally {
      setSavingCustomer(false);
    }
  }

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 rounded-3xl bg-black px-6 py-5 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-white/60">Alentó Pizza</p>
            <h1 className="text-2xl font-semibold">Punto de venta</h1>
          </div>
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm">MVP en construcción</div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-[var(--muted)]">Cliente</p>
                  <h2 className="text-xl font-semibold">
                    {selectedCustomer ? selectedCustomer.name : "Nuevo pedido"}
                  </h2>
                  {selectedCustomer && (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {selectedCustomer.phone || "Sin teléfono"}
                      {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {selectedCustomer && (
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setQuery("");
                      }}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium"
                    >
                      Cambiar
                    </button>
                  )}
                  <button
                    onClick={() => setShowCreateCustomer(true)}
                    className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
                  >
                    + Nuevo cliente
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      searchCustomers();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-black"
                  placeholder="Nombre, teléfono o correo del cliente"
                />
                <button
                  onClick={searchCustomers}
                  disabled={searching}
                  className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {searching ? "Buscando..." : "Buscar cliente"}
                </button>
              </div>

              {(customers.length > 0 || searchMessage) && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => chooseCustomer(customer)}
                      className="flex w-full items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 text-left last:border-b-0 hover:bg-neutral-50"
                    >
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {customer.phone || "Sin teléfono"}
                          {customer.email ? ` · ${customer.email}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-medium">Seleccionar</span>
                    </button>
                  ))}
                  {searchMessage && <p className="px-4 py-3 text-sm text-[var(--muted)]">{searchMessage}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category, index) => (
                <button
                  key={category}
                  className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium ${
                    index === 0 ? "bg-black text-white" : "border border-[var(--border)] bg-white"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <article key={product.name} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
                  <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100 text-5xl">🍕</div>
                  <div className="space-y-2 p-4">
                    <h3 className="text-lg font-semibold">{product.name}</h3>
                    <p className="min-h-10 text-sm text-[var(--muted)]">{product.description}</p>
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <span className="font-semibold">{product.price}</span>
                      <button className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white">Agregar</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-[var(--border)] bg-white p-5 lg:sticky lg:top-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--muted)]">Pedido actual</p>
                <h2 className="text-xl font-semibold">Sin productos</h2>
                {selectedCustomer && <p className="mt-1 text-sm text-[var(--muted)]">Para {selectedCustomer.name}</p>}
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs">#Nuevo</span>
            </div>

            <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-[var(--muted)]">
              Agrega productos para comenzar el pedido.
            </div>

            <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-5 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><strong>$0</strong></div>
              <div className="flex justify-between"><span>Domicilio</span><strong>$0</strong></div>
              <div className="flex justify-between text-lg"><span>Total</span><strong>$0</strong></div>
            </div>

            <button disabled className="mt-5 w-full cursor-not-allowed rounded-2xl bg-neutral-200 px-4 py-3 font-semibold text-neutral-500">
              Confirmar pedido
            </button>
          </aside>
        </section>
      </div>

      {showCreateCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--muted)]">Cliente</p>
                <h2 className="text-2xl font-semibold">Nuevo cliente</h2>
              </div>
              <button
                onClick={() => setShowCreateCustomer(false)}
                className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={createCustomer} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Nombre *</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-black"
                  placeholder="Nombre del cliente"
                  autoFocus
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Teléfono</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-black"
                  placeholder="Ej. 3133864377"
                  inputMode="tel"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Correo</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-black"
                  placeholder="cliente@correo.com"
                  inputMode="email"
                />
              </label>

              {customerError && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{customerError}</div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCustomer(false)}
                  className="flex-1 rounded-xl border border-[var(--border)] px-4 py-3 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="flex-1 rounded-xl bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
                >
                  {savingCustomer ? "Guardando..." : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
