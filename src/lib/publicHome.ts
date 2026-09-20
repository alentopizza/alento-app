export const PUBLIC_HOME_SETTING_KEY = "public.home";

export type PublicHomeBanner = {
  active: boolean;
  imageUrl: string;
  productId: number | null;
};

export type PublicHomeBrand = {
  logoUrl: string;
};

export type PublicHomeSettings = {
  brand: PublicHomeBrand;
  primaryBanner: PublicHomeBanner;
  secondaryBanner: PublicHomeBanner;
};

export const DEFAULT_PUBLIC_HOME_SETTINGS: PublicHomeSettings = {
  brand: {
    logoUrl: "",
  },
  primaryBanner: {
    active: false,
    imageUrl: "",
    productId: null,
  },
  secondaryBanner: {
    active: false,
    imageUrl: "",
    productId: null,
  },
};

function normalizeBanner(value: unknown): PublicHomeBanner {
  if (!value || typeof value !== "object") {
    return { active: false, imageUrl: "", productId: null };
  }

  const raw = value as Partial<PublicHomeBanner>;
  const productId = Number(raw.productId);

  return {
    active: raw.active === true,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "",
    productId: Number.isInteger(productId) && productId > 0 ? productId : null,
  };
}

function normalizeBrand(value: unknown): PublicHomeBrand {
  if (!value || typeof value !== "object") {
    return DEFAULT_PUBLIC_HOME_SETTINGS.brand;
  }

  const raw = value as Partial<PublicHomeBrand>;
  return {
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl.trim() : "",
  };
}

export function normalizePublicHomeSettings(value: unknown): PublicHomeSettings {
  if (!value || typeof value !== "object") return DEFAULT_PUBLIC_HOME_SETTINGS;
  const raw = value as Partial<PublicHomeSettings>;
  const legacyWithoutBrand = !("brand" in (value as Record<string, unknown>));

  const primaryBanner = normalizeBanner(raw.primaryBanner);
  const secondaryBanner = normalizeBanner(raw.secondaryBanner);

  if (legacyWithoutBrand) {
    if (primaryBanner.imageUrl) primaryBanner.active = true;
    if (secondaryBanner.imageUrl) secondaryBanner.active = true;
  }

  return {
    brand: normalizeBrand(raw.brand),
    primaryBanner,
    secondaryBanner,
  };
}
