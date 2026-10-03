import "server-only";

import { getSessionStore } from "./server";
import { SESSION_COOKIE_NAME } from "./store";

export function sessionCookieFromRequest(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
}

export async function readRequestSession(request: Request) {
  const cookieValue = sessionCookieFromRequest(request);
  if (!cookieValue) return null;
  const session = await getSessionStore().read(cookieValue);
  return session ? Object.freeze({ cookieValue, session }) : null;
}
