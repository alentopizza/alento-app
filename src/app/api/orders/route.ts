import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "pos_settings";

type FulfillmentType = "DELIVERY" | "PICKUP" | "STORE";
type DiscountMode = "NONE" | "COUPON" | "MANUAL";

type CartLine = {
  productId: number;
  quantity: number;
  name?: string;
  detail?: string;
  unitPrice?: number;
  configuration?: unknown;
};

type DeliveryBand = { id: string; name?: string; fee: number; active?: boolean };
type PaymentMethod = { id: string; name: string; active?: boolean };
type PosSettings = { deliveryBands?: DeliveryBand[]; paymentMethods?: PaymentMethod[] };

type PizzaConfiguration = {
  kind: "PIZZA";
  sizeId: number;
  firstFlavorId: number | null;
  secondFlavorId: number | null;
  crustId: number | null;
  modifierIds: number[];
};

type ComboConfiguration = {
  kind: "COMBO";
  pizzas: { sizeId: number | null; flavorId: number | null }[];
  groupSelections: Record<string, number[]>;
};

function money(value: number) {
  return Math.round(value);
}

function parseSettings(value: Prisma.JsonValue | null): PosSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as unknown as PosSettings;
}

function isCash(method: PaymentMethod) {
  return method.id.toLowerCase() === "cash" || method.name.trim().toLowerCase() === "efectivo";
}

function clientSnapshot(line: CartLine, productName: string) {
  const unitPrice = money(Number(line.unitPrice ?? 0));
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`El precio de ${productName} no es válido.`);
  return {
    unitPrice,
    configuration: {
      kind: "POS_SNAPSHOT",
      detail: typeof line.detail === "string" ? line.detail : "",
      capturedName: typeof line.name === "string" ? line.name : productName,
    },
  };
}

