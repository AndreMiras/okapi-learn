import { UpstreamError } from "./errors";

export function normalizeServerHeldMediaUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw new UpstreamError("invalid_response");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UpstreamError("invalid_response");
  }

  if (
    ((url.protocol !== "https:" || (url.port && url.port !== "443")) &&
      !(
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1")
      )) ||
    url.username ||
    url.password ||
    url.hash ||
    !url.hostname
  ) {
    throw new UpstreamError("invalid_response");
  }

  return url.href;
}

export function selectPlayableMediaUrl(
  value: string | null,
  enabled: boolean,
  allowedOrigins: readonly string[],
): string | null {
  if (!enabled || !value) return null;
  const url = new URL(value);
  return allowedOrigins.includes(url.origin) ? value : null;
}
