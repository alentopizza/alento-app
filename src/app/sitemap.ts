import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { productSeoPath, SEO_SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: {
        active: true,
        visibleInPos: true,
        slug: { notIn: ["insumos", "ingredientes", "destacados"] },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: {
        active: true,
        visibleInPos: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  const publicProducts = products.filter(
    (product) => product.type !== "MODIFIER" && product.type !== "INTERNAL",
  );

  return [
    {
      url: SEO_SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SEO_SITE_URL}/menu`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SEO_SITE_URL}/club`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SEO_SITE_URL}/ubicacion`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SEO_SITE_URL}/domicilios`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...categories.map((category) => ({
      url: `${SEO_SITE_URL}/menu/categoria/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...publicProducts.map((product) => ({
      url: `${SEO_SITE_URL}${productSeoPath(product.id, product.name)}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: product.type === "PIZZA_SINGLE" || product.type === "COMBO" ? 0.9 : 0.75,
    })),
  ];
}
