import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "alento-app",
    timestamp: new Date().toISOString(),
  });
}
