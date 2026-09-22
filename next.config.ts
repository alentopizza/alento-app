import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "pos.alentopizza.com" }],
        destination: "https://alentopizza.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.alentopizza.com" }],
        destination: "https://alentopizza.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
