import { NextRequest, NextResponse } from "next/server";
import {
  normalizeOrderLine,
  type OrderLineInput,
} from "@/lib/orderLineNormalizer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawLines = Array.isArray(body?.lines)
      ? (body.lines as OrderLineInput[])
      : [];

    if (!rawLines.length) {
      return NextResponse.json({
        eligibleSubtotal: 0,
        excludedSubtotal: 0,
        eligibleProductIds: [],
        excludedProductIds: [],
      });
    }

    const normalizedLines = await Promise.all(
      rawLines.map((line) => normalizeOrderLine(line)),
    );

    let eligibleSubtotal = 0;
    let excludedSubtotal = 0;
    const eligibleProductIds = new Set<number>();
    const excludedProductIds = new Set<number>();

    for (const line of normalizedLines) {
      if (line.eligible) {
        eligibleSubtotal += line.lineTotal;
        eligibleProductIds.add(line.product.id);
      } else {
        excludedSubtotal += line.lineTotal;
        excludedProductIds.add(line.product.id);
      }
    }

    return NextResponse.json({
      eligibleSubtotal,
      excludedSubtotal,
      eligibleProductIds: [...eligibleProductIds],
      excludedProductIds: [...excludedProductIds],
    });
  } catch (error) {
    console.error("Discount eligibility API error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible calcular los productos elegibles para descuento.",
      },
      { status: 400 },
    );
  }
}
