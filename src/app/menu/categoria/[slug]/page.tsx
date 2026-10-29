import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  categorySeoDescription,
  productSeoPath,
  SEO_BUSINESS_NAME,
  SEO_SHARE_IMAGE,
  SEO_SITE_URL,
} from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getCategory(slug: string) {
  const category = await prisma.category.findFirst({
    where: {
      slug,
      active: true,
      visibleInPos: true,
    },
    include: {
      products: {
        where: {
          active: true,
          visibleInPos: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!category) return null;

  return {
    ...category,
    products: category.products.filter(
      (product) => product.type !== "MODIFIER" && product.type !== "INTERNAL",
    ),
  };
}

type SeoCategory = NonNullable<Awaited<ReturnType<typeof getCategory>>>;

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,,
    maximumFractionDigits: 0,
  }).format(value);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    return {
      title: "Categoría no disponible",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `/menu/categoria/${category.slug}`;
  const description = categorySeoDescription(category.name);
  const image =
    category.imageUrl ||
    category.products.find((product) => product.imageUrl)?.imageUrl ||
    SEO_SHARE_IMAGE;

  return {
    title: `${category.name} en Kennedy, Bogotá`,
    description,
    alternates: {
      canonical,
    },
    keywords: [
      category.name,
      `${category.name} Kennedy`,
      `${category.name} Bogotá`,
      "Alentó Pizza",
      "domicilio Kennedy",
      "pizzería Kennedy",
    ],
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: canonical,
      siteName: SEO_BUSINESS_NAME,
      title: `${category.name} | Alentó Pizza`,
      description,
      images: [{ url: image, alt: `${category.name} de Alentó Pizza` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name} | Alentó Pizza`,
      description,
      images: [image],
    },
  };
}

export default async function CategorySeoPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) notFound();

  const canonicalUrl = `${SEO_SITE_URL}/menu/categoria/${category.slug}`;
  const description = categorySeoDescription(category.name);
  const smallestPizzaSize = await prisma.pizzaSize.findFirst({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { diameterCm: "asc" }],
  });

  function displayProductPrice(product: SeoCategory["products"][number]) {
    if (product.basePrice == null) return null;
    const base = Number(product.basePrice);

    if (product.type === "PIZZA_SINGLE" && smallestPizzaSize) {
      return Number(smallestPizzaSize.basePrice) + base;
    }

    if (product.type === "PIZZA_CUSTOM") {
      return null;
    }

    return base;
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.name} de Alentó Pizza`,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: category.products.length,
    itemListElement: category.products.map((product, index) => {
      const price = displayProductPrice(product);
      const url = `${SEO_SITE_URL}${productSeoPath(product.id, product.name)}`;

      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: product.name,
          url,
          ...(product.description ? { description: product.description } : {}),
          ...(product.imageUrl ? { image: product.imageUrl } : {}),
          brand: {
            "@type": "Brand",
            name: SEO_BUSINESS_NAME,
          },
          ...(price != null && price > 0
            ? {
                offers: {
                  "@type": "Offer",
                  url,
                  priceCurrency: "COP",
                  price,
                  availability: "https://schema.org/InStock",
                },
              }
            : {}),
        },
      };
    }),
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
      {
        "@type": "ListItem",
        position: 3,
        name: category.name,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#090909] px-4 pb-24 pt-8 text-white sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([itemListJsonLd, breadcrumbJsonLd]).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />

      <div className="mx-auto max-w-[1120px]">
        <nav
          aria-label="Ruta de navegación"
          className="mb-5 flex items-center gap-2 text-[11px] text-white/45"
        >
          <Link href="/" className="transition hover:text-white">
            Alentó Pizza
          </Link>
          <span>/</span>
          <Link href="/menu" className="transition hover:text-white">
            Menú
          </Link>
          <span>/</span>
          <span className="text-white/70">{category.name}</span>
        </nav>

        <header className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_90%_0%,rgba(226,26,34,.22),transparent_32%),linear-gradient(135deg,#171113,#090909_65%)] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff454b]">
            Menú Alentó
          </p>
          <h1 className="mt-2 text-[36px] font-black leading-none tracking-[-0.045em] sm:text-[48px]">
            {category.name} en Kennedy, Bogotá
          </h1>
          <p className="mt-4 max-w-[720px] text-[12px] leading-6 text-white/52">
            {description}
          </p>
          <Link
            href={`/menu#categoria-${category.slug}`}
            className="mt-5 inline-flex rounded-full bg-[#e21a22] px-5 py-3 text-[10px] font-black text-white transition hover:bg-[#f01f28]"
          >
            Pedir desde el menú
          </Link>
        </header>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-black tracking-[-0.035em]">
                Opciones disponibles
              </h2>
              <p className="mt-1 text-[10px] text-white/38">
                {category.products.length} producto
                {category.products.length === 1 ? "" : "s"} en esta categoría.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {category.products.map((product) => (
              <Link
                key={product.id}
                href={productSeoPath(product.id, product.name)}
                className="group overflow-hidden rounded-[20px] border border-white/10 bg-[#131313] transition hover:-translate-y-0.5 hover:border-white/18"
              >
                <div className="aspect-square overflow-hidden bg-white">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">
                      🍕
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <h3 className="text-[13px] font-black leading-tight">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="mt-1.5 line-clamp-2 text-[9px] leading-4 text-white/38">
                      {product.description}
                    </p>
                  )}
                  {displayProductPrice(product) != null &&
                    Number(displayProductPrice(product)) > 0 && (
                      <b className="mt-3 block text-[13px] text-[#ff3439]">
                        {product.type === "PIZZA_SINGLE" || product.type === "PIZZA_CUSTOM" ? "Desde " : ""}
                        {money(Number(displayProductPrice(product)))}
                      </b>
                    )}
                  <span className="mt-3 inline-flex text-[9px] font-bold text-white/55">
                    Ver producto →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {!category.products.length && (
            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-10 text-center text-white/45">
              No hay productos disponibles en esta categoría.
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[24px] border border-white/10 bg-[#111] p-5 sm:p-6">
          <h2 className="text-[18px] font-black tracking-[-0.03em]">
            Pide Alentó Pizza en Kennedy
          </h2>
          <p className="mt-2 max-w-[760px] text-[11px] leading-5 text-white/45">
            Haz tu pedido en línea y elige domicilio o recogida según disponibilidad y cobertura.
            También puedes explorar pizzas, combos, antojos y bebidas desde el menú completo.
          </p>
          <Link
            href="/menu"
            className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.09]"
          >
            Ver todo el menú →
          </Link>
        </section>
      </div>
    </main>
  );
}
