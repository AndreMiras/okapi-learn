import type { NextConfig } from "next";

import { createSecurityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...createSecurityHeaders(process.env.NODE_ENV === "production"),
        ],
      },
    ];
  },
};

export default nextConfig;
