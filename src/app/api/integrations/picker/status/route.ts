import { NextResponse } from "next/server";
import { pickerIntegrationStatus } from "@/lib/picker";

export async function GET() {
  return NextResponse.json({
    picker: pickerIntegrationStatus(),
  });
}
