"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type PayrollReceipt = {
  id: number;
  workerId: number;
  workerName: string;
  grossAmount: number;
  loanDeduction: number;
  netAmount: number;
  occurredAt: string;
  note: string | null;
  createdByName: string;
  cashExpenseId: number;
  shifts: Array<{
    id: number;
    startsAt: string;
    endsAt: string;
    amount: number;
    notes: string | null;
  }>;
  loanDeductions: Array<{
    id: number;
    loanId: number;
    amount: number;
    paidAt: string;
    method: string;
    loanPrincipal: number;
    loanNote: string | null;
    loanIssuedAt: string;
  }>;
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shiftDay(value: string) {
  return new Date(value).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shiftTime(value: string) {
  return new Date(value).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PayrollReceiptPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("auto") === "1";
  const printed = useRef(false);
  const [payment, setPayment] = useState<PayrollReceipt | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/caja/payroll/${params.id}`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(
            body.error || "No fue posible cargar el comprobante de nómina.",
          );
        }
        setPayment(body.payment);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar el comprobante de nómina.",
        );
      }
    }

    if (params.id) void load();
  }, [params.id]);

  useEffect(() => {
    if (!payment || !autoPrint || printed.current) return;
    printed.current = true;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint, payment]);

  if (error) {
    return <main className="p-8 text-sm font-bold text-red-700">{error}</main>;
  }

  if (!payment) {
    return <main className="p-8 text-sm text-neutral-500">Cargando comprobante...</main>;
  }

  return (
    <main className="payroll-print-page min-h-screen bg-white px-4 py-5 text-black">
      <div className="no-print mx-auto mb-5 flex max-w-md justify-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-black px-5 py-2.5 text-sm font-black text-white"
        >
          Imprimir 80 mm
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-black"
        >
          Cerrar
        </button>
      </div>

      <article className="payroll-receipt mx-auto w-[70mm] font-[Arial,Helvetica,sans-serif] text-black">
        <header className="text-center">
          <h1 className="text-[18px] font-black leading-none">ALENTÓ PIZZA</h1>
          <p className="mt-1 text-[10px] font-black tracking-[0.08em]">
            COMPROBANTE DE PAGO DE NÓMINA
          </p>
          <p className="mt-2 text-[11px] font-bold">
            PAGO #{String(payment.id).padStart(4, "0")}
          </p>
          <p className="mt-1 text-[10px] font-bold">{dateTime(payment.occurredAt)}</p>
        </header>

        <div className="my-3 border-t-2 border-dashed border-black" />

        <section className="text-center">
          <p className="text-[9px] font-black tracking-[0.08em]">TRABAJADOR</p>
          <p className="mt-1 text-[16px] font-black uppercase">
            {payment.workerName}
          </p>
        </section>

        <div className="my-3 border-t-2 border-dashed border-black" />

        <section>
          <p className="mb-2 text-[12px] font-black">TURNOS PAGADOS</p>
          <div className="space-y-2">
            {payment.shifts.map((shift) => (
              <div key={shift.id} className="border-b border-dotted border-black pb-2">
                <div className="flex justify-between gap-3 text-[11px] font-black">
                  <span>{shiftDay(shift.startsAt).toUpperCase()}</span>
                  <span>$ {money(shift.amount)}</span>
                </div>
                <p className="mt-0.5 text-[10px] font-bold">
                  {shiftTime(shift.startsAt)} – {shiftTime(shift.endsAt)}
                </p>
                {shift.notes && (
                  <p className="mt-0.5 text-[9px]">NOTA: {shift.notes}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {payment.loanDeductions.length > 0 && (
          <>
            <div className="my-3 border-t-2 border-dashed border-black" />
            <section>
              <p className="mb-2 text-[12px] font-black">
                DESCUENTOS POR PRÉSTAMO
              </p>
              <div className="space-y-2">
                {payment.loanDeductions.map((deduction) => (
                  <div
                    key={deduction.id}
                    className="flex justify-between gap-3 border-b border-dotted border-black pb-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <b className="block">PRÉSTAMO #{deduction.loanId}</b>
                      <span className="block text-[9px]">
                        {deduction.loanNote || "Sin observación"}
                      </span>
                    </div>
                    <b className="shrink-0">− $ {money(deduction.amount)}</b>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="my-3 border-t-2 border-dashed border-black" />

        <section className="space-y-1.5 text-[12px] font-black">
          <div className="flex justify-between gap-3">
            <span>NÓMINA BRUTA</span>
            <span>$ {money(payment.grossAmount)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>DESCUENTOS PRÉSTAMOS</span>
            <span>− $ {money(payment.loanDeduction)}</span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3 border-t-2 border-black pt-2 text-[18px]">
            <span>NETO PAGADO</span>
            <span>$ {money(payment.netAmount)}</span>
          </div>
        </section>

        {payment.note && (
          <>
            <div className="my-3 border-t-2 border-dashed border-black" />
            <section className="text-[10px]">
              <b>NOTA DEL PAGO</b>
              <p className="mt-1">{payment.note}</p>
            </section>
          </>
        )}

        <div className="my-3 border-t-2 border-dashed border-black" />

        <section className="text-center text-[9px]">
          <p>
            Registró: <b>{payment.createdByName}</b>
          </p>
          <p className="mt-1">
            Este comprobante detalla los turnos liquidados y los descuentos
            aplicados en el mismo pago.
          </p>
        </section>

        <div className="mt-[18mm] border-t-2 border-black pt-2 text-center">
          <p className="text-[10px] font-black">FIRMA DEL TRABAJADOR</p>
          <p className="mt-1 text-[9px]">
            {payment.workerName.toUpperCase()}
          </p>
        </div>

        <div className="mt-5 border-t border-dashed border-black pt-3 text-center text-[9px] font-bold">
          ALENTÓ PIZZA · COMPROBANTE INTERNO DE NÓMINA
        </div>
      </article>

      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .payroll-print-page,
          .payroll-print-page * {
            visibility: visible !important;
          }

          .payroll-print-page {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 80mm !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 4mm 5mm 6mm !important;
            background: #fff !important;
          }

          .payroll-receipt {
            width: 70mm !important;
            margin: 0 auto !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
