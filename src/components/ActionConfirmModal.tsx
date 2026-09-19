"use client";

type ConfirmVariant = "warning" | "danger";

type ActionConfirmModalProps = {
  variant: ConfirmVariant;
  eyebrow?: string;
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

function WarningIcon({ danger }: { danger: boolean }) {
  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
      danger
        ? "border-red-200 bg-red-50 text-red-600"
        : "border-amber-200 bg-amber-50 text-amber-600"
    }`}>
      {danger ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5h.01" />
        </svg>
      )}
    </div>
  );
}

export default function ActionConfirmModal({
  variant,
  eyebrow = "Confirmar acción",
  title,
  description,
  detail,
  confirmLabel,
  cancelLabel = "Volver",
  busy = false,
  onConfirm,
  onClose,
}: ActionConfirmModalProps) {
  const danger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[3px]"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-confirm-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[460px] overflow-hidden rounded-[26px] border border-neutral-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,.28)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-[linear-gradient(135deg,#ffffff,#faf8f5)] px-5 py-4.5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-neutral-400">{eyebrow}</p>
            <h3 id="action-confirm-title" className="mt-1 text-[21px] font-black tracking-[-0.025em] text-neutral-950">
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-lg text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <WarningIcon danger={danger} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-5 text-neutral-700">{description}</p>
              {detail && (
                <div className={`mt-3 rounded-xl border px-3 py-2.5 text-[11px] leading-4 ${
                  danger
                    ? "border-red-100 bg-red-50 text-red-700"
                    : "border-amber-100 bg-amber-50 text-amber-800"
                }`}>
                  {detail}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="h-11 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`h-11 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 ${
                danger
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {busy ? "Procesando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
