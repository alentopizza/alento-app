"use client";

import { ChangeEvent, useEffect, useState } from "react";

type ProductOption = {
  id: number;
  name: string;
  type: string;
  imageUrl: string | null;
  basePrice: number | null;
};

type BannerSetting = {
  active: boolean;
  imageUrl: string;
  productId: number | null;
};

type PublicHomeSettings = {
  brand: {
    logoUrl: string;
  };
  primaryBanner: BannerSetting;
  secondaryBanner: BannerSetting;
};

type BannerKey = "primaryBanner" | "secondaryBanner";
type ProcessingKey = BannerKey | "logo";

const FORMATS: Record<BannerKey, {
  title: string;
  description: string;
  width: number;
  height: number;
  ratio: string;
}> = {
  primaryBanner: {
    title: "Banner principal",
    description: "Aparece debajo del buscador, antes de las categorías.",
    width: 1200,
    height: 625,
    ratio: "1.92:1",
  },
  secondaryBanner: {
    title: "Banner secundario",
    description: "Aparece debajo de los productos populares como refuerzo promocional.",
    width: 1200,
    height: 310,
    ratio: "3.9:1",
  },
};

async function prepareBannerImage(file: File, width: number, height: number) {
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
  const [products, setProducts] = useState<ProductOption[]>([]);
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
        setProducts(data.products ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la personalización.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  function updateBanner(key: BannerKey, patch: Partial<BannerSetting>) {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: {
          ...current[key],
          ...patch,
        },
      };
    });
  }

  async function onFile(key: BannerKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessing(key);
    setError("");
    setMessage("");

    try {
      const format = FORMATS[key];
      const imageUrl = await prepareBannerImage(file, format.width, format.height);
      updateBanner(key, { imageUrl, active: true });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No fue posible preparar la imagen.");
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
      setMessage("Personalización guardada. La portada pública ya puede usar estos banners.");
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
              Administra las piezas promocionales que aparecen en la página principal. Cada banner se vincula a un producto real del catálogo.
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
          <b>Tamaños recomendados:</b> logo <b>600 × 180 px</b> (3.33:1), principal <b>1200 × 625 px</b> (1.92:1) y secundario <b>1200 × 310 px</b> (3.9:1).
          Los banners se recortan al centro. El logo se ajusta completo, sin deformarlo ni cortarlo.
        </div>

        <section className="alento-card rounded-[28px] p-5 md:p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Cabecera pública</p>
            <h2 className="mt-1 text-xl font-black">Logo de la portada</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Se muestra centrado en la cabecera principal, como en la referencia de la app.
            </p>
            <p className="mt-2 text-xs font-bold text-neutral-400">
              Recomendado: 600 × 180 px · 3.33:1 · fondo transparente preferiblemente
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div className="flex min-h-[150px] items-center justify-center rounded-[22px] border border-neutral-200 bg-[#faf9f7] p-6">
              {settings.brand.logoUrl ? (
                <img src={settings.brand.logoUrl} alt="Logo público Alentó Pizza" className="max-h-[90px] w-full max-w-[360px] object-contain" />
              ) : (
                <div className="text-center text-neutral-400">
                  <div className="text-3xl">◇</div>
                  <b className="mt-2 block text-sm text-neutral-500">Sin logo personalizado</b>
                  <span className="mt-1 block text-xs">La portada seguirá usando el logo actual como respaldo.</span>
                </div>
              )}
            </div>

            <div className="rounded-[22px] border bg-[#faf9f7] p-4">
              <b className="text-sm">Archivo del logo</b>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                Alentó lo prepara a 600 × 180 px conservando todo el diseño dentro del área.
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
                    Quitar logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {(Object.keys(FORMATS) as BannerKey[]).map((key) => {
          const banner = settings[key];
          const format = FORMATS[key];

          return (
            <section key={key} className="alento-card rounded-[28px] p-5 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                    {key === "primaryBanner" ? "Portada" : "Promoción secundaria"}
                  </p>
                  <h2 className="mt-1 text-xl font-black">{format.title}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{format.description}</p>
                  <p className="mt-2 text-xs font-bold text-neutral-400">
                    Diseño recomendado: {format.width} × {format.height} px · {format.ratio}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => updateBanner(key, { active: !banner.active })}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black ${banner.active ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500"}`}
                >
                  {banner.active ? "Activo" : "Inactivo"}
                </button>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
                <div>
                  <div
                    className="overflow-hidden rounded-[22px] border border-neutral-200 bg-[#f5f3ef]"
                    style={{ aspectRatio: `${format.width} / ${format.height}` }}
                  >
                    {banner.imageUrl ? (
                      <img src={banner.imageUrl} alt={format.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-5 text-center text-neutral-400">
                        <span className="text-3xl">▧</span>
                        <b className="mt-2 text-sm text-neutral-500">Sin imagen</b>
                        <span className="mt-1 text-xs">Sube la pieza promocional preparada para este espacio.</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">
                      {processing === key ? "Procesando..." : banner.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={processing !== null}
                        onChange={(event) => void onFile(key, event)}
                        className="hidden"
                      />
                    </label>

                    {banner.imageUrl && (
                      <button
                        type="button"
                        onClick={() => updateBanner(key, { imageUrl: "", active: false })}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600"
                      >
                        Quitar imagen
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border bg-[#faf9f7] p-4">
                  <label className="text-xs font-black text-neutral-700">Producto vinculado</label>
                  <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                    Cuando el cliente toque el banner se abrirá este producto.
                  </p>

                  <select
                    value={banner.productId ?? ""}
                    onChange={(event) => updateBanner(key, {
                      productId: event.target.value ? Number(event.target.value) : null,
                    })}
                    className="alento-input mt-3 w-full rounded-xl px-3 py-3 text-sm"
                  >
                    <option value="">Seleccionar producto...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>

                  {banner.productId && (
                    <div className="mt-4 rounded-xl border bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">Vinculado a</p>
                      <b className="mt-1 block text-sm">
                        {products.find((product) => product.id === banner.productId)?.name || "Producto"}
                      </b>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
