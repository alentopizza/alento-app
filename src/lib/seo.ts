export const SEO_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://alentopizza.com";

export const SEO_ICON =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

// Imagen oficial de marca para WhatsApp/Open Graph.
// El sufijo versionado fuerza a los crawlers sociales a refrescar la miniatura.
export const SEO_SHARE_IMAGE = `${SEO_ICON}?v=alento-official-20261016`;

export const SEO_BUSINESS_NAME = "Alentó Pizza";
export const SEO_PHONE_DISPLAY = "324 333 4009";
export const SEO_PHONE_E164 = "+573243334009";
export const SEO_ADDRESS = "Av. Calle 43 Sur #79A-33, Nuevo Kennedy Sector 3, Bogotá D.C.";
export const SEO_CITY = "Bogotá";
export const SEO_LOCALITY = "Kennedy";

export function slugifySeo(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productSeoPath(id: number, name: string) {
  return `/menu/${id}-${slugifySeo(name)}`;
}

export function productSeoDescription(
  name: string,
  description: string | null,
  categoryName?: string | null,
) {
  const base = description?.trim();
  if (base) {
    return `${base} Pídela en Alentó Pizza, Kennedy, Bogotá, para domicilio o recogida.`;
  }

  const category = categoryName ? ` de ${categoryName.toLowerCase()}` : "";
  return `${name}${category} en Alentó Pizza. Haz tu pedido en línea para domicilio o recogida en Kennedy, Bogotá.`;
}

export function categorySeoDescription(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes("pizza")) {
    return "Pizzas artesanales con masa madurada, queso mozzarella y sabores para todos los gustos. Pide Alentó Pizza en Kennedy, Bogotá.";
  }

  if (normalized.includes("combo") || normalized.includes("destacad")) {
    return "Combos y promociones de Alentó Pizza para compartir. Consulta opciones, precios y pide en línea en Kennedy, Bogotá.";
  }

  if (normalized.includes("antojo")) {
    return "Antojos recién horneados para acompañar tu pizza. Pide palitos con queso, canelones y más en Alentó Pizza, Kennedy, Bogotá.";
  }

  if (normalized.includes("bebida")) {
    return "Bebidas frías para acompañar tu pedido de Alentó Pizza. Consulta tamaños y opciones disponibles en Kennedy, Bogotá.";
  }

  return `${name} de Alentó Pizza. Consulta el menú y pide en línea para domicilio o recogida en Kennedy, Bogotá.`;
}
