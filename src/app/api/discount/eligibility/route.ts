import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CartLine = {
  productId: number;
  unitPrice: number;
  quantity: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawLines = Array.isArray(body?.lines) ? body.lines : [];

    const lines: CartLine[] = rawLines
      .map((line: unknown) => {
        const value = line as Partial<CartLine>;
        return {
          productId: Number(value.productId),
          unitPrice: Number(value.unitPrice),
          quantity: Number(value.quantity),
        };
      })
      .filter((line: CartLine) =>
        Number.isInteger(line.productId) &&
        Number.isFinite(line.unitPrice) && line.unitPrice >= 0 &&
        Number.isInteger(line.quantity) && line.quantity > 0,
      );

    if (!lines.length) {
      return NextResponse.json({ eligibleSubtotal: 0, excludedSubtotal: 0, eligibleProductIds: [], excludedProductIds: [] });
    }

    const productIds = [...new Set(lines.map((line) => line.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, type: true, couponEligible: true },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));
    let eligibleSubtotal = 0;
    let excludedSubtotal = 0;
    const eligibleProductIds = new Set<number>();
    const excludedProductIds = new Set<number>();

    for (const line of lines) {
      const product = productMap.get(line.productId);
      const lineTotal = line.unitPrice * line.quantity;
      const eligible = Boolean(product && product.type !== "COMBO" && product.couponEligible);

      if (eligible) {
        eligibleSubtotal += lineTotal;
        eligibleProductIds.add(line.productId);
      } else {
        excludedSubtotal += lineTotal;
        excludedProductIds.add(line.productId);
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
    return NextResponse.json({ error: "No fue posible calcular los productos elegibles para descuento." }, { status: 500 });
  }
}
