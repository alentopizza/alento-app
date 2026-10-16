import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStoreSeoData } from "@/lib/publicStoreSeo";
import {
  SEO_BUSINESS_NAME,
  SEO_PHONE_E164,
  SEO_SHARE_IMAGE,
  SEO_SITE_URL,
} from "@/lib/seo";

const DESCRIPTION =
  "Pide domicilio de pizza en Kennedy, Bogotá con Alentó Pizza. La tarifa se calcula automáticamente según tu ubicación y cobertura disponible.";

export const metadata: Metadata = {
  title: "Domicilios de pizza en Kennedy, Bogotá",
  description: DESCRIPTION,
  alternates: {
    canonical: "/domicilios",
  },
  keywords: [
    "domicilios de pizza Kennedy",
    "pizza a domicilio Kennedy",
    "pizza domicilio Bogotá",
    "pedir pizza Kennedy",
    "domicilio Alentó Pizza",
    "pizza Nuevo Kennedy",
  ],
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "/domicilios",
    siteName: SEO_BUSINESS_NAME,
    title: "Domicilios de pizza en Kennedy | Alentó Pizza",
    description: DESCRIPTION,
    images: [{ url: SEO_SHARE_IMAGE, alt: "Domicilios de Alentó Pizza" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Domicilios de pizza en Kennedy | Alentó Pizza",
    description: DESCRIPTION,
    images: [SEO_SHARE_IMAGE],
  },
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function distance(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString("es-CO", {
      maximumFractionDigits: 1,
    })} km`;
  }
  return `${Math.round(value)} m`;
}

export default async function DeliverySeoPage() {
  const store = await getPublicStoreSeoData();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Alentó Pizza",
        item: SEO_SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Domicilios",
        item: `${SEO_SITE_URL}/domicilios`,
      },
    ],
  };

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Domicilio de Alentó Pizza",
    description: DESCRIPTION,
    provider: {
      "@id": `${SEO_SITE_URL}/#business`,
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Kennedy, Bogotá",
    },
    url: `${SEO_SITE_URL}/domicilios`,
    serviceType: "Domicilio de pizza",
  };

  return (
    <main className="min-h-screen bg-[#090909] px-4 pb-24 pt-8 text-white sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbJsonLd, serviceJsonLd]).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />

      <div className="mx-auto max-w-[980px]">
        <nav className="mb-5 flex items-center gap-2 text-[11px] text-white/45">
          <Link href="/" className="transition hover:text-white">
            Alentó Pizza
          </Link>
          <span>/</span>
          <span className="text-white/70">Domicilios</span>
        </nav>

        <header className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_90%_0%,rgba(226,26,34,.25),transparent_32%),linear-gradient(135deg,#171113,#090909_65%)] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff454b]">
            Domicilios · Kennedy, Bogotá
          </p>
          <h1 className="mt-2 max-w-[760px] text-[36px] font-black leading-[.98] tracking-[-0.045em] sm:text-[48px]">
            Pide tu pizza a domicilio con Alentó
          </h1>
          <p className="mt-4 max-w-[720px] text-[12px] leading-6 text-white/52">
            Ingresa tu dirección al finalizar el pedido. Alentó calcula automáticamente la
            cobertura, distancia y tarifa antes de confirmar la compra.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/menu"
              className="rounded-full bg-[#e21a22] px-5 py-3 text-[10px] font-black text-white"
            >
              Pedir ahora
            </Link>
            <Link
              href="/ubicacion"
              className="rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-[10px] font-black text-white/80"
            >
              Ver ubicación
            </Link>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Elige tu pedido", "Selecciona pizzas, combos, antojos y bebidas desde el menú."],
            ["02", "Ingresa tu dirección", "Calculamos la distancia desde nuestra sede y validamos cobertura."],
            ["03", "Confirma la entrega", "Antes de pagar verás la tarifa de domicilio correspondiente."],
          ].map(([step, title, text]) => (
            <article
              key={step}
              className="rounded-[22px] border border-white/10 bg-[#121212] p-5"
            >
              <span className="text-[10px] font-black text-[#ff454b]">{step}</span>
              <h2 className="mt-2 text-[17px] font-black tracking-[-0.03em]">
                {title}
              </h2>
              <p className="mt-2 text-[10px] leading-5 text-white/42">{text}</p>
            </article>
          ))}
        </section>

        {store.deliveryBands.length > 0 && (
          <section className="mt-5 rounded-[24px] border border-white/10 bg-[#121212] p-5 sm:p-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
                Cobertura configurada
              </p>
              <h2 className="mt-2 text-[21px] font-black tracking-[-0.035em]">
                Tarifas según distancia
              </h2>
              <p className="mt-2 max-w-[720px] text-[10px] leading-5 text-white/42">
                La tarifa final se calcula con tu ubicación exacta al continuar el pedido.
              </p>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {store.deliveryBands.map((band) => (
                <div
                  key={band.id}
                  className="flex items-center justify-between gap-4 rounded-[16px] border border-white/[0.08] bg-white/[0.025] px-4 py-3.5"
                >
                  <div>
                    <b className="block text-[11px] text-white/82">{band.name}</b>
                    <span className="mt-1 block text-[9px] text-white/38">
                      {distance(band.minMeters)} a {distance(band.maxMeters)}
                    </span>
                  </div>
                  <strong className="text-[13px] text-[#ff454b]">
                    {band.fee === 0 ? "Sin costo" : money(band.fee)}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-white/10 bg-[#121212] p-5 sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
              Sede
            </p>
            <h2 className="mt-2 text-[19px] font-black tracking-[-0.03em]">
              Salimos desde Nuevo Kennedy
            </h2>
            <p className="mt-3 text-[11px] leading-5 text-white/48">
              {store.address}
            </p>
            <Link
              href="/ubicacion"
              className="mt-4 inline-flex text-[10px] font-black text-[#ff454b]"
            >
              Dirección y horarios →
            </Link>
          </article>

          <article className="rounded-[24px] border border-white/10 bg-[#121212] p-5 sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
              ¿Necesitas ayuda?
            </p>
            <h2 className="mt-2 text-[19px] font-black tracking-[-0.03em]">
              Escríbenos por WhatsApp
            </h2>
            <p className="mt-3 text-[11px] leading-5 text-white/48">
              Si tienes dudas sobre cobertura o tu pedido, nuestro canal oficial está disponible para ayudarte.
            </p>
            <a
              href={`https://wa.me/${SEO_PHONE_E164.replace("+", "")}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-[10px] font-black text-[#ff454b]"
            >
              Abrir WhatsApp →
            </a>
          </article>
        </section>
      </div>
    </main>
  );
}
