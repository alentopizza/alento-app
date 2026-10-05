import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { CASH_EXPENSE_CATEGORIES } from "@/lib/cashExpenseCatalog";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function keyPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function customTypeKey(category: string, subcategory: string | null) {
  return `${keyPart(category)}::${subcategory ? keyPart(subcategory) : "__category__"}`;
}

async function authorized() {
  try {
    return await requireStaffSession(["ADMIN", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    throw new Error(forbidden ? "FORBIDDEN" : "UNAUTHORIZED");
  }
}

async function catalogResponse() {
  const custom = await prisma.cashExpenseCustomType.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { subcategory: "asc" }],
  });

  const map = new Map<string, Set<string>>();

  for (const item of CASH_EXPENSE_CATEGORIES) {
    if (item.name === "Nomina") continue;
    map.set(item.name, new Set(item.subcategories));
  }

  for (const item of custom) {
    if (item.category === "Nomina") continue;
    const subcategories = map.get(item.category) ?? new Set<string>();
    if (item.subcategory) subcategories.add(item.subcategory);
    map.set(item.category, subcategories);
  }

  const categories = [...map.entries()]
    .map(([name, subcategories]) => ({
      name,
      subcategories: [...subcategories].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { categories, custom };
}

export async function GET() {
  try {
    await authorized();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }

  try {
    return NextResponse.json(await catalogResponse());
  } catch (error) {
    console.error("Expense type catalog load error", error);
    return NextResponse.json(
      { error: "No fue posible cargar los tipos de salida." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await authorized();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Sin permisos." : "No autorizado." },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }

  try {
    const body = await request.json();
    const category = clean(body.category);
    const subcategory = clean(body.subcategory) || null;

    if (!category) {
      return NextResponse.json(
        { error: "Escribe una categoría." },
        { status: 400 },
      );
    }

    if (category.toLocaleLowerCase("es") === "nomina" ||
        category.toLocaleLowerCase("es") === "nómina") {
      return NextResponse.json(
        {
          error:
            "Nómina es un tipo protegido y se gestiona únicamente desde el botón de Nómina.",
        },
        { status: 409 },
      );
    }

    if (category.length > 60 || (subcategory && subcategory.length > 80)) {
      return NextResponse.json(
        { error: "El nombre del tipo de salida es demasiado largo." },
        { status: 400 },
      );
    }

    await prisma.cashExpenseCustomType.upsert({
      where: { key: customTypeKey(category, subcategory) },
      update: {
        active: true,
        category,
        subcategory,
      },
      create: {
        key: customTypeKey(category, subcategory),
        category,
        subcategory,
        active: true,
        createdByName: session.name,
      },
    });

    return NextResponse.json(await catalogResponse());
  } catch (error) {
    console.error("Expense type catalog create error", error);
    return NextResponse.json(
      { error: "No fue posible guardar el tipo de salida." },
      { status: 500 },
    );
  }
}
