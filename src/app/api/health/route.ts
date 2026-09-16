import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      service: "alento-app",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed", error);

    return NextResponse.json(
      {
        status: "error",
        service: "alento-app",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
