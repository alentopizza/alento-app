import type { MetadataRoute } from "next";

const ALENTO_ICON =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Alentó App",
    short_name: "Alentó",
    description: "Punto de venta y operación interna de Alentó Pizza",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f4f1",
    theme_color: "#111111",
    categories: ["business", "food", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: ALENTO_ICON,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: ALENTO_ICON,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: ALENTO_ICON,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
