import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import DriverHome from "@/components/DriverHome";

export const dynamic = "force-dynamic";

export default async function DriverHomePage() {
  let session;

  try {
    session = await requireStaffSession(["DRIVER", "DISPATCH"]);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/sin-acceso");
    }
    redirect("/login?next=/repartidor");
  }

  const driver = await prisma.user.findFirst({
    where: {
      id: session.userId,
      active: true,
      roles: { hasSome: ["DRIVER", "DISPATCH"] },
    },
    select: {
      id: true,
      name: true,
      driverAvailable: true,
      driverLatitude: true,
      driverLongitude: true,
      driverLocationAccuracy: true,
      driverLocationUpdatedAt: true,
      driverLocationSource: true,
    },
  });

  if (!driver) redirect("/sin-acceso");

  return (
    <DriverHome
      initialDriver={{
        id: driver.id,
        name: driver.name,
        driverAvailable: driver.driverAvailable,
        driverLatitude: driver.driverLatitude,
        driverLongitude: driver.driverLongitude,
        driverLocationAccuracy: driver.driverLocationAccuracy,
        driverLocationUpdatedAt:
          driver.driverLocationUpdatedAt?.toISOString() ?? null,
        driverLocationSource: driver.driverLocationSource,
      }}
    />
  );
}
