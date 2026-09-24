"use client";

type FeedbackTone = "warning" | "error" | "success";

type FeedbackModalProps = {
  tone?: FeedbackTone;
  title: string;
  message: string;
  detail?: string;
  buttonLabel?: string;
  onClose: () => void;
};

function NoticeIcon({ tone }: { tone: FeedbackTone }) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
      : tone === "error"
        ? "border-red-200 bg-red-50 text-red-600"
        : "border-amber-200 bg-amber-50 text-amber-600";

  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${classes}`}
    >
      {tone === "success" ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.6 2.6L16.5 9" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5h.01" />
        </svg>
      )}
    </div>
  );
}

export default function FeedbackModal({
  tone = "warning",
  title,
  message,
  detail,
  buttonLabel = "Aceptar",
  onClose,
}: FeedbackModalProps) {
  const detailClasses =
    tone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
      : tone === "error"
        ? "border-red-100 bg-red-50 text-red-700"
        : "border-amber-100 bg-amber-50 text-amber-800";

  const eyebrow =
    tone === "success"
      ? "Operación completada"
      : tone === "error"
        ? "No fue posible completar la acción"
        : "Protección de la operación";

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[470px] overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,.32)]"
      >
        <div className="flex items-start justify-between gap-4 bg-[radial-gradient(circle_at_90%_0%,rgba(226,26,34,.24),transparent_36%),linear-gradient(135deg,#080809,#1a1718)] px-5 py-5 text-white">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ff5a60]">
              {eyebrow}
            </p>
            <h3
              id="feedback-modal-title"
              className="mt-1 text-[22px] font-black leading-tight tracking-[-0.025em]"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-lg text-white/65 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <NoticeIcon tone={tone} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-6 text-neutral-700">
                {message}
              </p>
              {detail && (
                <div
                  className={`mt-3 rounded-2xl border px-4 py-3 text-[12px] font-semibold leading-5 ${detailClasses}`}
                >
                  {detail}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 h-11 w-full rounded-xl bg-neutral-950 text-sm font-black text-white transition hover:bg-neutral-800"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
