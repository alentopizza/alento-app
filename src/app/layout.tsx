import type { Metadata } from "next";
import "./globals.css";
import "./pos-polish.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Alentó App",
  description: "Operación interna de Alentó Pizza",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}