import { NextResponse } from "next/server";

import { logout } from "@/lib/mylocker/client";
import { hasValidMutationOrigin } from "@/lib/security/origin";
import {
  expiredSessionCookieOptions,
  getSessionStore,
} from "@/lib/session/server";
import { SESSION_COOKIE_NAME } from "@/lib/session/store";

export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const cookieValue = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
  const record = getSessionStore().delete(cookieValue);
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(SESSION_COOKIE_NAME, "", expiredSessionCookieOptions());
  if (record) await logout(record.token);
  return response;
}
