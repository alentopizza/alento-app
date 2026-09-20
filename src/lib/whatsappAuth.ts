export async function sendCustomerOtpWhatsApp(phoneE164: string, code: string, name = "NUEVO") {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION;
  const templateName = process.env.WHATSAPP_AUTH_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_AUTH_LANGUAGE_CODE || "es";

  if (!token || !phoneNumberId || !graphVersion || !templateName) {
    if (process.env.NODE_ENV !== "production" && process.env.WHATSAPP_DEV_LOG_OTP === "1") {
      console.info(`[DEV OTP] ${phoneE164} · ${name}: ${code}`);
      return { provider: "development" as const };
    }
    throw new Error("WhatsApp OTP no está configurado.");
  }

  const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phoneE164.replace(/^\+/, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: code }],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }],
          },
        ],
      },
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("WhatsApp OTP error", result);
    throw new Error("No fue posible enviar el código por WhatsApp.");
  }

  return { provider: "whatsapp" as const, result };
}
