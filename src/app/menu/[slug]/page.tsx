import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  productSeoDescription,
  productSeoPath,
  SEO_BUSINESS_NAME,
  SEO_PHONE_E164,
  SEO_SHARE_IMAGE,
  SEO_SITE_URL,
} from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function productIdFromSlug(slug: string) {
  const match = slug.match(/^(\d+)(?:-|$)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getProduct(slug: string) {
  const id = productIdFromSlug(slug);
  if (!id) return null;

  const product = await prisma.product.findFirst({
    where: {
      id,
      active: true,
      visibleInPos: true,
    },
    include: {
      category: true,
    },
  });

  if (!product || product.type === "MODIFIER" || product.type === "INTERNAL") {
    return null;
  }

  return product;
}

async function productPrice(product: NonNullable<Awaited<ReturnType<typeof getProduct>>>) {
  const basePrice =
    product.basePrice == null ? null : Number(product.basePrice);

  if (
    product.type !== "PIZZA_SINGLE" &&
    product.type !== "PIZZA_CUSTOM"
  ) {
    return basePrice;
  }

  const smallestSize = await prisma.pizzaSize.findFirst({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { diameterCm: "asc" }],
  });

  if (!smallestSize) return product.type === "PIZZA_CUSTOM" ? null : basePrice;

  return product.type === "PIZZA_CUSTOM"
    ? Number(smallestSize.basePrice)
    : Number(smallestSize.basePrice) + (basePrice ?? 0);
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return {
      title: "Producto no disponible",
      robots: { index: false, follow: false },
    };
  }

  const canonical = productSeoPath(product.id, product.name);
  const description = productSeoDescription(
    product.name,
    product.description,
    product.category?.name,
  );
  const image = product.imageUrl || product.imageUrl2 || SEO_SHARE_IMAGE;

  return {
    title: `${product.name} en Kennedy, Bogotá`,
    description,
    alternates: {
      canonical,
    },
    keywords: [
      product.name,
      `${product.name} Kennedy`,
      `${product.name} Bogotá`,
      "pizza Kennedy",
      "Alentó Pizza",
      product.category?.name || "pizza",
    ],
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: canonical,
      siteName: SEO_BUSINESS_NAME,
      title: `${product.name} | Alentó Pizza`,
      description,
      images: [{ url: image, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | Alentó Pizza`,
      description,
      images: [image],
    },
  };
}

export default async function ProductSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const canonicalPath = productSeoPath(product.id, product.name);
  if (slug !== canonicalPath.replace("/menu/", "")) {
    permanentRedirect(canonicalPath);
  }

  const price = await productPrice(product);
  const description = productSeoDescription(
    product.name,
    product.description,
    product.category?.name,
  );
  const image = product.imageUrl || product.imageUrl2 || SEO_SHARE_IMAGE;
  const canonicalUrl = `${SEO_SITE_URL}${canonicalPath}`;
  const menuAnchor = `/menu#producto-${product.id}`;
  const whatsappText = encodeURIComponent(
    `Hola, quiero pedir ${product.name} de Alentó Pizza.`,
  );

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: product.name,
    description,
    image: [image, product.imageUrl2].filter(Boolean),
    sku: String(product.id),
    category: product.category?.name,
    brand: {
      "@type": "Brand",
      name: SEO_BUSINESS_NAME,
    },
    url: canonicalUrl,
    ...(price != null && price > 0
      ? {
          offers: {
            "@type": "Offer",
            url: canonicalUrl,
            priceCurrency: "COP",
            price,
            availability: "https://schema.org/InStock",
            seller: {
              "@id": `${SEO_SITE_URL}/#business`,
            },
          },
        }
      : {}),
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
        name: "Menú",
        item: `${SEO_SITE_URL}/menu`,
      },
      ...(product.category
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: product.category.name,
              item: `${SEO_SITE_URL}/menu/categoria/${product.category.slug}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: product.category ? 4 : 3,
        name: product.name,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#090909] px-4 pb-24 pt-8 text-white sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([productJsonLd, breadcrumbJsonLd]).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />

      <div className="mx-auto max-w-[980px]">
        <nav
          aria-label="Ruta de navegación"
          className="mb-5 flex flex-wrap items-center gap-2 text-[11px] text-white/45"
        >
          <Link href="/" className="transition hover:text-white">
            Alentó Pizza
          </Link>
          <span>/</span>
          <Link href="/menu" className="transition hover:text-white">
            Menú
          </Link>
          {product.category && (
            <>
              <span>/</span>
              <Link
                href={`/menu/categoria/${product.category.slug}`}
                className="transition hover:text-white"
              >
                {product.category.name}
              </Link>
            </>
          )}
        </nav>

        <article className="overflow-hidden rounded-[30px] border border-white/10 bg-[#121212] shadow-[0_28px_90px_rgba(0,0,0,.35)]">
          <div className="grid lg:grid-cols-[1.05fr_.95fr]">
            <div className="aspect-square overflow-hidden bg-white">
              <img
                src={image}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col p-6 sm:p-8 lg:p-10">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff454b]">
                {product.category?.name || "Menú Alentó"}
              </p>

              <h1 className="mt-3 text-[36px] font-black leading-[.98] tracking-[-0.045em] sm:text-[48px]">
                {product.name}
              </h1>

              <p className="mt-5 text-[13px] leading-6 text-white/58">
                {product.description ||
                  `Disfruta ${product.name} en Alentó Pizza, preparado para pedir en Kennedy, Bogotá.`}
              </p>

              {price != null && price > 0 && (
                <div className="mt-7">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/38">
                    {product.type === "PIZZA_SINGLE" || product.type === "PIZZA_CUSTOM" ? "Desde" : "Precio"}
                  </span>
                  <strong className="mt-1 block text-[30px] font-black tracking-[-0.04em] text-[#ff3439]">
                    {money(price)}
                  </strong>
                </div>
              )}

              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                <Link
                  href={menuAnchor}
                  className="flex h-12 items-center justify-center rounded-full bg-[#e21a22] px-5 text-[11px] font-black text-white transition hover:bg-[#f01f28]"
                >
                  Configurar y pedir
                </Link>
                <a
                  href={`https://wa.me/${SEO_PHONE_E164.replace("+", "")}?text=${whatsappText}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-5 text-[11px] font-black text-white/80 transition hover:bg-white/[0.09]"
                >
                  Consultar por WhatsApp
                </a>
              </div>

              <div className="mt-auto pt-8">
                <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-4">
                  <b className="text-[12px]">Alentó Pizza · Kennedy, Bogotá</b>
                  <p className="mt-1 text-[10px] leading-5 text-white/42">
                    Disponible para recogida y domicilio según cobertura y horario del local.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <section className="mt-5 rounded-[24px] border border-white/10 bg-[#111] p-5 sm:p-6">
          <h2 className="text-[19px] font-black tracking-[-0.03em]">
            ¿Buscas más sabores?
          </h2>
          <p className="mt-2 max-w-[640px] text-[11px] leading-5 text-white/45">
            Explora el menú completo de pizzas, combos, antojos y bebidas de Alentó Pizza.
          </p>
          <Link
            href="/menu"
            className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.09]"
          >
            Ver menú completo →
          </Link>
        </section>
      </div>
    </main>
  );
}
