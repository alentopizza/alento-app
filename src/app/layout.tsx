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
import PwaCustomerInstallTracker from "@/components/PwaCustomerInstallTracker";
import CustomerPushPrompt from "@/components/CustomerPushPrompt";

const ALENTO_ICON =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

const ALENTO_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://alentopizza.com";

export const metadata: Metadata = {
  metadataBase: new URL(ALENTO_APP_URL),
  alternates: {
    canonical: "/",
  },
  title: "Alentó Pizza",
  description: "Pide pizzas, combos y antojos de Alentó Pizza desde tu celular.",
  applicationName: "Alentó Pizza",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: ALENTO_ICON, type: "image/png" }],
    shortcut: [{ url: ALENTO_ICON, type: "image/png" }],
    apple: [{ url: ALENTO_ICON, type: "image/png" }],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <PwaRegister />
        <PwaInstallPrompt />
        <PwaCustomerInstallTracker />
        <CustomerPushPrompt />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
