export const ALENTO_MAP_LOGO_URL =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

/**
 * Marcador de origen para mapas públicos.
 *
 * Mantiene el logo oficial dentro de un pin oscuro para diferenciar
 * visualmente el restaurante del pin rojo del cliente.
 */
export function createAlentoMapPinElement() {
  const root = document.createElement("div");
  root.setAttribute("aria-label", "Alentó Pizza");
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
