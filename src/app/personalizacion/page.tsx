"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  ExternalLink,
  Home,
  ImageIcon,
  Monitor,
  Save,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

type PublicHomeSettings = {
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
type ProcessingKey =
  | "landingMobile"
  | "landingDesktop"
  | "menuHero";
type ResetTarget =
  | "landingMobile"
  | "landingDesktop"
  | "menuHero"
  | null;

async function prepareImage(
  file: File,
  width: number,
  height: number,
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen JPG, PNG o WebP.");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error(
      "La imagen original no puede superar 12 MB.",
    );
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new window.Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("No fue posible leer la imagen."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No fue posible preparar la imagen.");
    }

    const sourceRatio =
      image.naturalWidth / image.naturalHeight;
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

    context.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      width,
      height,
    );

    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PersonalizationPage() {
  const router = useRouter();
  const [settings, setSettings] =
    useState<PublicHomeSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] =
    useState<ProcessingKey | null>(null);
  const [resetTarget, setResetTarget] =
    useState<ResetTarget>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentSnapshot = useMemo(
    () => (settings ? JSON.stringify(settings) : ""),
    [settings],
  );
  const dirty =
    Boolean(settings) &&
    Boolean(savedSnapshot) &&
    currentSnapshot !== savedSnapshot;

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          "/api/public-home-admin",
          { cache: "no-store" },
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "No fue posible cargar la personalización.",
          );
        }

        const normalized: PublicHomeSettings = {
          landing: {
            mobileImageUrl:
              data.settings?.landing?.mobileImageUrl ?? "",
            desktopImageUrl:
              data.settings?.landing?.desktopImageUrl ?? "",
          },
          menuHero: {
            active: data.settings?.menuHero?.active === true,
            imageUrl:
              data.settings?.menuHero?.imageUrl ?? "",
          },
        };

        setSettings(normalized);
        setSavedSnapshot(JSON.stringify(normalized));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar la personalización.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!dirty) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () =>
      window.removeEventListener(
        "beforeunload",
        beforeUnload,
      );
  }, [dirty]);

  function goBack() {
    if (
      dirty &&
      !window.confirm(
        "Tienes cambios sin guardar. ¿Quieres volver a Configuración sin guardarlos?",
      )
    ) {
      return;
    }

    router.push("/configuracion");
  }

  async function onMenuHeroFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessing("menuHero");
    setError("");
    setMessage("");

    try {
      const imageUrl = await prepareImage(
        file,
        1920,
        730,
      );
      setSettings((current) =>
        current
          ? {
              ...current,
              menuHero: {
                active: true,
                imageUrl,
              },
            }
          : current,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No fue posible preparar la portada del menú.",
      );
    } finally {
      setProcessing(null);
    }
  }

  async function onLandingFile(
    key: LandingKey,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isMobile = key === "mobileImageUrl";
    setProcessing(
      isMobile ? "landingMobile" : "landingDesktop",
    );
    setError("");
    setMessage("");

    try {
      const imageUrl = await prepareImage(
        file,
        isMobile ? 1080 : 1920,
        isMobile ? 2160 : 1080,
      );

      setSettings((current) =>
        current
          ? {
              ...current,
              landing: {
                ...current.landing,
                [key]: imageUrl,
              },
            }
          : current,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No fue posible preparar la imagen del Home.",
      );
    } finally {
      setProcessing(null);
    }
  }

  function confirmReset() {
    if (!settings || !resetTarget) return;

    if (resetTarget === "landingMobile") {
      setSettings({
        ...settings,
        landing: {
          ...settings.landing,
          mobileImageUrl: "",
        },
      });
    }

    if (resetTarget === "landingDesktop") {
      setSettings({
        ...settings,
        landing: {
          ...settings.landing,
          desktopImageUrl: "",
        },
      });
    }

    if (resetTarget === "menuHero") {
      setSettings({
        ...settings,
        menuHero: {
          active: false,
          imageUrl: "",
        },
      });
    }

    setResetTarget(null);
    setMessage(
      "Cambio preparado. Guarda la personalización para aplicarlo.",
    );
    setError("");
  }

  async function save() {
    if (!settings) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/public-home-admin",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ settings }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No fue posible guardar la personalización.",
        );
      }

      const normalized: PublicHomeSettings = {
        landing: {
          mobileImageUrl:
            data.settings?.landing?.mobileImageUrl ?? "",
          desktopImageUrl:
            data.settings?.landing?.desktopImageUrl ?? "",
        },
        menuHero: {
          active: data.settings?.menuHero?.active === true,
          imageUrl:
            data.settings?.menuHero?.imageUrl ?? "",
        },
      };

      setSettings(normalized);
      setSavedSnapshot(JSON.stringify(normalized));
      setMessage(
        "Personalización guardada. Los cambios ya están disponibles en la experiencia pública.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar la personalización.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="p-4 md:p-5 xl:p-6">
        <div className="rounded-[24px] border border-neutral-200 bg-white p-6 alento-ui-control text-neutral-500">
          Cargando personalización...
        </div>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="p-4 md:p-5 xl:p-6">
        <div className="rounded-[24px] border border-red-200 bg-red-50 p-6 alento-ui-control text-red-700">
          {error ||
            "No fue posible cargar la personalización."}
        </div>
      </main>
    );
  }

  const configuredCount = [
    settings.landing.mobileImageUrl,
    settings.landing.desktopImageUrl,
    settings.menuHero.active &&
      settings.menuHero.imageUrl,
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen w-full p-3 md:p-5 xl:p-6">
      <div className="w-full space-y-3">
        <section className="relative min-h-[116px] overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[46%] opacity-70 [background:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.025)_28%,transparent_29%),repeating-linear-gradient(90deg,transparent_0_54px,rgba(255,255,255,.025)_55px_56px)]" />

          <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center md:px-6 xl:px-7">
            <div className="min-w-0 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 alento-ui-label text-white/48">
                <button
                  type="button"
                  onClick={goBack}
                  className="transition hover:text-white"
                >
                  Configuración
                </button>
                <span>/</span>
                <span className="text-white/75">
                  Personalización
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-3">
                <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
                <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                  Experiencia pública
                </p>
              </div>

              <h1 className="alento-ui-hero-title mt-1.5">
                Personalización
              </h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Controla únicamente las piezas visuales que hoy se muestran en Home y Menú.
              </p>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                type="button"
                onClick={goBack}
                title="Volver a Configuración"
                aria-label="Volver a Configuración"
                className="flex h-[56px] w-[62px] items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] text-white/75 backdrop-blur-sm transition hover:bg-white/[0.13] hover:text-white"
              >
                <ArrowLeft
                  className="h-[21px] w-[21px]"
                  strokeWidth={2.2}
                />
              </button>

              <div className="hidden h-[56px] min-w-[96px] flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 text-center backdrop-blur-sm sm:flex">
                <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/42">
                  Estado
                </span>
                <b className="alento-ui-label mt-0.5 whitespace-nowrap text-white">
                  {dirty
                    ? "Sin guardar"
                    : `${configuredCount}/3 activas`}
                </b>
              </div>

              <button
                type="button"
                onClick={() => void save()}
                disabled={
                  saving ||
                  processing !== null ||
                  !dirty
                }
                title={
                  saving
                    ? "Guardando..."
                    : dirty
                      ? "Guardar personalización"
                      : "Sin cambios pendientes"
                }
                aria-label="Guardar personalización"
                className="flex h-[56px] w-[76px] items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-default disabled:opacity-35"
              >
                <Save
                  className="h-[22px] w-[22px]"
                  strokeWidth={2.15}
                />
              </button>
            </div>
          </div>
        </section>

        {(message || error || dirty) && (
          <div
            className={`flex items-center justify-between gap-3 rounded-[15px] border px-3.5 py-2.5 ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : dirty
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            <p className="alento-ui-micro">
              {error ||
                (dirty
                  ? "Hay cambios pendientes. Revisa las piezas y guarda cuando estés listo."
                  : message)}
            </p>
            {dirty && (
              <span className="alento-ui-label shrink-0 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                Sin guardar
              </span>
            )}
          </div>
        )}

        <section className="grid gap-2 md:grid-cols-3">
          <InfoCard
            icon={Smartphone}
            label="Home móvil"
            value="1080 × 2160"
            detail="1:2 · pantalla inicial"
            active={Boolean(
              settings.landing.mobileImageUrl,
            )}
          />
          <InfoCard
            icon={Monitor}
            label="Home PC"
            value="1920 × 1080"
            detail="16:9 · pantalla inicial"
            active={Boolean(
              settings.landing.desktopImageUrl,
            )}
          />
          <InfoCard
            icon={ImageIcon}
            label="Portada menú"
            value="1920 × 730"
            detail="2.63:1 · menú público"
            active={Boolean(
              settings.menuHero.active &&
                settings.menuHero.imageUrl,
            )}
          />
        </section>

        <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(28,23,20,.045)]">
          <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="alento-ui-label uppercase text-neutral-400">
                Pantalla inicial
              </p>
              <h2 className="alento-ui-title mt-0.5 text-neutral-950">
                Imágenes del Home
              </h2>
              <p className="alento-ui-micro mt-1 text-neutral-500">
                La Home pública usa una pieza vertical en móvil y una horizontal en escritorio.
              </p>
            </div>

            <Link
              href="/"
              target="_blank"
              className="alento-ui-control inline-flex h-9 items-center gap-2 self-start rounded-xl border border-neutral-200 bg-white px-3 text-neutral-600 transition hover:bg-neutral-50 sm:self-auto"
            >
              Ver Home
              <ExternalLink
                className="h-3.5 w-3.5"
                strokeWidth={2}
              />
            </Link>
          </div>

          <div className="grid gap-3 p-3 lg:grid-cols-2">
            <VisualAssetCard
              title="Home móvil"
              subtitle="1080 × 2160 px · 1:2"
              imageUrl={
                settings.landing.mobileImageUrl
              }
              aspectClass="aspect-[1/2]"
              previewClass="mx-auto max-h-[420px] max-w-[210px]"
              stateLabel={
                settings.landing.mobileImageUrl
                  ? "Personalizada"
                  : "Predeterminada"
              }
              processing={
                processing === "landingMobile"
              }
              uploadLabel={
                settings.landing.mobileImageUrl
                  ? "Cambiar imagen"
                  : "Subir imagen"
              }
              onFile={(event) =>
                void onLandingFile(
                  "mobileImageUrl",
                  event,
                )
              }
              onReset={
                settings.landing.mobileImageUrl
                  ? () =>
                      setResetTarget(
                        "landingMobile",
                      )
                  : undefined
              }
            />

            <VisualAssetCard
              title="Home PC"
              subtitle="1920 × 1080 px · 16:9"
              imageUrl={
                settings.landing.desktopImageUrl
              }
              aspectClass="aspect-video"
              stateLabel={
                settings.landing.desktopImageUrl
                  ? "Personalizada"
                  : "Predeterminada"
              }
              processing={
                processing === "landingDesktop"
              }
              uploadLabel={
                settings.landing.desktopImageUrl
                  ? "Cambiar imagen"
                  : "Subir imagen"
              }
              onFile={(event) =>
                void onLandingFile(
                  "desktopImageUrl",
                  event,
                )
              }
              onReset={
                settings.landing.desktopImageUrl
                  ? () =>
                      setResetTarget(
                        "landingDesktop",
                      )
                  : undefined
              }
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(28,23,20,.045)]">
          <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="alento-ui-label uppercase text-neutral-400">
                Menú público
              </p>
              <h2 className="alento-ui-title mt-0.5 text-neutral-950">
                Portada superior
              </h2>
              <p className="alento-ui-micro mt-1 text-neutral-500">
                Es la pieza que aparece antes de las categorías del menú.
              </p>
            </div>

            <Link
              href="/menu"
              target="_blank"
              className="alento-ui-control inline-flex h-9 items-center gap-2 self-start rounded-xl border border-neutral-200 bg-white px-3 text-neutral-600 transition hover:bg-neutral-50 sm:self-auto"
            >
              Ver menú
              <ExternalLink
                className="h-3.5 w-3.5"
                strokeWidth={2}
              />
            </Link>
          </div>

          <div className="p-3">
            <VisualAssetCard
              title="Portada del menú"
              subtitle="1920 × 730 px · 2.63:1"
              imageUrl={settings.menuHero.imageUrl}
              aspectClass="aspect-[1920/730]"
              stateLabel={
                settings.menuHero.active &&
                settings.menuHero.imageUrl
                  ? "Activa"
                  : "Predeterminada"
              }
              processing={
                processing === "menuHero"
              }
              uploadLabel={
                settings.menuHero.imageUrl
                  ? "Cambiar portada"
                  : "Subir portada"
              }
              onFile={(event) =>
                void onMenuHeroFile(event)
              }
              onReset={
                settings.menuHero.imageUrl
                  ? () =>
                      setResetTarget("menuHero")
                  : undefined
              }
            />
          </div>
        </section>

        <section className="flex items-start gap-3 rounded-[18px] border border-blue-100 bg-blue-50 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
            <ShieldCheck
              className="h-4 w-4"
              strokeWidth={2}
            />
          </span>
          <div>
            <p className="alento-ui-control font-bold text-blue-950">
              Cambios protegidos
            </p>
            <p className="alento-ui-micro mt-1 max-w-3xl leading-5 text-blue-800">
              Las imágenes se preparan automáticamente al tamaño correcto. Restablecer una pieza no borra la imagen predeterminada del sistema: solamente elimina tu reemplazo personalizado.
            </p>
          </div>
        </section>
      </div>

      {resetTarget && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[4px]"
          onClick={() => setResetTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) =>
              event.stopPropagation()
            }
            className="w-full max-w-[390px] overflow-hidden rounded-[24px] border border-white/10 bg-[#111] text-white shadow-[0_30px_90px_rgba(0,0,0,.45)]"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                  <ImageIcon
                    className="h-5 w-5"
                    strokeWidth={2}
                  />
                </span>
                <div>
                  <p className="alento-ui-label uppercase text-amber-300">
                    Personalización
                  </p>
                  <h2 className="alento-ui-title mt-1 text-white">
                    ¿Usar imagen predeterminada?
                  </h2>
                  <p className="alento-ui-micro mt-2 leading-5 text-white/50">
                    El reemplazo personalizado dejará de usarse cuando guardes. La pieza predeterminada del sistema seguirá disponible.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setResetTarget(null)
                  }
                  className="alento-ui-control h-11 rounded-xl border border-white/10 bg-white/[0.04] text-white/65"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmReset}
                  className="alento-ui-control h-11 rounded-xl bg-[var(--brand-red)] text-white"
                >
                  Sí, restablecer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  detail,
  active,
}: {
  icon: typeof Home;
  label: string;
  value: string;
  detail: string;
  active: boolean;
}) {
  return (
    <article className="flex min-h-[74px] items-center gap-3 rounded-[18px] border border-neutral-200 bg-white p-3 shadow-[0_7px_20px_rgba(28,23,20,.035)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white">
        <Icon
          className="h-4 w-4"
          strokeWidth={2}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="alento-ui-control truncate font-bold text-neutral-950">
            {label}
          </p>
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              active
                ? "bg-emerald-500"
                : "bg-neutral-300"
            }`}
          />
        </div>
        <p className="alento-ui-micro mt-0.5 text-neutral-400">
          {value} · {detail}
        </p>
      </div>
    </article>
  );
}

function VisualAssetCard({
  title,
  subtitle,
  imageUrl,
  aspectClass,
  previewClass = "",
  stateLabel,
  processing,
  uploadLabel,
  onFile,
  onReset,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  aspectClass: string;
  previewClass?: string;
  stateLabel: string;
  processing: boolean;
  uploadLabel: string;
  onFile: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  onReset?: () => void;
}) {
  return (
    <article className="rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="alento-ui-status text-neutral-950">
            {title}
          </h3>
          <p className="alento-ui-micro mt-0.5 text-neutral-400">
            {subtitle}
          </p>
        </div>
        <span
          className={`alento-ui-label rounded-full px-2 py-1 ${
            imageUrl
              ? "bg-emerald-50 text-emerald-700"
              : "bg-neutral-200 text-neutral-500"
          }`}
        >
          {stateLabel}
        </span>
      </div>

      <div
        className={`mt-3 overflow-hidden rounded-[14px] border border-neutral-200 bg-neutral-100 ${aspectClass} ${previewClass}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-h-[150px] flex-col items-center justify-center px-4 text-center">
            <ImageIcon
              className="h-6 w-6 text-neutral-300"
              strokeWidth={1.8}
            />
            <b className="alento-ui-control mt-2 text-neutral-500">
              Imagen predeterminada
            </b>
            <p className="alento-ui-micro mt-1 text-neutral-400">
              No hay un reemplazo personalizado guardado.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="alento-ui-control inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-neutral-950 px-4 text-white transition hover:bg-black">
          {processing
            ? "Procesando..."
            : uploadLabel}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={processing}
            onChange={onFile}
            className="hidden"
          />
        </label>

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="alento-ui-control h-10 rounded-xl border border-neutral-200 bg-white px-3 text-neutral-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
          >
            Usar predeterminada
          </button>
        )}
      </div>
    </article>
  );
}
