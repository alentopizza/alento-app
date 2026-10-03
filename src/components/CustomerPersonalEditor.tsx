"use client";

export default function CustomerPersonalEditor({
  name,
  countryCode,
  phone,
  email,
  notes,
  onNameChange,
  onCountryCodeChange,
  onPhoneChange,
  onEmailChange,
  onNotesChange,
  description = "Datos básicos para identificarlo, contactarlo y reconocerlo en futuras compras.",
}: {
  name: string;
  countryCode: string;
  phone: string;
  email?: string;
  notes?: string;
  onNameChange: (value: string) => void;
  onCountryCodeChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange?: (value: string) => void;
  onNotesChange?: (value: string) => void;
  description?: string;
}) {
  const showEmail = email !== undefined && Boolean(onEmailChange);
  const showNotes = notes !== undefined && Boolean(onNotesChange);

  return (
    <section className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(20,18,16,.04)] sm:p-6">
      <div className="mb-6 border-b border-neutral-100 pb-4">
        <p className="alento-ui-label uppercase text-neutral-400">
          Información personal
        </p>
        <h3 className="mt-1 text-[22px] font-bold tracking-[-0.025em] text-neutral-950">
          Datos del cliente
        </h3>
        <p className="mt-1 text-[12px] leading-5 text-neutral-400">
          {description}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        <label className="block md:col-span-7">
          <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
            Nombre
          </span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className="alento-input h-12 w-full rounded-2xl px-4"
            placeholder="Nombre del cliente"
          />
        </label>

        <div className="grid grid-cols-[105px_1fr] gap-3 md:col-span-5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
              Indicativo
            </span>
            <select
              value={countryCode}
              onChange={(event) => onCountryCodeChange(event.target.value)}
              className="alento-input h-12 w-full rounded-2xl px-3"
            >
              <option>+57</option>
              <option>+30</option>
              <option>+1</option>
              <option>+34</option>
              <option>+52</option>
              <option>+51</option>
              <option>+593</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
              Teléfono
            </span>
            <input
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              inputMode="tel"
              className="alento-input h-12 w-full rounded-2xl px-4"
              placeholder="Número"
            />
          </label>
        </div>

        {showEmail && (
          <label className="block md:col-span-6">
            <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
              Correo{" "}
              <span className="font-medium text-neutral-400">
                (opcional)
              </span>
            </span>
            <input
              value={email}
              onChange={(event) => onEmailChange?.(event.target.value)}
              className="alento-input h-12 w-full rounded-2xl px-4"
              placeholder="correo@ejemplo.com"
            />
          </label>
        )}

        {showNotes && (
          <label
            className={
              showEmail
                ? "block md:col-span-6"
                : "block md:col-span-12"
            }
          >
            <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
              Nota del cliente{" "}
              <span className="font-medium text-neutral-400">
                (opcional)
              </span>
            </span>
            <textarea
              value={notes}
              onChange={(event) => onNotesChange?.(event.target.value)}
              className="alento-input min-h-[92px] w-full resize-none rounded-2xl px-4 py-3"
              placeholder="Información útil para futuras compras"
            />
          </label>
        )}
      </div>
    </section>
  );
}
