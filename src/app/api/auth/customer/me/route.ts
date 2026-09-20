import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/auth";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });

  const account = await prisma.customerAccount.findUnique({
    where: { id: session.accountId },
    include: {
      customer: {
        select: { id: true, name: true, countryCode: true, phone: true, email: true },
      },
    },
  });

  if (!account?.active) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, customer: account.customer });
}
