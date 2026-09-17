"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";

const LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

type Order = {
  id: number;
  status: string;
  fulfillmentType: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  couponName: string | null;
  deliveryZoneName: string | null;
  createdAt: string;
  customer: { name: string; countryCode: string; phone: string | null } | null;
  address: { address: string } | null;
  items: { id: number; productName: string; quantity: number; unitPrice: number; lineTotal: number; configuration: unknown }[];
  payments: { method: string; amount: number; cashReceived: number | null; changeDue: number | null; status: string }[];
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function fulfillmentLabel(value: string) {
  if (value === "DELIVERY") return "DOMICILIO";
  if (value === "PICKUP") return "RECOGER EN TIENDA";
  return "LOCAL";
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

  if (error) return <main className="p-8 text-red-700">{error}</main>;
  if (!order) return <main className="p-8 text-neutral-500">Cargando comprobante...</main>;

  const payment = order.payments[0];
  const code = `ALT-${String(order.id).padStart(6, "0")}`;

  return (
    <main className="thermal-page mx-auto min-h-screen bg-white px-[5mm] py-[5mm] text-black">
      {!embedded && <div className="no-print mb-4 flex justify-center gap-2">
        <button onClick={() => window.print()} className="rounded-xl bg-black px-5 py-2.5 text-sm font-black text-white">Imprimir</button>
        <button onClick={() => window.close()} className="rounded-xl border px-5 py-2.5 text-sm font-black">Cerrar</button>
      </div>}

      <div className="thermal-receipt">
        <div className="text-center">
          <img src={LOGO} alt="Alentó Pizza" className="mx-auto h-[22mm] w-[22mm] object-contain grayscale" />
          <h1 className="mt-1 text-[18px] font-black">ALENTÓ PIZZA</h1>
          <p className="text-[12px] leading-[15px]">AV CALLE 43 SUR #79A-33</p>
          <p className="text-[12px] leading-[15px]">WHATSAPP 324 333 4009</p>
        </div>

        <div className="thermal-rule my-3" />

        <div className="text-center">
          <p className="text-[11px]">{new Date(order.createdAt).toLocaleString("es-CO")}</p>
          <p className="mt-1 text-[30px] font-black leading-none">{String(order.id).padStart(4, "0")}</p>
          <p className="mt-1 text-[13px] font-black">PDV · {code}</p>
          <div className="mx-auto mt-2 inline-block border-[2px] border-black px-4 py-1 text-[16px] font-black">{fulfillmentLabel(order.fulfillmentType)}</div>
        </div>

        <div className="thermal-rule my-3" />

        <div className="text-center">
          <p className="text-[15px] font-black">{order.customer?.name?.toUpperCase() || "CLIENTE OCASIONAL"}</p>
          {order.customer?.phone && <p className="text-[12px]">{order.customer.countryCode}{order.customer.phone}</p>}
          {order.address?.address && <p className="mt-1 text-[11px] font-bold">{order.address.address}</p>}
          {order.deliveryZoneName && <p className="text-[10px]">{order.deliveryZoneName}</p>}
        </div>

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

        {payment && <>
          <div className="mt-3 border-[2px] border-black px-3 py-2 text-center">
            <p className="text-[15px] font-black">{payment.status === "PAID" ? "PAGADO" : "PAGO PENDIENTE"} - $ {money(payment.amount)}</p>
            <p className="mt-1 text-[11px] font-bold">{payment.method.toUpperCase()}</p>
            {payment.cashReceived != null && <p className="mt-1 text-[11px]">PAGA CON $ {money(payment.cashReceived)} · VUELTAS $ {money(payment.changeDue || 0)}</p>}
          </div>
        </>}

        {order.couponName && <p className="mt-2 text-center text-[10px] font-bold">CUPÓN: {order.couponName.toUpperCase()}</p>}

        <div className="thermal-rule my-3" />
        <div className="text-center"><p className="text-[13px] font-black">¡Gracias por elegir Alentó Pizza!</p><p className="mt-1 text-[10px] italic">Este documento es un comprobante de entrega.</p></div>
      </div>
    </main>
  );
}