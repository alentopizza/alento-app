"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PublicHomeSettings = {
  brand: { logoUrl: string };
  primaryBanner: { active: boolean; imageUrl: string; productId: number | null };
  secondaryBanner: { active: boolean; imageUrl: string; productId: number | null };
};

const FALLBACK_LOGO = "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

export default function App2LandingPage() {
  const [settings, setSettings] = useState<PublicHomeSettings | null>(null);

  useEffect(() => {
    fetch("/api/public-home", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setSettings(data?.settings ?? null))
      .catch(() => {});
  }, []);

  const logo = settings?.brand.logoUrl || FALLBACK_LOGO;
  const heroImage =
    settings?.primaryBanner.active && settings.primaryBanner.imageUrl
      ? settings.primaryBanner.imageUrl
      : settings?.secondaryBanner.active && settings.secondaryBanner.imageUrl
        ? settings.secondaryBanner.imageUrl
        : "";

  return (
    <main className="min-h-screen bg-[#effff4] text-[#11140f]">
      <div className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col overflow-hidden bg-[radial-gradient(circle_at_10%_10%,rgba(201,255,74,.95),transparent_34%),radial-gradient(circle_at_100%_30%,rgba(180,244,255,.9),transparent_35%),linear-gradient(160deg,#f7fff2_0%,#effcf8_54%,#eef8ff_100%)] px-5 pb-6 pt-[max(24px,env(safe-area-inset-top))] sm:px-8">
        <header className="flex items-center justify-center py-2">
          <img
            src={logo}
            alt="Alentó Pizza"
            className="h-[58px] w-full max-w-[190px] object-contain"
          />
        </header>

        <section className="flex flex-1 flex-col justify-between pt-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/45">
              Alentó Pizza
            </p>
            <h1 className="mt-3 max-w-[520px] text-[48px] font-black leading-[0.92] tracking-[-0.055em] sm:text-[66px]">
              Pide rico.
              <br />
              Disfruta fácil.
            </h1>
            <p className="mt-5 max-w-[420px] text-[14px] font-medium leading-6 text-black/55 sm:text-[16px]">
              Tus pizzas, combos y antojos favoritos en una experiencia más rápida, visual y hecha para pedir desde el celular.
            </p>
          </div>

          <div className="relative my-7 overflow-hidden rounded-[34px] border border-white/70 bg-white/70 p-2 shadow-[0_26px_70px_rgba(45,78,40,.16)] backdrop-blur">
            {heroImage ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-black">
                <img
                  src={heroImage}
                  alt="Promoción Alentó Pizza"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-black backdrop-blur">
                  Sabor que te hace volver
                </div>
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#caff36,#dfffb3_48%,#c8f2ff)] text-center">
                <div>
                  <div className="text-[74px]">🍕</div>
                  <b className="mt-3 block text-[26px] font-black tracking-[-0.04em]">Tu próximo antojo empieza aquí</b>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-[54px_1fr] gap-3">
            <Link
              href="/"
              className="flex h-14 items-center justify-center rounded-full border border-black/15 bg-white/65 text-xl backdrop-blur"
              aria-label="Volver a la versión actual"
            >
              ←
            </Link>
            <Link
              href="/app2/menu"
              className="flex h-14 items-center justify-center rounded-full bg-[#72df00] px-6 text-[14px] font-black text-[#102300] shadow-[0_12px_30px_rgba(91,190,0,.24)] transition active:scale-[.98]"
            >
              Ver menú
              <span className="ml-3 text-lg">→</span>
            </Link>
          </div>

          <p className="mt-4 text-center text-[10px] font-semibold text-black/35">
            Prototipo App 2 · La versión actual sigue disponible
          </p>
        </section>
      </div>
    </main>
  );
}
