export const PUBLIC_HOME_SETTING_KEY = "public.home";

export type PublicHomeBanner = {
  active: boolean;
  imageUrl: string;
  productId: number | null;
};

export type PublicHomeBrand = {
  logoUrl: string;
};

export type PublicMenuHero = {
  active: boolean;
  imageUrl: string;
};

export type PublicHomeLanding = {
  mobileImageUrl: string;
  desktopImageUrl: string;
};

export type PublicHomeSettings = {
  brand: PublicHomeBrand;
  landing: PublicHomeLanding;
  menuHero: PublicMenuHero;
  primaryBanner: PublicHomeBanner;
  secondaryBanner: PublicHomeBanner;
};

export const DEFAULT_PUBLIC_HOME_SETTINGS: PublicHomeSettings = {
  brand: {
    logoUrl: "",
  },
  landing: {
    mobileImageUrl: "",
    desktopImageUrl: "",
  },
  menuHero: {
    active: false,
    imageUrl: "",
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

function normalizeMenuHero(value: unknown): PublicMenuHero {
  if (!value || typeof value !== "object") {
    return DEFAULT_PUBLIC_HOME_SETTINGS.menuHero;
  }

  const raw = value as Partial<PublicMenuHero>;
  return {
    active: raw.active === true,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "",
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

function normalizeLanding(value: unknown): PublicHomeLanding {
  if (!value || typeof value !== "object") {
    return DEFAULT_PUBLIC_HOME_SETTINGS.landing;
  }

  const raw = value as Partial<PublicHomeLanding>;
  return {
    mobileImageUrl: typeof raw.mobileImageUrl === "string" ? raw.mobileImageUrl.trim() : "",
    desktopImageUrl: typeof raw.desktopImageUrl === "string" ? raw.desktopImageUrl.trim() : "",
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
    landing: normalizeLanding(raw.landing),
    menuHero: normalizeMenuHero(raw.menuHero),
    primaryBanner,
    secondaryBanner,
  };
}
