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
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    !url.hostname ||
    (url.port && url.port !== "443")
  ) {
    throw new UpstreamError("invalid_response");
  }

  return url.href;
}
