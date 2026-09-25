"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { orderCode } from "@/lib/orderCode";

const LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

type Order = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  status: string;
  fulfillmentType: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  notes: string | null;
  couponName: string | null;
  deliveryZoneName: string | null;
  createdAt: string;
  customer: { name: string; countryCode: string; phone: string | null } | null;
  address: {
    address: string;
    formattedAddress: string | null;
    label: string | null;
    neighborhood: string | null;
    city: string | null;
    notes: string | null;
  } | null;
  driver: {
    name: string;
    whatsappCountryCode: string;
    whatsappPhone: string | null;
  } | null;
  items: { id: number; productName: string; quantity: number; unitPrice: number; lineTotal: number; configuration: unknown; notes?: string | null }[];
  payments: { id?: number; method: string; amount: number; cashReceived: number | null; changeDue: number | null; status: string; reference?: string | null; paidAt?: string | null }[];
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function fulfillmentLabel(value: string) {
  if (value === "DELIVERY") return "DOMICILIO";
  if (value === "PICKUP") return "RECOGER EN TIENDA";
  return "LOCAL";
}

function compactDeliveryAddress(value: string | null | undefined) {
  const raw = value?.trim() || "";
  if (!raw) return "";

  return raw
    .replace(/,\s*Bogot[aá]\b.*$/i, "")
    .replace(/\s*,\s*$/, "")
    .trim();
}

