"use client";

import { ChangeEvent, useEffect, useState } from "react";

type PublicHomeSettings = {
  brand: {
    logoUrl: string;
  };
  landing: {
    mobileImageUrl: string;
    desktopImageUrl: string;
  };
  menuHero: {
    active: boolean;
    imageUrl: string;
  };
};

type LandingKey = "mobileImageUrl" | "desktopImageUrl";
type ProcessingKey = "logo" | "landingMobile" | "landingDesktop" | "menuHero";

async function prepareImage(file: File, width: number, height: number) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen JPG, PNG o WebP.");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error("La imagen original no puede superar 12 MB.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new window.Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No fue posible leer la imagen."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("No fue posible preparar la imagen.");

    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;

    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else if (sourceRatio < targetRatio) {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }

    context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}



async function prepareLogoImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen JPG, PNG o WebP.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("El logo original no puede superar 8 MB.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new window.Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No fue posible leer el logo."));
    });

    const width = 600;
    const height = 180;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("No fue posible preparar el logo.");

    context.clearRect(0, 0, width, height);

    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const dx = (width - drawWidth) / 2;
    const dy = (height - drawHeight) / 2;

    context.drawImage(image, dx, dy, drawWidth, drawHeight);
    return canvas.toDataURL("image/webp", 0.92);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PersonalizationPage() {
  const [settings, setSettings] = useState<PublicHomeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState<ProcessingKey | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/public-home-admin", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar la personalización.");
        setSettings(data.settings);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la personalización.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function onMenuHeroFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessing("menuHero");
    setError("");
    setMessage("");

    try {
      const imageUrl = await prepareImage(file, 1920, 730);
      setSettings((current) => current ? {
        ...current,
        menuHero: {
          active: true,
          imageUrl,
        },
      } : current);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No fue posible preparar la portada del menú.");
    } finally {
      setProcessing(null);
    }
  }

  async function onLandingFile(key: LandingKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isMobile = key === "mobileImageUrl";
    setProcessing(isMobile ? "landingMobile" : "landingDesktop");
    setError("");
    setMessage("");

    try {
      const imageUrl = await prepareImage(
        file,
        isMobile ? 1080 : 1920,
        isMobile ? 2160 : 1080,
      );

      setSettings((current) => current ? {
        ...current,
        landing: {
          ...current.landing,
          [key]: imageUrl,
        },
      } : current);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No fue posible preparar la imagen del home.");
    } finally {
      setProcessing(null);
    }
  }

  async function onLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessing("logo");
    setError("");
    setMessage("");

    try {
      const logoUrl = await prepareLogoImage(file);
      setSettings((current) => current ? {
        ...current,
        brand: { ...current.brand, logoUrl },
      } : current);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No fue posible preparar el logo.");
    } finally {
      setProcessing(null);
    }
  }


  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/public-home-admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar la personalización.");
      setSettings(data.settings);
      setMessage("Personalización guardada. Los cambios ya están disponibles en la experiencia pública.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar la personalización.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="p-5 lg:p-8"><div className="alento-card mx-auto max-w-6xl rounded-[28px] p-8">Cargando personalización...</div></main>;
  }

  if (!settings) {
    return <main className="p-5 lg:p-8"><div className="mx-auto max-w-6xl rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">{error || "No fue posible cargar la personalización."}</div></main>;
  }

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">Experiencia pública</p>
            <h1 className="text-3xl font-black tracking-tight">Personalización</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
              Administra las piezas visuales de la Home y del menú público desde un solo lugar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || processing !== null}
            className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-black text-white disabled:bg-neutral-300"
          >
            {saving ? "Guardando..." : "Guardar personalización"}
          </button>
        </div>

        {(message || error) && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${error ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        )}

        <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          <b>Home:</b> móvil <b>1080 × 2160 px</b> (1:2) y PC <b>1920 × 1080 px</b> (16:9). ·
          <b> Menú:</b> portada superior <b>1920 × 730 px</b> (2.63:1). ·
          <b> Logo:</b> 600 × 180 px.
          Las imágenes se preparan al tamaño indicado; el logo se ajusta completo sin deformarse.
        </div>


        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Pantalla inicial</p>
            <h2 className="mt-1 text-xl font-black">Imágenes del Home principal</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">
              Estas imágenes ocupan el fondo de la URL principal antes de deslizar para entrar al menú.
              Carga una pieza vertical para celulares y otra horizontal para computadores.
            </p>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="rounded-[24px] border bg-[#faf9f7] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <b className="text-sm">Home móvil</b>
                  <p className="mt-1 text-[11px] font-bold text-neutral-400">1080 × 2160 px · 1:2</p>
                </div>
                <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white">Móvil</span>
              </div>

              <div className="mx-auto mt-4 aspect-[1/2] max-h-[480px] overflow-hidden rounded-[22px] border border-neutral-200 bg-neutral-100">
                {settings.landing.mobileImageUrl ? (
                  <img src={settings.landing.mobileImageUrl} alt="Home móvil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-xs text-neutral-400">
                    Se seguirá mostrando la imagen actual hasta que cargues una nueva.
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <label className="cursor-pointer rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">
                  {processing === "landingMobile" ? "Procesando..." : settings.landing.mobileImageUrl ? "Cambiar imagen móvil" : "Subir imagen móvil"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={processing !== null}
                    onChange={(event) => void onLandingFile("mobileImageUrl", event)}
                    className="hidden"
                  />
                </label>

                {settings.landing.mobileImageUrl && (
                  <button
                    type="button"
                    onClick={() => setSettings({
                      ...settings,
                      landing: { ...settings.landing, mobileImageUrl: "" },
                    })}
                    className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border bg-[#faf9f7] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <b className="text-sm">Home PC</b>
                  <p className="mt-1 text-[11px] font-bold text-neutral-400">1920 × 1080 px · 16:9</p>
                </div>
                <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white">Escritorio</span>
              </div>

              <div className="mt-4 aspect-video overflow-hidden rounded-[22px] border border-neutral-200 bg-neutral-100">
                {settings.landing.desktopImageUrl ? (
                  <img src={settings.landing.desktopImageUrl} alt="Home para PC" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-xs text-neutral-400">
                    Si no cargas esta pieza, en PC se usará la imagen móvil/actual como respaldo.
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <label className="cursor-pointer rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">
                  {processing === "landingDesktop" ? "Procesando..." : settings.landing.desktopImageUrl ? "Cambiar imagen PC" : "Subir imagen PC"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={processing !== null}
                    onChange={(event) => void onLandingFile("desktopImageUrl", event)}
                    className="hidden"
                  />
                </label>

                {settings.landing.desktopImageUrl && (
                  <button
                    type="button"
                    onClick={() => setSettings({
                      ...settings,
                      landing: { ...settings.landing, desktopImageUrl: "" },
                    })}
                    className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <b>Importante:</b> conserva textos y elementos importantes dentro de una zona segura. La portada usa <code>object-cover</code>,
            por lo que pantallas con una proporción distinta pueden recortar ligeramente los bordes.
          </div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Menú público</p>
            <h2 className="mt-1 text-xl font-black">Logo del menú</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Controla el logo que aparece en la cabecera superior de <b>/menu</b>.
            </p>
            <p className="mt-2 text-xs font-bold text-neutral-400">
              Recomendado: 600 × 180 px · 3.33:1 · fondo transparente preferiblemente
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div className="flex min-h-[150px] items-center justify-center rounded-[22px] border border-neutral-200 bg-[#faf9f7] p-6">
              {settings.brand.logoUrl ? (
                <img src={settings.brand.logoUrl} alt="Logo del menú Alentó Pizza" className="max-h-[90px] w-full max-w-[360px] object-contain" />
              ) : (
                <div className="text-center text-neutral-400">
                  <div className="text-3xl">◇</div>
                  <b className="mt-2 block text-sm text-neutral-500">Usando el logo actual</b>
                  <span className="mt-1 block text-xs">Carga un logo para reemplazar el que aparece en /menu.</span>
                </div>
              )}
            </div>

            <div className="rounded-[22px] border bg-[#faf9f7] p-4">
              <b className="text-sm">Archivo del logo</b>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                Alentó lo prepara a 600 × 180 px y /menu lo muestra completo, sin deformarlo.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">
                  {processing === "logo" ? "Procesando..." : settings.brand.logoUrl ? "Cambiar logo" : "Subir logo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={processing !== null}
                    onChange={(event) => void onLogoFile(event)}
                    className="hidden"
                  />
                </label>

                {settings.brand.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setSettings({
                      ...settings,
                      brand: { ...settings.brand, logoUrl: "" },
                    })}
                    className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600"
                  >
                    Usar logo actual
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Menú público</p>
              <h2 className="mt-1 text-xl font-black">Portada superior del menú</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Es la imagen grande que aparece en la parte superior de <b>/menu</b>, justo antes de las categorías.
              </p>
              <p className="mt-2 text-xs font-bold text-neutral-400">
                Diseño recomendado: 1920 × 730 px · 2.63:1
              </p>
            </div>

            <span className={`rounded-xl px-4 py-2.5 text-xs font-black ${settings.menuHero.active && settings.menuHero.imageUrl ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500"}`}>
              {settings.menuHero.active && settings.menuHero.imageUrl ? "Activo" : "Usando imagen actual"}
            </span>
          </div>

          <div className="mt-5">
            <div className="overflow-hidden rounded-[22px] border border-neutral-200 bg-[#f5f3ef]" style={{ aspectRatio: "1920 / 730" }}>
              {settings.menuHero.imageUrl ? (
                <img src={settings.menuHero.imageUrl} alt="Portada superior del menú" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-5 text-center text-neutral-400">
                  <span className="text-3xl">▧</span>
                  <b className="mt-2 text-sm text-neutral-500">Usando la portada actual del menú</b>
                  <span className="mt-1 text-xs">Carga aquí una nueva pieza de 1920 × 730 px para reemplazarla.</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">
                {processing === "menuHero" ? "Procesando..." : settings.menuHero.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={processing !== null}
                  onChange={(event) => void onMenuHeroFile(event)}
                  className="hidden"
                />
              </label>

              {settings.menuHero.imageUrl && (
                <button
                  type="button"
                  onClick={() => setSettings({
                    ...settings,
                    menuHero: { active: false, imageUrl: "" },
                  })}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600"
                >
                  Usar imagen actual
                </button>
              )}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
