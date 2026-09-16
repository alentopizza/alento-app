export type PresentedDetail = {
  label: string;
  value: string;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fromPosSnapshot(detail: string): PresentedDetail[] {
  const parts = detail.split("·").map((part) => part.trim()).filter(Boolean);
  const result: PresentedDetail[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    const colon = part.indexOf(":");
    if (colon > 0) {
      const label = part.slice(0, colon).trim();
      const value = part.slice(colon + 1).trim();
      result.push({ label, value });
      continue;
    }
    if (lower.startsWith("borde ")) {
      result.push({ label: "Borde", value: part.slice(6).trim() });
      continue;
    }
    if (part.startsWith("+ ")) {
      result.push({ label: "Extra", value: part.slice(2).trim() });
      continue;
    }
    if (part.includes("½") && part.includes("+")) {
      const flavors = part.split("+").map((value) => value.replace(/½/g, "").trim()).filter(Boolean);
      flavors.forEach((value, index) => result.push({ label: `Sabor ${index + 1}`, value }));
      continue;
    }
    if (/^(personal|mediana|grande|extra)/i.test(part)) {
      result.push({ label: "Tamaño", value: part });
      continue;
    }
    result.push({ label: "Detalle", value: part });
  }

  return result;
}

export function presentOrderItemConfiguration(configuration: unknown): PresentedDetail[] {
  if (!isObject(configuration)) return [];
  const kind = text(configuration.kind).toUpperCase();

  if (kind === "PIZZA") {
    const result: PresentedDetail[] = [];
    if (isObject(configuration.size)) {
      const name = text(configuration.size.name);
      if (name) result.push({ label: "Tamaño", value: name });
    }
    if (Array.isArray(configuration.flavors)) {
      configuration.flavors.forEach((flavor, index) => {
        if (isObject(flavor)) {
          const name = text(flavor.name);
          if (name) result.push({ label: `Sabor ${index + 1}`, value: name });
        }
      });
    }
    if (isObject(configuration.crust)) {
      const name = text(configuration.crust.name);
      if (name) result.push({ label: "Borde", value: name });
    }
    if (Array.isArray(configuration.modifiers)) {
      configuration.modifiers.forEach((modifier) => {
        if (isObject(modifier)) {
          const name = text(modifier.name);
          if (name) result.push({ label: "Extra", value: name });
        }
      });
    }
    return result;
  }

  if (kind === "COMBO") {
    const result: PresentedDetail[] = [];
    if (Array.isArray(configuration.pizzas)) {
      configuration.pizzas.forEach((pizza, index) => {
        if (!isObject(pizza)) return;
        const size = isObject(pizza.size) ? text(pizza.size.name) : "";
        const flavor = isObject(pizza.flavor) ? text(pizza.flavor.name) : "";
        const value = [size, flavor].filter(Boolean).join(" · ");
        if (value) result.push({ label: `Pizza ${index + 1}`, value });
      });
    }
    if (Array.isArray(configuration.groups)) {
      configuration.groups.forEach((group) => {
        if (!isObject(group)) return;
        const label = text(group.name) || "Opción";
        const selections = Array.isArray(group.selections)
          ? group.selections.flatMap((selection) => isObject(selection) && text(selection.name) ? [text(selection.name)] : [])
          : [];
        if (selections.length) result.push({ label, value: selections.join(", ") });
      });
    }
    return result;
  }

  if (kind === "POS_SNAPSHOT") {
    const detail = text(configuration.detail);
    return detail ? fromPosSnapshot(detail) : [];
  }

  return [];
}

export function orderItemDetailText(configuration: unknown) {
  return presentOrderItemConfiguration(configuration)
    .map((detail) => `${detail.label}: ${detail.value}`)
    .join(" · ");
}
