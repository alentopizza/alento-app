import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStoreSeoData } from "@/lib/publicStoreSeo";
import {
  SEO_BUSINESS_NAME,
  SEO_PHONE_DISPLAY,
  SEO_PHONE_E164,
  SEO_SHARE_IMAGE,
  SEO_SITE_URL,
} from "@/lib/seo";

const DESCRIPTION =
  "Encuentra Alentó Pizza en Nuevo Kennedy, Bogotá. Consulta dirección, horarios, WhatsApp y pide pizzas, combos y antojos para recogida o domicilio.";

export const metadata: Metadata = {
  title: "Ubicación y horarios en Kennedy, Bogotá",
  description: DESCRIPTION,
  alternates: {
    canonical: "/ubicacion",
  },
  keywords: [
    "Alentó Pizza Kennedy",
    "pizzería Kennedy Bogotá",
    "pizza Nuevo Kennedy",
    "pizza cerca de Kennedy",
    "pizzería Nuevo Kennedy",
    "pizza Bogotá Kennedy",
  ],
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "/ubicacion",
    siteName: SEO_BUSINESS_NAME,
    title: "Alentó Pizza en Kennedy | Ubicación y horarios",
    description: DESCRIPTION,
    images: [{ url: SEO_SHARE_IMAGE, alt: "Alentó Pizza en Kennedy, Bogotá" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alentó Pizza en Kennedy | Ubicación y horarios",
    description: DESCRIPTION,
    images: [SEO_SHARE_IMAGE],
  },
};

const SCHEMA_DAYS: Record<string, string> = {
  MON: "https://schema.org/Monday",
  TUE: "https://schema.org/Tuesday",
  WED: "https://schema.org/Wednesday",
  THU: "https://schema.org/Thursday",
  FRI: "https://schema.org/Friday",
  SAT: "https://schema.org/Saturday",
  SUN: "https://schema.org/Sunday",
};

export default async function LocationPage() {
  const store = await getPublicStoreSeoData();
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    store.address,
  )}`;

  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": ["Restaurant", "PizzaPlace"],
    "@id": `${SEO_SITE_URL}/#business`,
    name: SEO_BUSINESS_NAME,
    url: SEO_SITE_URL,
    image: SEO_SHARE_IMAGE,
    telephone: SEO_PHONE_E164,
    servesCuisine: ["Pizza", "Pizzería", "Comida rápida"],
    hasMenu: `${SEO_SITE_URL}/menu`,
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address,
      addressLocality: "Bogotá",
      addressRegion: "Bogotá D.C.",
      addressCountry: "CO",
    },
    ...(store.latitude != null && store.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: store.latitude,
            longitude: store.longitude,
          },
        }
      : {}),
    openingHoursSpecification: store.hours
      .filter((schedule) => schedule.enabled)
      .map((schedule) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAYS[schedule.day],
        opens: schedule.open,
        closes: schedule.close,
      })),
  };

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
        name: "Ubicación y horarios",
        item: `${SEO_SITE_URL}/ubicacion`,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#090909] px-4 pb-24 pt-8 text-white sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([businessJsonLd, breadcrumbJsonLd]).replace(
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
          <span className="text-white/70">Ubicación y horarios</span>
        </nav>

        <header className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_90%_0%,rgba(226,26,34,.25),transparent_32%),linear-gradient(135deg,#171113,#090909_65%)] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff454b]">
            Alentó Pizza · Kennedy
          </p>
          <h1 className="mt-2 max-w-[760px] text-[36px] font-black leading-[.98] tracking-[-0.045em] sm:text-[48px]">
            Tu pizzería en Nuevo Kennedy, Bogotá
          </h1>
          <p className="mt-4 max-w-[720px] text-[12px] leading-6 text-white/52">
            Visítanos, recoge tu pedido o pide domicilio según cobertura.
            Aquí encuentras nuestra dirección, horarios y contacto oficial.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/menu"
              className="rounded-full bg-[#e21a22] px-5 py-3 text-[10px] font-black text-white"
            >
              Ver menú
            </Link>
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-[10px] font-black text-white/80"
            >
              Abrir ubicación
            </a>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-white/10 bg-[#121212] p-5 sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
              Dirección
            </p>
            <h2 className="mt-2 text-[21px] font-black tracking-[-0.035em]">
              Encuéntranos en Kennedy
            </h2>
            <address className="mt-3 not-italic text-[12px] font-semibold leading-6 text-white/60">
              {store.address}
            </address>
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex text-[10px] font-black text-[#ff454b]"
            >
              Ver en Google Maps →
            </a>
          </article>

          <article className="rounded-[24px] border border-white/10 bg-[#121212] p-5 sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
              Contacto
            </p>
            <h2 className="mt-2 text-[21px] font-black tracking-[-0.035em]">
              Haz tu pedido
            </h2>
            <p className="mt-3 text-[12px] leading-6 text-white/50">
              Escríbenos por WhatsApp o pide directamente desde el menú en línea.
            </p>
            <a
              href={`https://wa.me/${SEO_PHONE_E164.replace("+", "")}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block text-[18px] font-black text-white"
            >
              {SEO_PHONE_DISPLAY}
            </a>
          </article>
        </section>

        <section className="mt-5 rounded-[24px] border border-white/10 bg-[#121212] p-5 sm:p-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff454b]">
              Horario
            </p>
            <h2 className="mt-2 text-[21px] font-black tracking-[-0.035em]">
              Horarios de atención
            </h2>
          </div>

          <div className="mt-4 overflow-hidden rounded-[18px] border border-white/10">
            {store.hours.map((schedule, index) => (
              <div
                key={schedule.day}
                className={
                  "flex items-center justify-between gap-4 px-4 py-3 " +
                  (index > 0 ? "border-t border-white/[0.07] " : "") +
                  (schedule.enabled ? "bg-white/[0.025]" : "bg-white/[0.012]")
                }
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={
                      "h-2 w-2 rounded-full " +
                      (schedule.enabled ? "bg-emerald-400" : "bg-white/20")
                    }
                  />
                  <b className="text-[11px] text-white/80">
                    {schedule.dayLabel}
                  </b>
                </div>
                <span className="text-[10px] font-bold text-white/45">
                  {schedule.rangeLabel}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-red-500/15 bg-[linear-gradient(135deg,rgba(226,26,34,.12),rgba(255,255,255,.02))] p-5 sm:p-6">
          <h2 className="text-[20px] font-black tracking-[-0.03em]">
            Pizza, combos y antojos en Kennedy
          </h2>
          <p className="mt-2 max-w-[760px] text-[11px] leading-5 text-white/45">
            Explora nuestras pizzas con masa artesanal madurada, sabores clásicos y especiales,
            combos, palitos con queso, bebidas y opciones de borde.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/menu/categoria/pizzas"
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[9px] font-bold text-white/70"
            >
              Ver pizzas
            </Link>
            <Link
              href="/domicilios"
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[9px] font-bold text-white/70"
            >
              Ver domicilios
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
