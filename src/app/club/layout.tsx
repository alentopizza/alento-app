import type { Metadata } from "next";
import { SEO_SHARE_IMAGE } from "@/lib/seo";

const SHARE_IMAGE = SEO_SHARE_IMAGE;

const DESCRIPTION =
  "Conoce Club Alentó, acumula puntos con tus compras y canjéalos por productos, bordes e ingredientes extra.";

export const metadata: Metadata = {
  title: "Club Alentó",
  description: DESCRIPTION,
  alternates: {
    canonical: "/club",
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "/club",
    siteName: "Alentó Pizza",
    title: "Club Alentó | Beneficios por tus compras",
    description: DESCRIPTION,
    images: [
      {
        url: SHARE_IMAGE,
        alt: "Club Alentó",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Club Alentó | Beneficios por tus compras",
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

export default function ClubLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
