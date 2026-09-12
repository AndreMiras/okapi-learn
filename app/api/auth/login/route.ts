import { NextResponse } from "next/server";

import { getServerConfig } from "@/lib/config/server";
import { isUpstreamError } from "@/lib/mylocker/errors";
import { authenticate } from "@/lib/mylocker/client";
import { hasValidMutationOrigin } from "@/lib/security/origin";
import { LoginRateLimiter } from "@/lib/security/rate-limit";
import { getSessionStore, sessionCookieOptions } from "@/lib/session/server";
import { SESSION_COOKIE_NAME, SessionCapacityError } from "@/lib/session/store";

const MAX_BODY_BYTES = 4_096;

declare global {
  var __merriloopLoginLimiter: LoginRateLimiter | undefined;
}

function errorResponse(error: string, status: number, retryAfter?: number) {
  const response = NextResponse.json({ error }, { status });
  response.headers.set("Cache-Control", "private, no-store");
  if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
  return response;
}

function clientAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local"
  );
}

export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request))
    return errorResponse("invalid_request", 403);
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return errorResponse("invalid_request", 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES)
    return errorResponse("invalid_request", 413);

  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      return errorResponse("invalid_request", 413);
    }
    body = JSON.parse(text);
  } catch {
    return errorResponse("invalid_request", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("invalid_request", 400);
  }
  const values = body as Record<string, unknown>;
  const username =
    typeof values.username === "string" ? values.username.trim() : "";
  if (
    Object.keys(values).length !== 2 ||
    typeof values.username !== "string" ||
    typeof values.password !== "string" ||
    username.length < 1 ||
    username.length > 320 ||
    values.password.length < 1 ||
    values.password.length > 1_024
  ) {
    return errorResponse("invalid_request", 400);
  }

  const config = getServerConfig();
  globalThis.__merriloopLoginLimiter ??= new LoginRateLimiter(
    config.sessionSecret,
  );
  if (
    !globalThis.__merriloopLoginLimiter.allow(clientAddress(request), username)
  ) {
    return errorResponse("try_later", 429, 60);
  }

  try {
    const graph = await authenticate({
      password: values.password,
      username,
    });
    if (graph.termsPending) return errorResponse("terms_pending", 403);
    if (graph.gameTester || graph.gameMapTester) {
      return errorResponse("account_unavailable", 403);
    }

    const store = getSessionStore();
    const existingCookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);
    await store.delete(existingCookie);
    const issued = await store.issue(graph);
    const response = NextResponse.json({ ok: true });
    response.headers.set("Cache-Control", "private, no-store");
    response.cookies.set(
      SESSION_COOKIE_NAME,
      issued.cookieValue,
      sessionCookieOptions(new Date(issued.expiresAt)),
    );
    return response;
  } catch (error) {
    if (error instanceof SessionCapacityError)
      return errorResponse("try_later", 503);
    if (isUpstreamError(error)) {
      if (error.category === "authentication_rejected") {
        return errorResponse("sign_in_failed", 401);
      }
      if (error.category === "rate_limited")
        return errorResponse("try_later", 429, 60);
      return errorResponse("service_unavailable", 503);
    }
    return errorResponse("service_unavailable", 503);
  }
}
