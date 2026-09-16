export default function KitchenPage() {
  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-medium text-neutral-500">Producción</p>
        <h1 className="text-3xl font-black tracking-tight">Cocina</h1>
        <p className="mt-2 max-w-2xl text-neutral-500">Aquí construiremos el tablero de pedidos en preparación, listos y entregados.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {['Por preparar', 'En preparación', 'Listos'].map((title) => (
            <section key={title} className="min-h-64 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
              <h2 className="font-bold">{title}</h2>
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">Sin pedidos</div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
