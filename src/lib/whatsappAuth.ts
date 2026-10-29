export async function sendCustomerOtpWhatsApp(phoneE164: string, code: string, name = "NUEVO") {
  const webhookUrl = process.env.MAKE_WHATSAPP_OTP_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("MAKE_WHATSAPP_OTP_WEBHOOK_URL no está configurado.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: phoneE164,
      code,
      name,
    }),
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    console.error("Make OTP webhook error", {
      status: response.status,
      response: responseText.slice(0, 500),
    });
    throw new Error("No fue posible entregar el código al servicio de mensajería.");
  }

  return {
    provider: "make" as const,
    status: response.status,
  };
}
