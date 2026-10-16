import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://alentopizza.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/menu", "/club", "/ubicacion", "/domicilios"],
      disallow: [
        "/api",
        "/app2",
        "/caja",
        "/cart",
        "/clientes",
        "/club-alento",
        "/cocina",
        "/configuracion",
        "/cuenta",
        "/cupones",
        "/integraciones",
        "/interno",
        "/login",
        "/masa",
        "/metricas",
        "/notificaciones",
        "/pedidos",
        "/personalizacion",
        "/repartidor",
        "/seguimiento",
        "/setup",
        "/sin-acceso",
        "/turnos",
        "/usuarios",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
