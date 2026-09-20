import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";

export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
      permissions: true,
      active: true,
    },
  });

  if (!user?.active) return NextResponse.json({ authenticated: false }, { status: 401 });

  return NextResponse.json({
    authenticated: true,
    user: {
      ...user,
      roles: user.roles.map((role) => role === "DISPATCH" ? "DRIVER" : role),
      isAdmin: user.roles.includes("ADMIN"),
    },
  });
}
