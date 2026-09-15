import { type NextRequest, NextResponse } from "next/server";

import { getServerConfig } from "@/lib/config/server";
import { createContentSecurityPolicy } from "@/lib/security/headers";

export function proxy(request: NextRequest) {
  const serverConfig =
    request.nextUrl.pathname === "/api/health" ? null : getServerConfig();
  const mediaOrigins = serverConfig
    ? [
        ...(serverConfig.audioPlaybackEnabled
          ? serverConfig.allowedAudioOrigins
          : []),
        ...(serverConfig.videoPlaybackEnabled
          ? serverConfig.allowedVideoOrigins
          : []),
      ]
    : [];
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = createContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
    mediaOrigins,
    serverConfig?.gamePlaybackEnabled ?? false,
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
