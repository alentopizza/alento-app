import { NextRequest, NextResponse } from "next/server";
import { clearCustomerSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await clearCustomerSession();
  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/cuenta/login", request.url), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
