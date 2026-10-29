import { NextRequest, NextResponse } from "next/server";
import { clearCustomerSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await clearCustomerSession();

  if (request.headers.get("accept")?.includes("text/html")) {
    const response = new NextResponse(null, { status: 303 });
    response.headers.set("Location", "/");
    return response;
  }

  return NextResponse.json({ ok: true });
}
