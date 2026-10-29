export const PUBLIC_HOME_SETTING_KEY = "public.home";

export type PublicMenuHero = {
  active: boolean;
  imageUrl: string;
};

export type PublicHomeLanding = {
  mobileImageUrl: string;
  desktopImageUrl: string;
};

export type PublicHomeSettings = {
  landing: PublicHomeLanding;
  menuHero: PublicMenuHero;
};

export const DEFAULT_PUBLIC_HOME_SETTINGS: PublicHomeSettings = {
  landing: {
    mobileImageUrl: "",
    desktopImageUrl: "",
  },
  menuHero: {
    active: false,
    imageUrl: "",
  },
};

function normalizeMenuHero(value: unknown): PublicMenuHero {
  if (!value || typeof value !== "object") {
    return DEFAULT_PUBLIC_HOME_SETTINGS.menuHero;
  }

  const raw = value as Partial<PublicMenuHero>;
  return {
    active: raw.active === true,
    imageUrl:
      typeof raw.imageUrl === "string"
        ? raw.imageUrl.trim()
        : "",
  };
}

function normalizeLanding(
  value: unknown,
): PublicHomeLanding {
  if (!value || typeof value !== "object") {
    return DEFAULT_PUBLIC_HOME_SETTINGS.landing;
  }

  const raw = value as Partial<PublicHomeLanding>;
  return {
    mobileImageUrl:
      typeof raw.mobileImageUrl === "string"
        ? raw.mobileImageUrl.trim()
        : "",
    desktopImageUrl:
      typeof raw.desktopImageUrl === "string"
        ? raw.desktopImageUrl.trim()
        : "",
  };
}

export function normalizePublicHomeSettings(
  value: unknown,
): PublicHomeSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_PUBLIC_HOME_SETTINGS;
  }

  const raw = value as Partial<PublicHomeSettings>;

  return {
    landing: normalizeLanding(raw.landing),
    menuHero: normalizeMenuHero(raw.menuHero),
  };
}
