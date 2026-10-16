import type { Metadata } from "next";

const SHARE_IMAGE =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/Vyme6Gd1y8prrWS7X3wu.png";

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
