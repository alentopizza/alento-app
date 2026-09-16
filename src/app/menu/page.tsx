export default function MenuPage() {
  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-medium text-neutral-500">Catálogo</p>
        <h1 className="text-3xl font-black tracking-tight">Menú</h1>
        <p className="mt-2 max-w-2xl text-neutral-500">Categorías y productos se administrarán juntos desde esta sección.</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
            <h2 className="font-bold">Categorías</h2>
            <div className="mt-4 space-y-2 text-sm text-neutral-500">
              <div className="rounded-xl bg-black px-3 py-2.5 text-white">Pizzas</div>
              <div className="rounded-xl bg-neutral-100 px-3 py-2.5">Bebidas</div>
              <div className="rounded-xl bg-neutral-100 px-3 py-2.5">Acompañantes</div>
            </div>
          </section>
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
            <h2 className="font-bold">Productos</h2>
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">La administración real del menú será el siguiente módulo.</div>
          </section>
        </div>
      </div>
    </main>
  );
}