async function priceLine(line: CartLine) {
  const product = await prisma.product.findUnique({
    where: { id: line.productId },
    include: {
      comboPizzaRules: {
        orderBy: { sortOrder: "asc" },
        include: {
          sizes: { include: { size: true } },
          flavors: { include: { product: true } },
        },
      },
      comboGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { include: { product: true } } },
      },
    },
  });

  if (!product || !product.active || !product.visibleInPos) throw new Error("Uno de los productos ya no está disponible.");
  const quantity = Math.max(1, Math.floor(Number(line.quantity || 1)));
  const configuration = (line.configuration ?? {}) as Record<string, unknown>;

  if (product.type === "PIZZA_SINGLE" || product.type === "PIZZA_TWO_FLAVORS") {
    const config = configuration as unknown as PizzaConfiguration;

    if (config.kind !== "PIZZA" || !Number.isInteger(config.sizeId)) {
      const snapshot = clientSnapshot(line, product.name);
      return {
        product,
        quantity,
        unitPrice: snapshot.unitPrice,
        lineTotal: snapshot.unitPrice * quantity,
        eligible: product.couponEligible,
        configuration: snapshot.configuration,
      };
    }

    const size = await prisma.pizzaSize.findFirst({ where: { id: config.sizeId, active: true } });
    if (!size) throw new Error(`El tamaño seleccionado para ${product.name} ya no está disponible.`);

    let flavorPrice = Number(product.basePrice ?? 0);
    let firstFlavorName: string | null = null;
    let secondFlavorName: string | null = null;

    if (product.type === "PIZZA_TWO_FLAVORS") {
      if (!config.firstFlavorId || !config.secondFlavorId || config.firstFlavorId === config.secondFlavorId) throw new Error("La pizza de dos sabores debe tener dos sabores diferentes.");
      const flavors = await prisma.product.findMany({ where: { id: { in: [config.firstFlavorId, config.secondFlavorId] }, active: true, type: "PIZZA_SINGLE" } });
      if (flavors.length !== 2) throw new Error("Uno de los sabores seleccionados ya no está disponible.");
      const first = flavors.find((item) => item.id === config.firstFlavorId)!;
      const second = flavors.find((item) => item.id === config.secondFlavorId)!;
      flavorPrice = Math.max(Number(first.basePrice ?? 0), Number(second.basePrice ?? 0));
      firstFlavorName = first.name;
      secondFlavorName = second.name;
    }

    let crustPrice = 0;
    let crustName: string | null = null;
    if (config.crustId) {
      const crust = await prisma.pizzaCrust.findFirst({
        where: { id: config.crustId, active: true },
        include: { prices: { where: { sizeId: size.id } } },
      });
      if (!crust) throw new Error("El borde seleccionado ya no está disponible.");
      crustName = crust.name;
      crustPrice = Number(crust.prices[0]?.price ?? 0);
    }

    const modifierIds = Array.isArray(config.modifierIds) ? [...new Set(config.modifierIds.map(Number).filter(Number.isInteger))] : [];
    const modifiers = modifierIds.length
      ? await prisma.product.findMany({ where: { id: { in: modifierIds }, active: true, type: "MODIFIER" } })
      : [];
    if (modifiers.length !== modifierIds.length) throw new Error("Uno de los ingredientes extra ya no está disponible.");
    const modifiersPrice = modifiers.reduce((sum, item) => sum + Number(item.basePrice ?? 0), 0);

    const unitPrice = money(Number(size.basePrice) + flavorPrice + crustPrice + modifiersPrice);
    return {
      product,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      eligible: product.couponEligible,
      configuration: {
        kind: "PIZZA",
        size: { id: size.id, name: size.name, diameterCm: size.diameterCm },
        flavors: product.type === "PIZZA_TWO_FLAVORS"
          ? [{ id: config.firstFlavorId, name: firstFlavorName }, { id: config.secondFlavorId, name: secondFlavorName }]
          : [{ id: product.id, name: product.name }],
        crust: config.crustId ? { id: config.crustId, name: crustName } : null,
        modifiers: modifiers.map((item) => ({ id: item.id, name: item.name })),
      },
    };
  }

  if (product.type === "COMBO") {
    const config = configuration as unknown as ComboConfiguration;

    if (config.kind !== "COMBO") {
      const snapshot = clientSnapshot(line, product.name);
      return {
        product,
        quantity,
        unitPrice: snapshot.unitPrice,
        lineTotal: snapshot.unitPrice * quantity,
        eligible: false,
        configuration: snapshot.configuration,
      };
    }

    let regularPrice = 0;
    const pizzaSnapshots: unknown[] = [];
    const rule = product.comboPizzaRules[0];

    if (rule) {
      if (!Array.isArray(config.pizzas) || config.pizzas.length !== rule.quantity) throw new Error(`Completa las pizzas del combo ${product.name}.`);
      for (const choice of config.pizzas) {
        const sizeOption = rule.sizes.find((item) => item.sizeId === Number(choice.sizeId));
        const flavorOption = rule.flavors.find((item) => item.productId === Number(choice.flavorId));
        if (!sizeOption || !flavorOption) throw new Error(`Una opción del combo ${product.name} ya no es válida.`);
        regularPrice += Number(sizeOption.size.basePrice) + Number(flavorOption.product.basePrice ?? 0);
        pizzaSnapshots.push({ size: { id: sizeOption.size.id, name: sizeOption.size.name }, flavor: { id: flavorOption.product.id, name: flavorOption.product.name } });
      }
    }

    const groupSnapshots: unknown[] = [];
    for (const group of product.comboGroups) {
      const selectedIds = Array.isArray(config.groupSelections?.[String(group.id)])
        ? config.groupSelections[String(group.id)].map(Number)
        : [];
      if (selectedIds.length < group.minSelections || selectedIds.length > group.maxSelections) throw new Error(`Completa la selección de ${group.name}.`);
      const selectedOptions = group.options.filter((option) => selectedIds.includes(option.productId));
      if (selectedOptions.length !== selectedIds.length) throw new Error(`Una opción de ${group.name} ya no está disponible.`);
      for (const option of selectedOptions) regularPrice += Number(option.product.basePrice ?? 0) + Number(option.priceDelta);
      groupSnapshots.push({
        id: group.id,
        name: group.name,
        selections: selectedOptions.map((option) => ({ productId: option.productId, name: option.product.name, quantity: option.quantity })),
      });
    }

    const unitPrice = money(Math.max(0, regularPrice - Number(product.comboDiscount ?? 0)));
    return {
      product,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      eligible: false,
      configuration: { kind: "COMBO", pizzas: pizzaSnapshots, groups: groupSnapshots, discount: Number(product.comboDiscount ?? 0) },
    };
  }

  if (product.basePrice == null) throw new Error(`El producto ${product.name} no tiene precio disponible.`);
  const unitPrice = money(Number(product.basePrice));
  return {
    product,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    eligible: product.couponEligible,
    configuration: { kind: "STANDARD" },
  };
}

