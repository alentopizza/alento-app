"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PublicBrandHeader() {
  const [logoUrl, setLogoUrl] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/public-home", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        setLogoUrl(
          typeof data?.settings?.brand?.logoUrl === "string"
            ? data.settings.brand.logoUrl.trim()
            : "",
        );
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/95 shadow-[0_10px_28px_rgba(0,0,0,.28)] backdrop-blur-xl md:hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d71920]/35 to-transparent" />

      <div className="mx-auto flex h-[68px] w-full items-center justify-center px-4 md:h-[76px]">
        <Link
          href="/menu"
          className="flex h-full items-center justify-center"
          aria-label="Ir al menú de Alentó Pizza"
        >
          {loaded && logoUrl ? (
            <img
              src={logoUrl}
              alt="Alentó Pizza"
              className="h-[48px] w-[160px] object-contain object-center md:h-[54px] md:w-[190px]"
            />
          ) : (
            <span
              className="block h-[48px] w-[160px] md:h-[54px] md:w-[190px]"
              aria-hidden="true"
            />
          )}
        </Link>
      </div>
    </header>
  );
}
