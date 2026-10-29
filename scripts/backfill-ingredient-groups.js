const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const BACKFILL_KEY = "catalog.ingredientGroupsBackfilledV1";

const GROUPS = [
  {
    name: "Carnes y Embutidos",
    slug: "carnes-y-embutidos",
    sortOrder: 10,
    keywords: [
      "carne",
      "chicharron",
      "chorizo",
      "jamon",
      "pepperoni",
      "pollo",
      "salami",
      "tocineta",
    ],
  },
  {
    name: "Verduras, Vegetales y Legumbres",
    slug: "verduras-vegetales-y-legumbres",
    sortOrder: 20,
    keywords: [
      "cebolla",
      "champinon",
      "frijol",
      "jalapeno",
      "maiz",
      "pimenton",
      "tomate",
    ],
  },
  {
    name: "Frutas",
    slug: "frutas",
    sortOrder: 30,
    keywords: [
      "cereza",
      "ciruela",
      "pina",
      "platano",
    ],
  },
  {
    name: "Otros",
    slug: "otros",
    sortOrder: 40,
    keywords: [
      "queso",
      "mozzarella",
      "cheddar",
      "salsa",
      "bbq",
    ],
  },
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  const existingBackfill = await prisma.appSetting.findUnique({
    where: { key: BACKFILL_KEY },
  });
  if (existingBackfill) {
    console.log("Ingredient group backfill already applied.");
    return;
  }

  const groups = new Map();

  for (const group of GROUPS) {
    const saved = await prisma.ingredientGroup.upsert({
      where: { slug: group.slug },
      update: {},
      create: {
        name: group.name,
        slug: group.slug,
        sortOrder: group.sortOrder,
        active: true,
      },
    });
    groups.set(group.slug, saved);
  }

  const ingredients = await prisma.product.findMany({
    where: {
      type: "MODIFIER",
      category: { slug: "ingredientes" },
    },
    select: {
      id: true,
      name: true,
      ingredientGroupId: true,
    },
  });

  let assigned = 0;
  for (const ingredient of ingredients) {
    if (ingredient.ingredientGroupId) continue;

    const normalizedName = normalize(ingredient.name);
    const definition = GROUPS.find((group) =>
      group.keywords.some((keyword) => normalizedName.includes(keyword)),
    );
    if (!definition) continue;

    const group = groups.get(definition.slug);
    if (!group) continue;

    await prisma.product.update({
      where: { id: ingredient.id },
      data: { ingredientGroupId: group.id },
    });
    assigned += 1;
  }

  await prisma.appSetting.create({
    data: {
      key: BACKFILL_KEY,
      value: {
        appliedAt: new Date().toISOString(),
        groupsCreated: GROUPS.map((group) => group.slug),
        assigned,
      },
    },
  });

  console.log(
    `Ingredient groups ready. Groups: ${GROUPS.length}. Newly assigned ingredients: ${assigned}.`,
  );
}

main()
  .catch((error) => {
    console.error("Ingredient group backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
