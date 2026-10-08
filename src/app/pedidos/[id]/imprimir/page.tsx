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
    .replace(/,\s*Bogot[aá](?:\s*,?\s*D\.?C\.?)?.*$/i, "")
    .replace(/,\s*Colombia\s*\)?$/i, "")
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

function receiptDetailText(value: string) {
  return value
    .replace(/½/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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

function copyComputedStyles(source: Element, target: Element) {
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) {
    return;
  }

  const computed = window.getComputedStyle(source);
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    target.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);

  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index];
    if (targetChild) copyComputedStyles(child, targetChild);
  });
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(new Error("No fue posible preparar una imagen del comprobante."));
    reader.readAsDataURL(blob);
  });
}

async function inlineReceiptImages(source: HTMLElement, clone: HTMLElement) {
  const sourceImages = Array.from(source.querySelectorAll("img"));
  const cloneImages = Array.from(clone.querySelectorAll("img"));

  await Promise.all(
    sourceImages.map(async (image, index) => {
      const target = cloneImages[index];
      if (!target) return;

      const url = image.currentSrc || image.src;
      if (!url) return;

      try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) return;
        target.src = await blobToDataUrl(await response.blob());
      } catch {
        // Si un recurso externo no admite CORS, conservamos su URL original.
      }
    }),
  );
}

