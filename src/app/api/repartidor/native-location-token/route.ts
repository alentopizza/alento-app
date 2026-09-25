import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { createDriverLocationToken } from "@/lib/driverLocationToken";

export async function POST() {
  try {
    const session = await requireStaffSession(["DRIVER", "DISPATCH"]);

    return NextResponse.json({
      token: createDriverLocationToken(session.userId),
    });
  } catch (error) {
    const forbidden =
      error instanceof Error && error.message === "FORBIDDEN";

    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }
}
