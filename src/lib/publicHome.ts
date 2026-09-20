export const PUBLIC_HOME_SETTING_KEY = "public.home";

export type PublicHomeBanner = {
  active: boolean;
  imageUrl: string;
  productId: number | null;
};

export type PublicHomeSettings = {
  primaryBanner: PublicHomeBanner;
  secondaryBanner: PublicHomeBanner;
};

export const DEFAULT_PUBLIC_HOME_SETTINGS: PublicHomeSettings = {
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

export function normalizePublicHomeSettings(value: unknown): PublicHomeSettings {
  if (!value || typeof value !== "object") return DEFAULT_PUBLIC_HOME_SETTINGS;
  const raw = value as Partial<PublicHomeSettings>;

  return {
    primaryBanner: normalizeBanner(raw.primaryBanner),
    secondaryBanner: normalizeBanner(raw.secondaryBanner),
  };
}
