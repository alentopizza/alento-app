import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import PublicLandingPageClient from "@/components/PublicLandingPageClient";

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
