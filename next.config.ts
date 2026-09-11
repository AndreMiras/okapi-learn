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
      {
        source: "/(learners|learn/:path*)",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