export default function ThermalReceiptPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const autoPrinted = useRef(false);
  const embedded = searchParams.get("embedded") === "1";
  const autoPrint = searchParams.get("autoprint") === "1";

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/orders/${params.id}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar el pedido.");
        setOrder(data.order);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el pedido.");
      }
    }
    if (params.id) void load();
  }, [params.id]);

  useEffect(() => {
    if (!order || !autoPrint || autoPrinted.current) return;
    autoPrinted.current = true;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [order, autoPrint]);

  function downloadReceipt() {
    if (!order) return;
    const receipt = document.querySelector(".thermal-receipt")?.outerHTML;
    if (!receipt) return;
    const displayNumber = order.sequenceNumber ?? order.id;
    const displayCode = orderCode(displayNumber, order.source);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${displayCode}</title><style>
body{font-family:Arial,sans-serif;max-width:80mm;margin:0 auto;padding:5mm;color:#000}
.text-center{text-align:center}.font-black{font-weight:900}.font-bold{font-weight:700}.thermal-rule{border-top:1.5px dashed #111}
.flex{display:flex}.justify-between{justify-content:space-between}.grid{display:grid}.space-y-1>*+*{margin-top:4px}.space-y-3>*+*{margin-top:12px}
.mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}.my-3{margin-top:12px;margin-bottom:12px}.ml-\[22px\]{margin-left:22px}
.border-\[2px\]{border:2px solid #000}.px-3{padding-left:12px;padding-right:12px}.py-2{padding-top:8px;padding-bottom:8px}
.receipt-customer{margin-top:10px}.receipt-address{font-size:13px;font-weight:900;line-height:1.25;margin-top:7px}
.receipt-instructions{font-size:10px;line-height:1.3;margin-top:4px}
</style></head><body>${receipt}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${displayCode}-comprobante.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (error) return <main className="p-8 text-red-700">{error}</main>;
  if (!order) return <main className="p-8 text-neutral-500">Cargando comprobante...</main>;

  const paidPayments = order.payments.filter((payment) => payment.status === "PAID");
  const paidTotal = paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const pendingBalance = Math.max(0, Number(order.total) - paidTotal);
  const paidInFull = pendingBalance <= 0 && Number(order.total) > 0;
  const isDelivery = order.fulfillmentType === "DELIVERY";
  const deliveryAddress = compactDeliveryAddress(order.address?.address);
  const deliveryInstructions = order.address?.notes?.trim() || "";
  const pendingPayment =
    order.payments.find((payment) =>
      ["PENDING", "PARTIAL"].includes(payment.status),
    ) ?? null;
  const displayNumber = order.sequenceNumber ?? order.id;
  const displayCode = orderCode(displayNumber, order.source);

  return (
    <main className="thermal-page mx-auto min-h-screen bg-white px-[5mm] py-[5mm] text-black">
      {!embedded && <div className="no-print mb-4 flex justify-center gap-2">
        <button onClick={() => window.print()} className="rounded-xl bg-black px-5 py-2.5 text-sm font-black text-white">Imprimir</button>
        <button onClick={downloadReceipt} className="rounded-xl bg-[var(--brand-red)] px-5 py-2.5 text-sm font-black text-white">Descargar comprobante</button>
        <button onClick={() => window.close()} className="rounded-xl border px-5 py-2.5 text-sm font-black">Cerrar</button>
      </div>}

      <div className="thermal-receipt">
        <div className="text-center">
          <img src={LOGO} alt="Alentó Pizza" className="mx-auto h-[17mm] w-[17mm] object-contain grayscale" />
          <h1 className="mt-1 text-[17px] font-black">ALENTÓ PIZZA</h1>
          <p className="text-[10px] leading-[13px]">AV CALLE 43 SUR #79A-33 · WHATSAPP 324 333 4009</p>
        </div>

        <div className="thermal-rule my-3" />

        <div className="text-center">
          <p className="text-[10px]">{new Date(order.createdAt).toLocaleString("es-CO")}</p>
          <p className="mt-1 text-[27px] font-black leading-none">{displayCode}</p>
          <div className="mx-auto mt-2 inline-block border-[2px] border-black px-4 py-1 text-[14px] font-black">
            {fulfillmentLabel(order.fulfillmentType)}
          </div>
        </div>

        {isDelivery ? (
          <div className="receipt-customer">
            <p className="text-[15px] font-black">
              {order.customer?.name?.toUpperCase() || "CLIENTE OCASIONAL"}
            </p>

            {order.customer?.phone && (
              <p className="mt-1 text-[11px] font-bold">
                {order.customer.countryCode}{order.customer.phone}
              </p>
            )}

            {deliveryAddress && (
              <p className="receipt-address">{deliveryAddress}</p>
            )}

            {deliveryInstructions && (
              <p className="receipt-instructions text-[10px] leading-[13px]">
                <span className="font-bold">Indicaciones:</span>{" "}
                {deliveryInstructions}
              </p>
            )}

            {order.notes && (
              <p className="mt-2 text-[10px] font-bold">
                NOTA: {order.notes}
              </p>
            )}
          </div>
        ) : (
          <div className="receipt-customer text-center">
            <p className="text-[15px] font-black">
              {order.customer?.name?.toUpperCase() || "CLIENTE OCASIONAL"}
            </p>
            {order.customer?.phone && (
              <p className="mt-1 text-[11px] font-bold">
                {order.customer.countryCode}{order.customer.phone}
              </p>
            )}
          </div>
        )}

        <div className="thermal-rule my-3" />
        <p className="text-[12px] font-black">CHECKLIST DE DESPACHO:</p>

        <div className="mt-2 space-y-3">
          {order.items.map((item) => {
            const details = presentOrderItemConfiguration(item.configuration);
            return <div key={item.id}>
              <div className="grid grid-cols-[16px_1fr_auto] gap-1 text-[12px] font-black">
                <span>□</span><span>{item.quantity}X {item.productName.toUpperCase()}</span><span>$ {money(item.lineTotal)}</span>
              </div>
              {details.length > 0 && <div className="ml-[22px] mt-1 space-y-0.5">{details.map((detail, index) => <p key={`${detail.label}-${index}`} className="text-[11px] leading-[14px]">- {detail.label.toUpperCase()}: {detail.value.toUpperCase()}</p>)}</div>}
              {item.notes && <div className="ml-[22px] mt-1 border-[2px] border-black px-2 py-1"><p className="text-[11px] font-black">NOTA COCINA: {item.notes.toUpperCase()}</p></div>}
            </div>;
          })}
        </div>

        <div className="thermal-rule my-3" />

        <div className="space-y-1 text-[13px] font-black">
          <div className="flex justify-between"><span>SUBTOTAL</span><span>$ {money(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>DOMICILIO</span><span>$ {money(order.deliveryFee)}</span></div>
          <div className="flex justify-between"><span>DESCUENTO</span><span>-$ {money(order.discount)}</span></div>
          <div className="mt-2 flex items-end justify-between text-[20px]"><span>TOTAL</span><span>$ {money(order.total)}</span></div>
        </div>

        <div className="mt-3 border-[2px] border-black px-3 py-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.08em]">ESTADO DE PAGO</p>
          <p className="mt-1 text-[15px] font-black">
            {paidInFull ? `PAGADO $ ${money(paidTotal)}` : `PENDIENTE $ ${money(pendingBalance)}`}
          </p>
          {!paidInFull && (
            <>
              {pendingPayment ? (
                <p className="mt-1 text-[10px] font-bold">
                  COBRAR {pendingPayment.method.toUpperCase()} · $ {money(pendingBalance)}
                </p>
              ) : (
                <p className="mt-1 text-[10px] font-bold">SIN MEDIO DE PAGO REGISTRADO</p>
              )}

              {pendingPayment?.cashReceived != null && (
                <p className="mt-1 text-[10px]">
                  PAGA CON $ {money(pendingPayment.cashReceived)} · VUELTAS $ {money(pendingPayment.changeDue || 0)}
                </p>
              )}
            </>
          )}
        </div>

        {order.couponName && <p className="mt-2 text-center text-[10px] font-bold">CUPÓN: {order.couponName.toUpperCase()}</p>}

        <div className="thermal-rule my-3" />
        <div className="text-center"><p className="text-[13px] font-black">¡Gracias por elegir Alentó Pizza!</p><p className="mt-1 text-[10px] italic">Este documento es un comprobante de entrega.</p></div>
      </div>
    </main>
  );
}