export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { customer: true, address: true, items: true, payments: true },
  });
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fulfillmentType = body.fulfillmentType as FulfillmentType;
    if (!(["DELIVERY", "PICKUP", "STORE"] as string[]).includes(fulfillmentType)) return NextResponse.json({ error: "Tipo de pedido inválido." }, { status: 400 });

    const lines = Array.isArray(body.items) ? body.items as CartLine[] : [];
    if (!lines.length) return NextResponse.json({ error: "El pedido no tiene productos." }, { status: 400 });
    if (lines.some((line) => !Number.isInteger(Number(line.productId)) || Number(line.quantity) < 1)) return NextResponse.json({ error: "Hay líneas de pedido inválidas." }, { status: 400 });

    const customerId = body.customerId == null ? null : Number(body.customerId);
    if ((fulfillmentType === "DELIVERY" || fulfillmentType === "PICKUP") && !customerId) return NextResponse.json({ error: "Este tipo de pedido requiere cliente." }, { status: 400 });

    let customer = null;
    let address = null;
    if (customerId) {
      customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { addresses: true } });
      if (!customer) return NextResponse.json({ error: "El cliente ya no existe." }, { status: 400 });
      if (fulfillmentType === "DELIVERY") {
        address = customer.addresses.find((item) => item.id === Number(body.addressId)) ?? customer.addresses[0] ?? null;
        if (!address) return NextResponse.json({ error: "El domicilio requiere una dirección registrada." }, { status: 400 });
      }
    }

    const settingsRow = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = parseSettings(settingsRow?.value ?? null);
    const paymentMethod = settings.paymentMethods?.find((method) => method.id === String(body.paymentMethodId) && method.active !== false);
    if (!paymentMethod) return NextResponse.json({ error: "El medio de pago seleccionado ya no está activo." }, { status: 400 });

    let deliveryFee = 0;
    let deliveryZoneId: string | null = null;
    let deliveryZoneName: string | null = null;
    if (fulfillmentType === "DELIVERY") {
      const zone = settings.deliveryBands?.find((item) => item.id === String(body.deliveryZoneId) && item.active !== false);
      if (!zone) return NextResponse.json({ error: "La tarifa de domicilio seleccionada ya no está activa." }, { status: 400 });
      deliveryFee = money(Number(zone.fee ?? 0));
      deliveryZoneId = zone.id;
      deliveryZoneName = zone.name?.trim() || "Domicilio";
    }

    const priced = await Promise.all(lines.map(priceLine));
    const subtotal = priced.reduce((sum, line) => sum + line.lineTotal, 0);
    const eligibleSubtotal = priced.filter((line) => line.eligible && line.product.type !== "COMBO").reduce((sum, line) => sum + line.lineTotal, 0);

    const discountMode = (["NONE", "COUPON", "MANUAL"] as string[]).includes(String(body.discountMode)) ? String(body.discountMode) as DiscountMode : "NONE";
    let discount = 0;
    let couponId: number | null = null;
    let couponName: string | null = null;

    if (discountMode === "COUPON") {
      couponId = Number(body.couponId);
      if (!couponId) return NextResponse.json({ error: "Selecciona un cupón válido." }, { status: 400 });
      const coupon = await prisma.coupon.findFirst({ where: { id: couponId, active: true } });
      if (!coupon) return NextResponse.json({ error: "El cupón seleccionado ya no está activo." }, { status: 400 });
      couponName = coupon.name;
      discount = coupon.type === "PERCENTAGE"
        ? money(eligibleSubtotal * (Number(coupon.value) / 100))
        : Math.min(money(Number(coupon.value)), eligibleSubtotal);
    } else if (discountMode === "MANUAL") {
      const requested = money(Math.max(0, Number(body.manualDiscount ?? body.discount ?? 0)));
      if (requested > eligibleSubtotal) return NextResponse.json({ error: "El descuento manual supera la base elegible." }, { status: 400 });
      discount = requested;
    }

    const total = Math.max(0, subtotal + deliveryFee - discount);
    const cashPayment = isCash(paymentMethod);
    const cashReceived = cashPayment ? money(Number(body.cashReceived ?? 0)) : null;
    const changeDue = cashPayment ? cashReceived! - total : null;
    if (cashPayment && (!Number.isFinite(cashReceived) || cashReceived! < total)) return NextResponse.json({ error: "El efectivo recibido debe ser igual o mayor al total." }, { status: 400 });

    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          customerId: customer?.id ?? null,
          addressId: fulfillmentType === "DELIVERY" ? address?.id ?? null : null,
          couponId,
          couponName,
          deliveryZoneId,
          deliveryZoneName,
          discountSource: discountMode,
          status: "CONFIRMED",
          fulfillmentType,
          source: "POS",
          subtotal,
          deliveryFee,
          discount,
          total,
          notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
          items: {
            create: priced.map((line) => ({
              productId: line.product.id,
              productName: line.product.name,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
              configuration: line.configuration as Prisma.InputJsonValue,
            })),
          },
          payments: {
            create: {
              method: paymentMethod.name,
              amount: total,
              cashReceived,
              changeDue,
              status: "PENDING",
            },
          },
        },
        include: { customer: true, address: true, items: true, payments: true },
      });
    });

    return NextResponse.json({
      order: {
        id: order.id,
        code: `ALT-${String(order.id).padStart(6, "0")}`,
        status: order.status,
        fulfillmentType: order.fulfillmentType,
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.deliveryFee),
        discount: Number(order.discount),
        total: Number(order.total),
        createdAt: order.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Order creation error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible crear el pedido." }, { status: 500 });
  }
}
