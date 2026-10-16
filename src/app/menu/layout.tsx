import type { Metadata } from "next";

const SHARE_IMAGE =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/Vyme6Gd1y8prrWS7X3wu.png";

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
