const categories = ["Pizzas", "Bebidas", "Acompañantes"];

const products = [
  { name: "Hawaiana", description: "Jamón, piña y mozzarella", price: "Desde $—" },
  { name: "Fiesta Pepperoni", description: "Pepperoni y mozzarella", price: "Desde $—" },
  { name: "Carnes", description: "Selección de carnes y mozzarella", price: "Desde $—" },
];

export default function Home() {
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
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--muted)]">Cliente</p>
                  <h2 className="text-xl font-semibold">Nuevo pedido</h2>
                </div>
                <button className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                  Buscar cliente
                </button>
              </div>
              <input
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none"
                placeholder="Nombre o teléfono del cliente"
              />
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
    </main>
  );
}
