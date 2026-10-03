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

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function receiptDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

function pizzaCrustSnapshot(configuration: unknown) {
  if (!isObject(configuration)) return null;
  if (String(configuration.kind ?? "").toUpperCase() !== "PIZZA") {
    return null;
  }

  const crust = isObject(configuration.crust)
    ? configuration.crust
    : null;
  if (!crust) return null;

  const name =
    typeof crust.name === "string" ? crust.name.trim() : "";
  const price = Math.max(0, numberValue(crust.price));

  return name ? { name, price } : null;
}

function itemReceiptBreakdown(item: Order["items"][number]) {
  const crust = pizzaCrustSnapshot(item.configuration);
  const crustTotal = crust ? crust.price * Math.max(1, item.quantity) : 0;
  const baseLineTotal = Math.max(
    0,
    Number(item.lineTotal) - crustTotal,
  );

  const details = presentOrderItemConfiguration(
    item.configuration,
  ).filter(
    (detail) =>
      detail.label.trim().toLocaleLowerCase("es") !== "borde",
  );

  return {
    crust,
    crustTotal,
    baseLineTotal,
    details,
  };
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
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;max-width:80mm;margin:0 auto;padding:4mm 5mm 6mm;color:#000;background:#fff}.thermal-receipt{width:70mm;margin:0 auto}.text-center{text-align:center}.font-black{font-weight:900}.font-bold{font-weight:700}.thermal-rule{border-top:1.5px dashed #111}.receipt-header img{display:block;margin:0 auto;width:16mm;height:16mm;object-fit:contain;filter:grayscale(1)}.receipt-brand{font-size:17px;font-weight:900;margin:3px 0 0}.receipt-business{font-size:10px;line-height:13px;margin:1px 0 0}.receipt-date{font-size:10px;margin:0}.receipt-order-label{font-size:11px;font-weight:900;margin:7px 0 0}.receipt-order-code{font-size:28px;line-height:1;font-weight:900;margin:2px 0 0}.receipt-mode{display:inline-block;border:2px solid #000;padding:5px 12px;margin-top:7px;font-size:14px;font-weight:900}.receipt-section-title{font-size:13px;font-weight:900;margin:0 0 7px}.receipt-customer-name{font-size:15px;font-weight:900;margin:0}.receipt-phone{font-size:11px;font-weight:700;margin:3px 0 0}.receipt-address{font-size:12px;font-weight:700;line-height:1.3;margin:5px 0 0}.receipt-instructions{font-size:10px;line-height:1.3;margin:4px 0 0}.receipt-item{margin:0 0 12px}.receipt-item:last-child{margin-bottom:0}.receipt-line{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start}.receipt-product{font-size:12px;font-weight:900;line-height:1.25}.receipt-price{font-size:12px;font-weight:900;white-space:nowrap}.receipt-details{margin:4px 0 0 13px}.receipt-detail{font-size:10.5px;line-height:14px;margin:1px 0}.receipt-crust{display:grid;grid-template-columns:1fr auto;gap:8px;margin:2px 0 0 13px;font-size:10.5px;line-height:14px}.receipt-note{margin:5px 0 0 13px;border:1.5px solid #000;padding:4px 6px;font-size:10px;font-weight:900}.receipt-totals{font-size:13px;font-weight:900}.receipt-total-row{display:flex;justify-content:space-between;gap:8px;margin-top:4px}.receipt-grand-total{display:flex;justify-content:space-between;align-items:end;border-top:2px solid #000;margin-top:8px;padding-top:7px;font-size:20px;font-weight:900}.receipt-payment{margin-top:12px;border:2px solid #000;padding:8px 10px;text-align:center}.receipt-payment-label{font-size:10px;font-weight:900;letter-spacing:.08em}.receipt-payment-value{font-size:15px;font-weight:900;margin-top:4px}.receipt-footer{text-align:center}.receipt-footer-title{font-size:13px;font-weight:900;margin:0}.receipt-footer-sub{font-size:10px;font-style:italic;margin:4px 0 0}.mt-rule{margin:12px 0}.coupon{font-size:10px;font-weight:700;text-align:center;margin-top:8px}
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
        <div className="receipt-header text-center">
          <img
            src={LOGO}
            alt="Alentó Pizza"
            className="mx-auto h-[16mm] w-[16mm] object-contain grayscale"
          />
          <h1 className="receipt-brand mt-1 text-[17px] font-black">
            ALENTÓ PIZZA
          </h1>
          <p className="receipt-business text-[10px] leading-[13px]">
            AV CALLE 43 SUR #79A-33
            <br />
            WHATSAPP 324 333 4009
          </p>
        </div>

        <div className="thermal-rule mt-rule my-3" />

        <div className="text-center">
          <p className="receipt-date text-[10px]">
            {receiptDateTime(order.createdAt)}
          </p>
          <p className="receipt-order-label mt-2 text-[11px] font-black">
            PEDIDO N.º
          </p>
          <p className="receipt-order-code mt-1 text-[28px] font-black leading-none">
            {displayCode}
          </p>
          <div className="receipt-mode mx-auto mt-2 inline-block border-[2px] border-black px-4 py-1 text-[14px] font-black">
            {fulfillmentLabel(order.fulfillmentType)}
          </div>
        </div>

        <div className="thermal-rule mt-rule my-3" />

        <section>
          <p className="receipt-section-title text-[13px] font-black">
            CLIENTE
          </p>

          <p className="receipt-customer-name text-[15px] font-black">
            {order.customer?.name?.toUpperCase() || "CLIENTE OCASIONAL"}
          </p>

          {order.customer?.phone && (
            <p className="receipt-phone mt-1 text-[11px] font-bold">
              {order.customer.countryCode}
              {order.customer.phone}
            </p>
          )}

          {isDelivery && deliveryAddress && (
            <p className="receipt-address">
              {deliveryAddress}
            </p>
          )}

          {isDelivery && deliveryInstructions && (
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
        </section>

        <div className="thermal-rule mt-rule my-3" />

        <section>
          <p className="receipt-section-title text-[13px] font-black">
            DETALLE DEL PEDIDO
          </p>

          <div className="space-y-3">
            {order.items.map((item) => {
              const breakdown = itemReceiptBreakdown(item);

              return (
                <div key={item.id} className="receipt-item">
                  <div className="receipt-line grid grid-cols-[1fr_auto] gap-2">
                    <span className="receipt-product text-[12px] font-black">
                      {item.quantity} × {item.productName.toUpperCase()}
                    </span>
                    <span className="receipt-price text-[12px] font-black">
                      $ {money(breakdown.baseLineTotal)}
                    </span>
                  </div>

                  {breakdown.details.length > 0 && (
                    <div className="receipt-details ml-[13px] mt-1">
                      {breakdown.details.map((detail, index) => (
                        <p
                          key={`${detail.label}-${index}`}
                          className="receipt-detail text-[11px] leading-[14px]"
                        >
                          <span className="font-bold">
                            {detail.label.toUpperCase()}:
                          </span>{" "}
                          {detail.value.toUpperCase()}
                        </p>
                      ))}
                    </div>
                  )}

                  {breakdown.crust && (
                    <div className="receipt-crust ml-[13px] mt-1 grid grid-cols-[1fr_auto] gap-2 text-[11px] leading-[14px]">
                      <span>
                        <span className="font-bold">BORDE:</span>{" "}
                        {breakdown.crust.name.toUpperCase()}
                      </span>
                      {breakdown.crustTotal > 0 && (
                        <span className="font-black">
                          $ {money(breakdown.crustTotal)}
                        </span>
                      )}
                    </div>
                  )}

                  {item.notes && (
                    <div className="receipt-note ml-[13px] mt-1 border-[2px] border-black px-2 py-1">
                      <p className="text-[10px] font-black">
                        NOTA COCINA: {item.notes.toUpperCase()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="thermal-rule mt-rule my-3" />

        <section className="receipt-totals space-y-1 text-[13px] font-black">
          <div className="receipt-total-row flex justify-between">
            <span>SUBTOTAL</span>
            <span>$ {money(order.subtotal)}</span>
          </div>
          <div className="receipt-total-row flex justify-between">
            <span>DOMICILIO</span>
            <span>$ {money(order.deliveryFee)}</span>
          </div>
          <div className="receipt-total-row flex justify-between">
            <span>DESCUENTO</span>
            <span>-$ {money(order.discount)}</span>
          </div>

          <div className="receipt-grand-total mt-2 flex items-end justify-between border-t-[2px] border-black pt-2 text-[20px]">
            <span>TOTAL</span>
            <span>$ {money(order.total)}</span>
          </div>
        </section>

        <div className="receipt-payment mt-3 border-[2px] border-black px-3 py-2 text-center">
          <p className="receipt-payment-label text-[10px] font-black uppercase tracking-[0.08em]">
            ESTADO DE PAGO
          </p>
          <p className="receipt-payment-value mt-1 text-[15px] font-black">
            {paidInFull
              ? `PAGADO $ ${money(paidTotal)}`
              : `PENDIENTE $ ${money(pendingBalance)}`}
          </p>

          {!paidInFull && (
            <>
              {pendingPayment ? (
                <p className="mt-1 text-[10px] font-bold">
                  COBRAR {pendingPayment.method.toUpperCase()} · $ {money(pendingBalance)}
                </p>
              ) : (
                <p className="mt-1 text-[10px] font-bold">
                  SIN MEDIO DE PAGO REGISTRADO
                </p>
              )}

              {pendingPayment?.cashReceived != null && (
                <p className="mt-1 text-[10px]">
                  PAGA CON $ {money(pendingPayment.cashReceived)} · VUELTAS $ {money(pendingPayment.changeDue || 0)}
                </p>
              )}
            </>
          )}
        </div>

        {order.couponName && (
          <p className="coupon mt-2 text-center text-[10px] font-bold">
            CUPÓN: {order.couponName.toUpperCase()}
          </p>
        )}

        <div className="thermal-rule mt-rule my-3" />

        <div className="receipt-footer text-center">
          <p className="receipt-footer-title text-[13px] font-black">
            ¡Gracias por elegir Alentó Pizza!
          </p>
          <p className="receipt-footer-sub mt-1 text-[10px] italic">
            Este documento es un comprobante de entrega.
          </p>
        </div>
      </div>
    </main>
  );
}
