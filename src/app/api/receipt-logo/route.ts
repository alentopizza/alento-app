const RECEIPT_LOGO_URL =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET() {
  try {
    const response = await fetch(RECEIPT_LOGO_URL, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return new Response("No fue posible cargar el logo.", {
        status: 502,
      });
    }

    const bytes = await response.arrayBuffer();

    return new Response(bytes, {
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "image/png",
        "Cache-Control":
          "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("No fue posible cargar el logo.", {
      status: 502,
    });
  }
}
