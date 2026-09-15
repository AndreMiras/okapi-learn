export type SecurityHeader = Readonly<{ key: string; value: string }>;

export function createContentSecurityPolicy(
  nonce: string,
  development: boolean,
  mediaOrigins: readonly string[] = [],
  gamePlaybackEnabled = false,
): string {
  const developmentEval = development ? " 'unsafe-eval'" : "";
  const styleSource = development
    ? "'self' 'unsafe-inline'"
    : `'self' 'nonce-${nonce}'`;
  const mediaSources = [
    ...new Set([...mediaOrigins, ...(gamePlaybackEnabled ? ["blob:"] : [])]),
  ];
  const mediaSource = mediaSources.length ? mediaSources.join(" ") : "'none'";
  const imageSource = gamePlaybackEnabled
    ? "img-src 'self' data: blob:"
    : "img-src 'self' data:";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    imageSource,
    `media-src ${mediaSource}`,
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentEval}`,
    `style-src ${styleSource}`,
  ].join("; ");
}

export function createSecurityHeaders(
  production: boolean,
): readonly SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    },
  ];
  if (production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}
