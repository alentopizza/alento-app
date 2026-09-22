import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/auth";
import { geocodeAddress } from "@/lib/googleMapsServer";

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ authenticated: false, address: null });
    }

    const address = await prisma.customerAddress.findFirst({
      where: { customerId: session.customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        address: true,
        neighborhood: true,
        city: true,
        notes: true,
        isDefault: true,
      },
    });

    if (!address?.address?.trim()) {
      return NextResponse.json({ authenticated: true, address: null });
    }

    const query = [
      address.address.trim(),
      address.neighborhood?.trim(),
      address.city?.trim() || "Bogotá",
      "Colombia",
    ]
      .filter(Boolean)
      .join(", ");

    const location = await geocodeAddress(query);

    return NextResponse.json({
      authenticated: true,
      address: {
        id: address.id,
        label: address.label,
        notes: address.notes,
        isDefault: address.isDefault,
        ...location,
      },
    });
  } catch (error) {
    console.error("Customer default delivery address error", error);
    return NextResponse.json(
      {
        authenticated: true,
        address: null,
        error: "No fue posible cargar la dirección guardada.",
      },
      { status: 200 },
    );
  }
}
