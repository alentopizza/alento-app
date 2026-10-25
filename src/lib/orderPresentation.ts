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

function quantity(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}


export type PresentedComboPizza = {
  sizeName: string;
  sizeLabel: string;
  flavor: string;
};

export type PresentedComboGroup = {
  label: string;
  kind: string;
  values: string[];
};

export function presentComboOrderConfiguration(
  configuration: unknown,
): {
  pizzas: PresentedComboPizza[];
  groups: PresentedComboGroup[];
} | null {
  if (
    !isObject(configuration) ||
    text(configuration.kind).toUpperCase() !== "COMBO"
  ) {
    return null;
  }

  const pizzas: PresentedComboPizza[] = [];
  if (Array.isArray(configuration.pizzas)) {
    configuration.pizzas.forEach((pizza) => {
      if (!isObject(pizza)) return;

      const sizeName = isObject(pizza.size)
        ? text(pizza.size.name)
        : "";
      const diameter = isObject(pizza.size)
        ? Number(pizza.size.diameterCm)
        : Number.NaN;
      const sizeLabel = [
        sizeName,
        Number.isFinite(diameter) && diameter > 0
          ? `${diameter} cm`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const flavors = Array.isArray(pizza.flavors)
        ? pizza.flavors.flatMap((flavor) =>
            isObject(flavor) && text(flavor.name)
              ? [text(flavor.name)]
              : [],
          )
        : [];
      const legacyFlavor = isObject(pizza.flavor)
        ? text(pizza.flavor.name)
        : "";
      const flavor =
        flavors.length > 1
          ? flavors.map((name) => `½ ${name}`).join(" + ")
          : flavors[0] || legacyFlavor;

      if (sizeName || flavor) {
        pizzas.push({ sizeName, sizeLabel, flavor });
      }
    });
  }

  const groups: PresentedComboGroup[] = [];
  if (Array.isArray(configuration.groups)) {
    configuration.groups.forEach((group) => {
      if (!isObject(group)) return;

      const label = text(group.name) || "Opción";
      const kind = text(group.kind);
      const values = Array.isArray(group.selections)
        ? group.selections.flatMap((selection) => {
            if (!isObject(selection) || !text(selection.name)) return [];
            const count = quantity(selection.quantity);
            return [
              count > 1
                ? `${count} × ${text(selection.name)}`
                : text(selection.name),
            ];
          })
        : [];

      if (values.length) groups.push({ label, kind, values });
    });
  }

  return pizzas.length || groups.length ? { pizzas, groups } : null;
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
      const diameter = Number(configuration.size.diameterCm);
      if (name) result.push({ label: "Tamaño", value: Number.isFinite(diameter) && diameter > 0 ? `${name} · ${diameter} cm` : name });
    }
    if (Array.isArray(configuration.flavors)) {
      configuration.flavors.forEach((flavor, index) => {
        if (isObject(flavor)) {
          const name = text(flavor.name);
          const portion = Number(flavor.portion);
          if (name) result.push({ label: `Sabor ${index + 1}`, value: portion === 0.5 ? `½ ${name}` : name });
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
          const count = quantity(modifier.quantity);
          if (name) result.push({ label: "Extra", value: count > 1 ? `${count} × ${name}` : name });
        }
      });
    }
    return result;
  }

  if (kind === "PIZZA_CUSTOM") {
    const result: PresentedDetail[] = [];

    if (isObject(configuration.size)) {
      const name = text(configuration.size.name);
      const diameter = Number(configuration.size.diameterCm);
      if (name) {
        result.push({
          label: "Tamaño",
          value:
            Number.isFinite(diameter) && diameter > 0
              ? `${name} · ${diameter} cm`
              : name,
        });
      }
    }

    if (isObject(configuration.crust)) {
      const name = text(configuration.crust.name);
      if (name) result.push({ label: "Borde", value: name });
    }

    const mode = text(configuration.mode).toUpperCase();
    result.push({
      label: "Forma",
      value: mode === "HALF_HALF" ? "Mitad y mitad" : "Completa",
    });

    const ingredientNames = (value: unknown) =>
      Array.isArray(value)
        ? value.flatMap((ingredient) =>
            isObject(ingredient) && text(ingredient.name)
              ? [text(ingredient.name)]
              : [],
          )
        : [];

    if (mode === "HALF_HALF") {
      const first = ingredientNames(configuration.firstHalfIngredients);
      const second = ingredientNames(configuration.secondHalfIngredients);
      result.push({
        label: "Mitad 1",
        value: first.length ? first.join(", ") : "Sin ingredientes",
      });
      result.push({
        label: "Mitad 2",
        value: second.length ? second.join(", ") : "Sin ingredientes",
      });
    } else {
      const whole = ingredientNames(configuration.wholeIngredients);
      result.push({
        label: "Ingredientes",
        value: whole.length ? whole.join(", ") : "Sin ingredientes",
      });
    }

    const billable = Number(configuration.billableIngredientCount);
    const ingredientCharge = Number(configuration.ingredientCharge);
    if (Number.isFinite(billable) && billable >= 0) {
      result.push({
        label: "Ingredientes cobrados",
        value: Number.isFinite(ingredientCharge) && ingredientCharge >= 0
          ? `${billable} ingrediente${billable === 1 ? "" : "s"} · ${new Intl.NumberFormat("es-CO", {
              style: "currency",
              currency: "COP",
              maximumFractionDigits: 0,
            }).format(ingredientCharge)}`
          : String(billable),
      });
    }

    return result;
  }

  if (kind === "COMBO") {
    const presented = presentComboOrderConfiguration(configuration);
    if (!presented) return [];

    return [
      ...presented.pizzas.map((pizza, index) => ({
        label: `Pizza ${index + 1}`,
        value: [pizza.sizeName, pizza.flavor]
          .filter(Boolean)
          .join(" · "),
      })),
      ...presented.groups.map((group) => ({
        label: group.label,
        value: group.values.join(", "),
      })),
    ].filter((detail) => detail.value);
  }

  if (kind === "STANDARD") {
    const name = text(configuration.productName);
    return name ? [{ label: "Producto", value: name }] : [];
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


export function fulfillmentLabel(value: string) {
  const labels: Record<string, string> = {
    DELIVERY: "Domicilio",
    PICKUP: "Recoger en tienda",
    STORE: "Consumo en local",
  };

  return labels[value] ?? value;
}

export function bogotaDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(value);
}
