import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./pos-polish.css";
import "./product-config-polish.css";
import "./product-config-shell.css";
import "./product-card-polish.css";
import "./pos-order-panel-polish.css";
import "./pos-customer-card.css";
import "./pos-cart-polish.css";
import "./pos-order-drawer.css";
import "./pos-order-drawer-final.css";
import "./customer-modal-polish.css";
import "./pos-cart-line.css";
import "./checkout-modal-polish.css";
import "./checkout-actions-polish.css";
import "./orders-fulfillment-badges.css";
import "./orders-card-typography.css";
import "./orders-card-payment-summary.css";
import "./orders-detail-drawer-compact.css";
import "./orders-canceled-card.css";
import AppShell from "@/components/AppShell";
import PwaRegister from "@/components/PwaRegister";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import CustomerPushPrompt from "@/components/CustomerPushPrompt";
import {
  SEO_ADDRESS,
  SEO_BUSINESS_NAME,
  SEO_CITY,
  SEO_ICON,
  SEO_LOCALITY,
  SEO_PHONE_E164,
  SEO_SHARE_IMAGE,
  SEO_SITE_URL,
} from "@/lib/seo";

const ALENTO_ICON = SEO_ICON;
const ALENTO_APP_URL = SEO_SITE_URL;
const ALENTO_SHARE_IMAGE = SEO_SHARE_IMAGE;

const ALENTO_DESCRIPTION =
  "Pide pizzas, combos, antojos y bebidas en Alentó Pizza. Domicilios y recogida en Kennedy, Bogotá. Consulta el menú y haz tu pedido en línea.";

export const metadata: Metadata = {
  metadataBase: new URL(ALENTO_APP_URL),
  title: {
    default: "Alentó Pizza | Pizzería en Kennedy, Bogotá",
    template: "%s | Alentó Pizza",
  },
  description: ALENTO_DESCRIPTION,
  applicationName: "Alentó Pizza",
  category: "food",
  keywords: [
    "Alentó Pizza",
    "pizza Kennedy",
    "pizza Bogotá",
    "pizzería Kennedy",
    "pizza a domicilio Kennedy",
    "domicilios de pizza Bogotá",
    "pizza Nuevo Kennedy",
    "combos de pizza",
    "pizza con borde relleno",
  ],
  authors: [{ name: "Alentó Pizza", url: ALENTO_APP_URL }],
  creator: "Alentó Pizza",
  publisher: "Alentó Pizza",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
      : {}),
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: ALENTO_ICON, type: "image/png" }],
    shortcut: [{ url: ALENTO_ICON, type: "image/png" }],
    apple: [{ url: ALENTO_ICON, type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: ALENTO_APP_URL,
    siteName: "Alentó Pizza",
    title: "Alentó Pizza | Pizzería en Kennedy, Bogotá",
    description: ALENTO_DESCRIPTION,
    images: [
      {
        url: ALENTO_SHARE_IMAGE,
        alt: "Alentó Pizza - Sabor Que Te Hace Volver",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alentó Pizza | Pizzería en Kennedy, Bogotá",
    description: ALENTO_DESCRIPTION,
    images: [ALENTO_SHARE_IMAGE],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alentó",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  colorScheme: "light",
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${ALENTO_APP_URL}/#website`,
      url: ALENTO_APP_URL,
      name: SEO_BUSINESS_NAME,
      inLanguage: "es-CO",
      publisher: {
        "@id": `${ALENTO_APP_URL}/#business`,
      },
    },
    {
      "@type": ["Restaurant", "PizzaPlace"],
      "@id": `${ALENTO_APP_URL}/#business`,
      name: SEO_BUSINESS_NAME,
      url: ALENTO_APP_URL,
      logo: ALENTO_ICON,
      image: ALENTO_SHARE_IMAGE,
      telephone: SEO_PHONE_E164,
      slogan: "Sabor Que Te Hace Volver",
      servesCuisine: ["Pizza", "Pizzería", "Comida rápida"],
      hasMenu: `${ALENTO_APP_URL}/menu`,
      address: {
        "@type": "PostalAddress",
        streetAddress: SEO_ADDRESS,
        addressLocality: SEO_CITY,
        addressRegion: "Bogotá D.C.",
        addressCountry: "CO",
      },
      areaServed: {
        "@type": "AdministrativeArea",
        name: `${SEO_LOCALITY}, ${SEO_CITY}`,
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(siteJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <PwaRegister />
        <PwaInstallPrompt />
        <CustomerPushPrompt />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
