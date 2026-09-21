import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

export async function GET() {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json({ error: forbidden ? "Sin permisos." : "No autorizado." }, { status: forbidden ? 403 : 401 });
  }

  const users = await prisma.user.findMany({
    where: {
      active: true,
      roles: { hasSome: ["DRIVER", "DISPATCH"] },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      whatsappCountryCode: true,
      whatsappPhone: true,
    },
  });

  return NextResponse.json({
    drivers: users.map((user) => ({
      id: user.id,
      name: user.name,
      whatsappCountryCode: user.whatsappCountryCode,
      whatsappPhone: user.whatsappPhone,
      ready: Boolean(user.whatsappPhone),
    })),
  });
}
