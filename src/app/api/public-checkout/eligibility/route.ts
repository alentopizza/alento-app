import { NextRequest, NextResponse } from "next/server";
import { normalizeOrderLine, type OrderLineInput } from "@/lib/orderLineNormalizer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawLines = Array.isArray(body?.items)
      ? (body.items as OrderLineInput[])
      : [];

    if (!rawLines.length) {
      return NextResponse.json({
        eligibleSubtotal: 0,
        excludedSubtotal: 0,
      });
    }

    const normalizedLines = await Promise.all(
      rawLines.map((line) => normalizeOrderLine(line)),
    );

    const eligibleSubtotal = normalizedLines
      .filter((line) => line.eligible)
      .reduce((sum, line) => sum + line.lineTotal, 0);

    const excludedSubtotal = normalizedLines
      .filter((line) => !line.eligible)
      .reduce((sum, line) => sum + line.lineTotal, 0);

    return NextResponse.json({
      eligibleSubtotal,
      excludedSubtotal,
    });
  } catch (error) {
    console.error("Public checkout eligibility error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible calcular los productos elegibles para cupón.",
      },
      { status: 400 },
    );
  }
}
