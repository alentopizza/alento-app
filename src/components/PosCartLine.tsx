"use client";

import type { OrderLineConfiguration } from "@/lib/orderConfiguration";

type PosCartLineItem = {
  key: string;
  productId: number;
  name: string;
  detail: string;
  unitPrice: number;
  quantity: number;
  configuration: OrderLineConfiguration;
  notes?: string;
};

type Props = {
  item: PosCartLineItem;
  editable: boolean;
  onEdit: () => void;
  onChangeQty: (delta: number) => void;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="pos-cart-spec">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function PosCartLine({ item, editable, onEdit, onChangeQty }: Props) {
  const configuration = item.configuration;

  return (
    <article
      className={`pos-cart-line ${editable ? "pos-cart-line-editable" : ""}`}
      onClick={editable ? onEdit : undefined}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={(event) => {
        if (editable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onEdit();
        }
      }}
    >
      <div className="pos-cart-line-head">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <b className="pos-cart-line-title">{item.name}</b>
            {editable && <span className="pos-cart-edit-hint">Editar</span>}
          </div>
        </div>
        <b className="pos-cart-line-price">{formatCOP(item.unitPrice * item.quantity)}</b>
      </div>

      {configuration.kind === "PIZZA" && (
        <div className="pos-cart-structured">
          <div className="pos-cart-spec-grid">
            <Spec label="Tamaño" value={configuration.size.name} />
            <Spec label="Borde" value={configuration.crust.name} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {configuration.flavors.map((flavor, index) => (
              <span key={`${flavor.productId}-${index}`} className="contents">
                <span className="inline-flex min-h-7 items-center rounded-lg border border-neutral-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.025em] text-neutral-950 shadow-[0_2px_8px_rgba(28,23,20,.04)]">
                  {flavor.name}
                </span>
                {index < configuration.flavors.length - 1 && <span className="text-[10px] font-bold text-neutral-300">−</span>}
              </span>
            ))}
          </div>

          {configuration.modifiers.length > 0 && (
            <div className="pos-cart-extras">
              <span className="pos-cart-extras-label">Ingredientes adicionales</span>
              <div className="pos-cart-tags">
                {configuration.modifiers.map((modifier) => (
                  <span key={modifier.productId} className="pos-cart-tag">
                    + {modifier.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.notes && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left">
              <span className="block text-[9px] font-black uppercase tracking-[0.08em] text-amber-600">Nota cocina</span>
              <b className="mt-0.5 block text-[11px] leading-4 text-amber-900">{item.notes}</b>
            </div>
          )}
        </div>
      )}

      {configuration.kind === "COMBO" && (
        <div className="pos-cart-structured">
          <div className="space-y-1.5">
            {configuration.pizzas.map((pizza, index) => (
              <div key={`${pizza.ruleId}-${index}`} className="pos-cart-combo-row">
                <span>Pizza {index + 1}</span>
                <b>{pizza.size.name} · {pizza.flavor.name}</b>
              </div>
            ))}
          </div>

          {configuration.groups.length > 0 && (
            <div className="pos-cart-extras">
              <div className="pos-cart-tags">
                {configuration.groups.flatMap((group) =>
                  group.selections.map((selection) => (
                    <span key={`${group.groupId}-${selection.productId}`} className="pos-cart-tag pos-cart-tag-neutral">
                      {group.name}: {selection.quantity > 1 ? `${selection.quantity}× ` : ""}{selection.name}
                    </span>
                  )),
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {configuration.kind === "STANDARD" && item.detail !== "Producto" && (
        <p className="pos-cart-standard-detail">{item.detail}</p>
      )}

      <div className="pos-cart-line-footer pos-cart-line-footer-compact">
        <div className="pos-cart-qty" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label={`Quitar una unidad de ${item.name}`}
            onClick={() => onChangeQty(-1)}
          >
            −
          </button>
          <b>{item.quantity}</b>
          <button
            type="button"
            aria-label={`Agregar una unidad de ${item.name}`}
            onClick={() => onChangeQty(1)}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}
