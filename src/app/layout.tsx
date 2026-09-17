import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./pos-polish.css";
import "./product-config-polish.css";
import "./product-config-shell.css";
import "./product-card-polish.css";
import "./pos-order-panel-polish.css";
import "./pos-cart-polish.css";
import "./pos-order-drawer.css";
import "./pos-order-drawer-final.css";
import "./customer-modal-polish.css";
import "./pos-cart-line.css";
import "./checkout-modal-polish.css";
import "./checkout-actions-polish.css";
import AppShell from "@/components/AppShell";
import PwaRegister from "@/components/PwaRegister";

const ALENTO_ICON =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

export const metadata: Metadata = {
  title: "Alentó App",
  description: "Operación interna de Alentó Pizza",
  applicationName: "Alentó App",
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
