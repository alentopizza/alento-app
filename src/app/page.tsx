import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import PublicLandingPageClient from "@/components/PublicLandingPageClient";
import { SEO_SHARE_IMAGE } from "@/lib/seo";

const HOME_DESCRIPTION =
  "Alentó Pizza en Kennedy, Bogotá. Pizzas con masa artesanal madurada, combos, antojos, bebidas, domicilio y recogida. Consulta el menú y pide en línea.";

export const metadata: Metadata = {
  title: "Pizza en Kennedy, Bogotá | Domicilios y recogida",
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "/",
    siteName: "Alentó Pizza",
    title: "Alentó Pizza | Pizza en Kennedy, Bogotá",
    description: HOME_DESCRIPTION,
    images: [
      {
        url: SEO_SHARE_IMAGE,
        alt: "Alentó Pizza en Kennedy, Bogotá",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alentó Pizza | Pizza en Kennedy, Bogotá",
    description: HOME_DESCRIPTION,
    images: [SEO_SHARE_IMAGE],
  },
};

function staffHome(roles: string[]) {
  if (
    roles.includes("ADMIN") ||
    roles.includes("POS") ||
    roles.includes("CASHIER")
  ) {
    return "/interno";
  }
  if (roles.includes("KITCHEN")) return "/cocina";
  if (
    roles.includes("DRIVER") ||
    roles.includes("DISPATCH")
  ) {
    return "/repartidor";
  }
  return "/sin-acceso";
}

export default async function PublicLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const params = await searchParams;
  const preview = params.preview === "1";

  if (!preview) {
    const staff = await getStaffSession();

    if (staff) {
      redirect(staffHome(staff.roles));
    }
  }

  return <PublicLandingPageClient />;
}
