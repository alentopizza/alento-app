import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeRoute,
  GoogleRouteUnavailableError,
} from "@/lib/googleMapsServer";

const originalServerKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalServerKey == null) {
    delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
  } else {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = originalServerKey;
  }
});

describe("Google Routes response handling", () => {
  it("classifies an empty routes response as a route-unavailable condition", async () => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = "test-server-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ routes: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      computeRoute(
        {
          origin: { latitude: 4.6, longitude: -74.1 },
          destination: { latitude: 4.7, longitude: -74.2 },
        },
        "DRIVE",
      ),
    ).rejects.toBeInstanceOf(GoogleRouteUnavailableError);
  });
});
