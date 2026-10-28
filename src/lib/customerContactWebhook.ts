import { prisma } from "@/lib/prisma";
import { reportOperationalIncident } from "@/lib/observability";

export type CustomerContactWebhookSource =
  | "STAFF"
  | "WEB_CHECKOUT"
  | "CUSTOMER_ACCOUNT";

export type CustomerContactWebhookResult =
  | { ok: true; status: "sent" | "already_sent" | "not_pending" }
  | {
      ok: false;
      status:
        | "not_configured"
        | "incomplete_customer"
        | "failed";
      reason: string;
    };

function digits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizedContactPhone(args: {
  countryCode: string | null;
  phone: string | null;
}) {
  const countryDigits = digits(args.countryCode) || "57";
  let localPhone = digits(args.phone);

  if (
    countryDigits &&
    localPhone.startsWith(countryDigits) &&
    localPhone.length > countryDigits.length + 6
  ) {
    localPhone = localPhone.slice(countryDigits.length);
  }

  return {
    indicativo: `+${countryDigits}`,
    telefono: localPhone,
    telefonoCompleto: localPhone
      ? `+${countryDigits}${localPhone}`
      : "",
  };
}

function validCustomerName(value: string) {
  const normalized = value.trim();
  return Boolean(
    normalized &&
      normalized.toLocaleUpperCase("es") !== "NUEVO",
  );
}

export async function sendCustomerContactWebhook(args: {
  customerId: number;
  source: CustomerContactWebhookSource;
}): Promise<CustomerContactWebhookResult> {
  const webhookUrl =
    process.env.CUSTOMER_CREATED_WEBHOOK_URL?.trim() ?? "";

  if (!webhookUrl) {
    return {
      ok: false,
      status: "not_configured",
      reason:
        "CUSTOMER_CREATED_WEBHOOK_URL no está configurada.",
    };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: args.customerId },
    select: {
      id: true,
      name: true,
      countryCode: true,
      phone: true,
      createdAt: true,
      contactWebhookPending: true,
      contactWebhookSentAt: true,
    },
  });

  if (!customer) {
    return {
      ok: false,
      status: "failed",
      reason: "Cliente no encontrado.",
    };
  }

  if (customer.contactWebhookSentAt) {
    return { ok: true, status: "already_sent" };
  }

  if (!customer.contactWebhookPending) {
    return { ok: true, status: "not_pending" };
  }

  const phone = normalizedContactPhone({
    countryCode: customer.countryCode,
    phone: customer.phone,
  });

  if (
    !validCustomerName(customer.name) ||
    !phone.telefono ||
    !phone.telefonoCompleto
  ) {
    return {
      ok: false,
      status: "incomplete_customer",
      reason:
        "El cliente todavía no tiene nombre y teléfono válidos.",
    };
  }

  const payload = {
    evento: "cliente.registrado",
    clienteId: customer.id,
    nombre: customer.name.trim(),
    indicativo: phone.indicativo,
    telefono: phone.telefono,
    telefonoCompleto: phone.telefonoCompleto,
    origen: args.source,
    registradoEn: customer.createdAt.toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      const responseText = await response
        .text()
        .catch(() => "");

      await reportOperationalIncident({
        level: "WARNING",
        category: "INTEGRATION",
        code: "CUSTOMER_CONTACT_WEBHOOK_REJECTED",
        message: `El webhook de contactos respondió HTTP ${response.status}.`,
        source: "lib/customerContactWebhook",
        entityType: "CUSTOMER",
        entityId: customer.id,
        fingerprintKey: String(response.status),
        metadata: {
          source: args.source,
          status: response.status,
          responsePreview: responseText.slice(0, 120),
        },
      });

      return {
        ok: false,
        status: "failed",
        reason: `Webhook respondió ${response.status}.`,
      };
    }

    await prisma.customer.updateMany({
      where: {
        id: customer.id,
        contactWebhookPending: true,
        contactWebhookSentAt: null,
      },
      data: {
        contactWebhookPending: false,
        contactWebhookSentAt: new Date(),
      },
    });

    return { ok: true, status: "sent" };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "No fue posible enviar el webhook.";

    await reportOperationalIncident({
      level: "WARNING",
      category: "INTEGRATION",
      code: "CUSTOMER_CONTACT_WEBHOOK_UNREACHABLE",
      message: reason,
      source: "lib/customerContactWebhook",
      entityType: "CUSTOMER",
      entityId: customer.id,
      fingerprintKey: args.source,
      metadata: {
        source: args.source,
      },
    });

    return {
      ok: false,
      status: "failed",
      reason,
    };
  }
}
