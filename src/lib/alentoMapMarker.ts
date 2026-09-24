export const ALENTO_MAP_LOGO_URL =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

function applyBaseMarkerAccessibility(root: HTMLElement, ariaLabel: string) {
  root.setAttribute("aria-label", ariaLabel);
  root.setAttribute("role", "img");
  root.style.userSelect = "none";
  root.style.pointerEvents = "none";
}

export function orderMapPinLabel(value?: string | number | null): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.max(0, Math.trunc(value)));
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const match = normalized.match(/(\d+)\s*$/);
  if (!match) return normalized.slice(-3).toUpperCase();
  return String(Number(match[1]));
}

/** Pin oficial de Alentó Pizza para origen/tienda. */
export function createAlentoMapPinElement() {
  const root = document.createElement("div");
  applyBaseMarkerAccessibility(root, "Alentó Pizza");
  root.dataset.alentoMapMarker = "store";
  root.style.position = "relative";
  root.style.width = "54px";
  root.style.height = "62px";
  root.style.filter = "drop-shadow(0 8px 12px rgba(0,0,0,.30))";

  const pin = document.createElement("div");
  pin.style.position = "absolute";
  pin.style.left = "4px";
  pin.style.top = "2px";
  pin.style.width = "46px";
  pin.style.height = "46px";
  pin.style.borderRadius = "50% 50% 50% 0";
  pin.style.transform = "rotate(-45deg)";
  pin.style.background = "#0d0d0d";
  pin.style.border = "3px solid #ffffff";
  pin.style.boxShadow =
    "0 5px 16px rgba(0,0,0,.26), inset 0 0 0 1px rgba(255,255,255,.08)";

  const logoShell = document.createElement("div");
  logoShell.style.position = "absolute";
  logoShell.style.left = "9px";
  logoShell.style.top = "7px";
  logoShell.style.zIndex = "2";
  logoShell.style.display = "flex";
  logoShell.style.width = "36px";
  logoShell.style.height = "36px";
  logoShell.style.alignItems = "center";
  logoShell.style.justifyContent = "center";
  logoShell.style.overflow = "hidden";
  logoShell.style.borderRadius = "999px";
  logoShell.style.background = "#ffffff";
  logoShell.style.boxShadow = "0 0 0 2px rgba(255,255,255,.95)";

  const logo = document.createElement("img");
  logo.src = ALENTO_MAP_LOGO_URL;
  logo.alt = "";
  logo.draggable = false;
  logo.style.width = "32px";
  logo.style.height = "32px";
  logo.style.objectFit = "contain";

  logoShell.appendChild(logo);
  root.append(pin, logoShell);
  return root;
}

/** Pin oficial del repartidor: aro blanco, centro negro y moto. */
export function createDriverMapPinElement() {
  const root = document.createElement("div");
  applyBaseMarkerAccessibility(root, "Repartidor");
  root.dataset.alentoMapMarker = "driver";
  root.style.display = "flex";
  root.style.width = "48px";
  root.style.height = "48px";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.borderRadius = "999px";
  root.style.background = "#ffffff";
  root.style.border = "2px solid rgba(17,17,17,.08)";
  root.style.boxShadow = "0 10px 24px rgba(0,0,0,.28)";

  const inner = document.createElement("div");
  inner.style.display = "flex";
  inner.style.width = "39px";
  inner.style.height = "39px";
  inner.style.alignItems = "center";
  inner.style.justifyContent = "center";
  inner.style.borderRadius = "999px";
  inner.style.background = "#111111";
  inner.style.fontSize = "21px";
  inner.style.lineHeight = "1";
  inner.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,.08)";
  inner.textContent = "🛵";

  root.appendChild(inner);
  return root;
}

/**
 * Pin oficial del domicilio.
 * Con pedido creado muestra su consecutivo; antes de crear el pedido queda genérico.
 */
export function createDeliveryMapPinElement(orderCode?: string | number | null) {
  const label = orderMapPinLabel(orderCode);
  const root = document.createElement("div");
  applyBaseMarkerAccessibility(
    root,
    label ? `Domicilio pedido ${label}` : "Destino del domicilio",
  );
  root.dataset.alentoMapMarker = "delivery";
  root.style.position = "relative";
  root.style.width = "46px";
  root.style.height = "54px";
  root.style.filter = "drop-shadow(0 8px 12px rgba(226,26,34,.30))";

  const pin = document.createElement("div");
  pin.style.position = "absolute";
  pin.style.left = "4px";
  pin.style.top = "2px";
  pin.style.width = "38px";
  pin.style.height = "38px";
  pin.style.borderRadius = "50% 50% 50% 0";
  pin.style.transform = "rotate(-45deg)";
  pin.style.background = "#e21a22";
  pin.style.border = "2px solid #ffffff";
  pin.style.boxShadow =
    "0 6px 16px rgba(226,26,34,.32), inset 0 0 0 1px rgba(255,255,255,.12)";

  const center = document.createElement("div");
  center.style.position = "absolute";
  center.style.left = "7px";
  center.style.top = "7px";
  center.style.zIndex = "2";
  center.style.display = "flex";
  center.style.width = "32px";
  center.style.height = "32px";
  center.style.alignItems = "center";
  center.style.justifyContent = "center";
  center.style.borderRadius = "999px";
  center.style.color = "#ffffff";

  if (label) {
    center.style.fontSize = label.length >= 4 ? "9px" : "11px";
    center.style.fontWeight = "900";
    center.style.letterSpacing = "-0.02em";
    center.textContent = label;
  } else {
    const dot = document.createElement("span");
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "999px";
    dot.style.background = "#ffffff";
    dot.style.boxShadow = "0 0 0 4px rgba(255,255,255,.18)";
    center.appendChild(dot);
  }

  root.append(pin, center);
  return root;
}
