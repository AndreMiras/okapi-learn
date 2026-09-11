import "server-only";

import { getServerConfig } from "@/lib/config/server";

export function hasValidMutationOrigin(request: Request): boolean {
  const expected = new URL(getServerConfig().publicAppOrigin);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return (
      origin === expected.origin &&
      new URL(origin).origin === origin &&
      host === expected.host
    );
  } catch {
    return false;
  }
}