async function renderReceiptPng(element: HTMLElement) {
  await document.fonts?.ready;

  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        }),
    ),
  );

  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(Math.max(rect.height, element.scrollHeight));
  const clone = element.cloneNode(true) as HTMLElement;

  copyComputedStyles(element, clone);
  await inlineReceiptImages(element, clone);

  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.background = "#ffffff";

  const wrapper = document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "div",
  );
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.margin = "0";
  wrapper.style.padding = "0";
  wrapper.style.background = "#ffffff";
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgUrl = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const image = new window.Image();
    image.src = svgUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("No fue posible generar la imagen del comprobante."));
    });

    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No fue posible generar la imagen del comprobante.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(
                new Error(
                  "No fue posible guardar la imagen del comprobante.",
                ),
              ),
        "image/png",
        1,
      );
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function ThermalReceiptPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
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

  async function downloadReceiptImage() {
    if (!order || imageBusy) return;

    const receipt = document.querySelector<HTMLElement>(".thermal-receipt");
    if (!receipt) return;

    setImageBusy(true);
    setError("");

    try {
      const blob = await renderReceiptPng(receipt);
      const displayNumber = order.sequenceNumber ?? order.id;
      const displayCode = orderCode(displayNumber, order.source);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${displayCode}-factura.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No fue posible descargar la factura como imagen.",
      );
    } finally {
      setImageBusy(false);
    }
  }

  function downloadReceipt() {
    if (!order) return;
    const receipt = document.querySelector(".thermal-print-job")?.outerHTML;
    if (!receipt) return;
    const displayNumber = order.sequenceNumber ?? order.id;
    const displayCode = orderCode(displayNumber, order.source);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${displayCode}</title><style>
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;max-width:80mm;margin:0 auto;padding:4mm 5mm 6mm;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision}.thermal-receipt{width:70mm;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#000}.text-center{text-align:center}.font-black{font-weight:900}.font-bold{font-weight:700}.thermal-rule{border-top:2px dashed #000}.receipt-header img{display:block;margin:0 auto;width:16mm;height:16mm;object-fit:contain;filter:grayscale(1)}.receipt-brand{font-size:18px;font-weight:900;margin:3px 0 0}.receipt-business{font-size:11px;font-weight:700;line-height:14px;margin:1px 0 0}.receipt-whatsapp{display:block;font-size:14px;font-weight:900;line-height:17px;margin-top:2px}.receipt-date{font-size:11px;font-weight:700;margin:0}.receipt-order-code{font-size:30px;line-height:1;font-weight:900;margin:3px 0 0}.receipt-mode{display:inline-block;border:2px solid #000;padding:5px 12px;margin-top:7px;font-size:15px;font-weight:900}.receipt-section-title{font-size:14px;font-weight:900;margin:0 0 7px}.receipt-customer-block{text-align:center}.receipt-customer-name{font-size:16px;font-weight:900;margin:0;text-align:center}.receipt-phone{font-size:12px;font-weight:700;margin:3px 0 0;text-align:center}.receipt-address{font-size:12px;font-weight:700;line-height:15px;margin:5px 0 0;text-align:center}.receipt-instructions{margin:8px 0 0;border:2px solid #000;padding:7px 8px;font-size:12px;font-weight:900;line-height:16px;text-align:center;white-space:normal;overflow-wrap:anywhere}.receipt-item{margin:0 0 12px}.receipt-item:last-child{margin-bottom:0}.receipt-line{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start}.receipt-product{font-size:13px;font-weight:900;line-height:16px}.receipt-price{font-size:14px;font-weight:900;line-height:16px;white-space:nowrap}.receipt-details{margin:4px 0 0 13px}.receipt-detail{font-size:11px;font-weight:700;line-height:14px;margin:1px 0}.receipt-crust{display:grid;grid-template-columns:1fr auto;gap:8px;margin:3px 0 0 13px;font-size:12px;font-weight:700;line-height:15px}.receipt-crust-price{font-size:13px;font-weight:900;white-space:nowrap}.receipt-note{margin:5px 0 0 13px;border:2px solid #000;padding:4px 6px;font-size:11px;font-weight:900}.receipt-totals{font-size:14px;font-weight:900}.receipt-total-row{display:flex;justify-content:space-between;gap:8px;margin-top:4px}.receipt-grand-total{display:flex;justify-content:space-between;align-items:end;border-top:2px solid #000;margin-top:8px;padding-top:7px;font-size:21px;font-weight:900}.receipt-payment{margin-top:12px;border:2px solid #000;padding:8px 10px;text-align:center}.receipt-payment-label{font-size:11px;font-weight:900;letter-spacing:.08em}.receipt-payment-value{font-size:16px;font-weight:900;margin-top:4px}.receipt-footer{text-align:center}.receipt-footer-title{font-size:14px;font-weight:900;margin:0}.receipt-footer-sub{font-size:11px;font-weight:700;font-style:italic;margin:4px 0 0}.mt-rule{margin:12px 0}.coupon{font-size:11px;font-weight:700;text-align:center;margin-top:8px}.thermal-print-job{width:70mm;margin:0 auto}.thermal-sheet{width:70mm;margin:0 auto}.delivery-command{break-before:page;page-break-before:always;padding-top:4mm}.driver-head{text-align:center}.driver-head img{display:block;margin:0 auto;width:13mm;height:13mm;object-fit:contain;filter:grayscale(1)}.driver-kicker{font-size:10px;font-weight:900;letter-spacing:.08em;margin:3px 0 0}.driver-title{text-align:center;font-size:18px;font-weight:900;line-height:21px;margin:2px 0 0}.driver-order{font-size:25px;font-weight:900;line-height:1;text-align:center;margin:5px 0 0}.driver-meta{font-size:11px;font-weight:700;text-align:center;margin:4px 0 0}.driver-block{margin-top:9px;border:2px solid #000;padding:8px;text-align:center}.driver-block-soft{margin-top:7px;border:1.5px solid #000;padding:7px 8px;text-align:center}.driver-label{font-size:10px;font-weight:900;letter-spacing:.07em;text-align:center;margin:0 0 4px}.driver-value{font-size:14px;font-weight:900;line-height:17px;text-align:center;margin:0;overflow-wrap:anywhere}.driver-value-sm{font-size:12px;font-weight:800;line-height:15px;text-align:center;margin:0;overflow-wrap:anywhere}.driver-payment{margin-top:11px;border:3px solid #000;padding:9px;text-align:center}.driver-payment-title{font-size:10px;font-weight:900;letter-spacing:.09em;margin:0 0 5px}.driver-payment-state{font-size:18px;font-weight:900;line-height:21px;margin:0}.driver-payment-divider{border-top:1.5px solid #000;margin:7px 0 5px}.driver-payment-row{display:flex;justify-content:space-between;gap:8px;margin-top:5px;font-size:12px;font-weight:900;text-align:left}.driver-payment-row strong{text-align:right}.driver-digital{margin-top:11px;border:2px solid #000;padding:8px;text-align:center}.driver-digital-badge{display:inline-block;border:1.5px solid #000;padding:3px 7px;font-size:9px;font-weight:900;letter-spacing:.08em;margin-bottom:6px}.driver-digital-title{font-size:10px;font-weight:900;letter-spacing:.08em;margin:0 0 5px}.driver-digital-value{font-size:15px;font-weight:900;line-height:18px;margin:2px 0}.driver-digital-note{font-size:9px;font-weight:700;line-height:12px;margin:6px 0 0}
</style></head><body>${receipt}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      order.fulfillmentType === "DELIVERY"
        ? `${displayCode}-factura-y-comanda.html`
        : `${displayCode}-comprobante.html`;
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
      {!embedded && <div className="no-print mb-4 flex flex-wrap justify-center gap-2">
        <button onClick={() => window.print()} className="rounded-xl bg-black px-5 py-2.5 text-sm font-black text-white">Imprimir</button>
        <button
          onClick={() => void downloadReceiptImage()}
          disabled={imageBusy}
          className="rounded-xl bg-[var(--brand-red)] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
        >
          {imageBusy ? "Generando imagen..." : "Descargar imagen"}
        </button>
        <button onClick={downloadReceipt} className="rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-black text-black">Descargar HTML</button>
        <button onClick={() => window.close()} className="rounded-xl border px-5 py-2.5 text-sm font-black">Cerrar</button>
      </div>}

      <div className="thermal-print-job">
        <div className="thermal-sheet thermal-receipt">
        <div className="receipt-header text-center">
          <img
            src={LOGO}
            alt="Alentó Pizza"
            className="mx-auto h-[16mm] w-[16mm] object-contain grayscale"
          />
          <h1 className="receipt-brand mt-1 text-[17px] font-black">
            ALENTÓ PIZZA
          </h1>
          <p className="receipt-business text-[11px] font-bold leading-[14px]">
            <span className="receipt-whatsapp block text-[14px] font-black leading-[17px]">
              WHATSAPP 324 333 4009
            </span>
          </p>
        </div>

        <div className="thermal-rule mt-rule my-3" />

        <div className="text-center">
          <p className="receipt-date text-[11px] font-bold">
            {receiptDateTime(order.createdAt)}
          </p>
          <p className="receipt-order-code mt-1 text-[30px] font-black leading-none">
            {displayCode}
          </p>
          <div className="receipt-mode mx-auto mt-2 inline-block border-[2px] border-black px-4 py-1 text-[15px] font-black">
            {fulfillmentLabel(order.fulfillmentType)}
          </div>
        </div>

        <div className="thermal-rule mt-rule my-3" />

        <section className="receipt-customer-block text-center">
          <p className="receipt-customer-name text-center text-[16px] font-black">
            {order.customer?.name?.toUpperCase() || "CLIENTE OCASIONAL"}
          </p>

          {order.customer?.phone && (
            <p className="receipt-phone mt-1 text-center text-[12px] font-bold">
              {order.customer.countryCode}
              {order.customer.phone}
            </p>
          )}

          {isDelivery && deliveryAddress && (
            <p className="receipt-address text-center">
              {deliveryAddress.toUpperCase()}
            </p>
          )}

          {isDelivery && deliveryInstructions && (
            <div className="receipt-instructions mt-2 border-[2px] border-black px-2 py-2 text-center text-[12px] font-black leading-[16px]">
              {deliveryInstructions.replace(/\s+/g, " ").trim().toUpperCase()}
            </div>
          )}

          {order.notes && (
            <p className="mt-2 text-[10px] font-bold">
              NOTA: {order.notes}
            </p>
          )}
        </section>

        <div className="thermal-rule mt-rule my-3" />

        <section>
          <p className="receipt-section-title text-[14px] font-black">
            DETALLE DEL PEDIDO
          </p>

          <div className="space-y-3">
            {order.items.map((item) => {
              const breakdown = itemReceiptBreakdown(item);

              return (
                <div key={item.id} className="receipt-item">
                  <div className="receipt-line grid grid-cols-[1fr_auto] gap-2">
                    <span className="receipt-product text-[13px] font-black">
                      {item.quantity} × {item.productName.toUpperCase()}
                    </span>
                    <span className="receipt-price text-[14px] font-black">
                      $ {money(breakdown.baseLineTotal)}
                    </span>
                  </div>

                  {breakdown.details.length > 0 && (
                    <div className="receipt-details ml-[13px] mt-1">
                      {breakdown.details.map((detail, index) => (
                        <p
                          key={`${detail.label}-${index}`}
                          className="receipt-detail text-[11px] font-bold leading-[14px]"
                        >
                          <span className="font-bold">
                            {detail.label.toUpperCase()}:
                          </span>{" "}
                          {receiptDetailText(detail.value).toUpperCase()}
                        </p>
                      ))}
                    </div>
                  )}

                  {breakdown.crust && (
                    <div className="receipt-crust ml-[13px] mt-1 grid grid-cols-[1fr_auto] gap-2 text-[12px] font-bold leading-[15px]">
                      <span>
                        <span className="font-bold">BORDE:</span>{" "}
                        {breakdown.crust.name.toUpperCase()}
                      </span>
                      {breakdown.crustTotal > 0 && (
                        <span className="receipt-crust-price text-[13px] font-black">
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

        <section className="receipt-totals space-y-1 text-[14px] font-black">
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

          <div className="receipt-grand-total mt-2 flex items-end justify-between border-t-[2px] border-black pt-2 text-[21px]">
            <span>TOTAL</span>
            <span>$ {money(order.total)}</span>
          </div>
        </section>

        <div className="receipt-payment mt-3 border-[2px] border-black px-3 py-2 text-center">
          <p className="receipt-payment-label text-[11px] font-black uppercase tracking-[0.08em]">
            ESTADO DE PAGO
          </p>
          <p className="receipt-payment-value mt-1 text-[16px] font-black">
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
          <p className="receipt-footer-title text-[14px] font-black">
            ¡Gracias por elegir Alentó Pizza!
          </p>
          <p className="receipt-footer-sub mt-1 text-[11px] font-bold italic">
            Este documento es un comprobante de entrega.
          </p>
        </div>
        </div>

        {isDelivery && (
          <section className="thermal-sheet delivery-command">
            <div className="driver-head">
              <img src={LOGO} alt="Alentó Pizza" />
              <p className="driver-kicker">OPERACIÓN DE ENTREGA</p>
              <p className="driver-title">COMANDA REPARTIDOR</p>
              <p className="driver-order">{displayCode}</p>
              <p className="driver-meta">{receiptDateTime(order.createdAt)}</p>
            </div>

            <div className="thermal-rule mt-rule my-3" />

            <div className="driver-block">
              <p className="driver-label">CLIENTE</p>
              <p className="driver-value">
                {order.customer?.name?.toUpperCase() || "CLIENTE OCASIONAL"}
              </p>
              {order.customer?.phone && (
                <p className="driver-value-sm mt-1">
                  {order.customer.countryCode}
                  {order.customer.phone}
                </p>
              )}
            </div>

            <div className="driver-block">
              <p className="driver-label">DIRECCIÓN DE ENTREGA</p>
              <p className="driver-value">
                {(deliveryAddress || "SIN DIRECCIÓN REGISTRADA").toUpperCase()}
              </p>
            </div>

            {deliveryInstructions && (
              <div className="driver-block-soft">
                <p className="driver-label">INDICACIONES</p>
                <p className="driver-value-sm">
                  {deliveryInstructions.replace(/\s+/g, " ").trim().toUpperCase()}
                </p>
              </div>
            )}

            <div className="driver-payment">
              <p className="driver-payment-title">PAGO DEL PEDIDO</p>
              <p className="driver-payment-state">
                {paidInFull
                  ? `PAGADO $ ${money(paidTotal)}`
                  : `COBRAR $ ${money(pendingBalance)}`}
              </p>

              {!paidInFull && (
                <>
                  <div className="driver-payment-divider" />
                  <div className="driver-payment-row">
                    <span>MEDIO</span>
                    <strong>
                      {pendingPayment?.method?.toUpperCase() || "SIN REGISTRAR"}
                    </strong>
                  </div>

                  {pendingPayment?.cashReceived != null && (
                    <>
                      <div className="driver-payment-row">
                        <span>PAGA CON</span>
                        <strong>$ {money(pendingPayment.cashReceived)}</strong>
                      </div>
                      <div className="driver-payment-row">
                        <span>VUELTAS</span>
                        <strong>$ {money(pendingPayment.changeDue || 0)}</strong>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="driver-digital">
              <span className="driver-digital-badge">INFORMACIÓN DE APOYO</span>
              <p className="driver-digital-title">PAGO DIGITAL ALENTÓ</p>
              <p className="driver-digital-value">NEQUI 324 333 4009</p>
              <p className="driver-digital-value">LLAVE @324 333 4009</p>
              <p className="driver-digital-note">
                DATOS INFORMATIVOS PARA OFRECER AL CLIENTE SI NECESITA PAGAR DIGITALMENTE.
              </p>
            </div>

            <div className="thermal-rule mt-rule my-3" />

            <p className="text-center text-[11px] font-black">
              VERIFICAR DIRECCIÓN, PAGO Y VUELTAS ANTES DE SALIR
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
