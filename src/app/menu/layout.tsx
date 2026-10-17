import type { Metadata } from "next";
import { SEO_SHARE_IMAGE } from "@/lib/seo";

const SHARE_IMAGE = SEO_SHARE_IMAGE;

const DESCRIPTION =
  "Explora el menú de Alentó Pizza: pizzas, combos, antojos, bebidas y bordes. Pide en línea para domicilio o recogida en Kennedy, Bogotá.";

export const metadata: Metadata = {
  title: "Menú de pizzas y combos en Kennedy",
  description: DESCRIPTION,
  alternates: {
    canonical: "/menu",
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "/menu",
    siteName: "Alentó Pizza",
    title: "Menú Alentó Pizza | Pizzas y combos en Kennedy",
    description: DESCRIPTION,
    images: [
      {
        url: SHARE_IMAGE,
        alt: "Menú de Alentó Pizza",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Menú Alentó Pizza | Pizzas y combos en Kennedy",
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

export default function MenuLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
