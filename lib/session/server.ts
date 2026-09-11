import "server-only";

import { cookies } from "next/headers";

import { getServerConfig } from "@/lib/config/server";

import { MemorySessionStore, SESSION_COOKIE_NAME } from "./store";

declare global {
  var __merriloopSessionStore: MemorySessionStore | undefined;
}

export function getSessionStore(): MemorySessionStore {
  if (!globalThis.__merriloopSessionStore) {
    const config = getServerConfig();
    globalThis.__merriloopSessionStore = new MemorySessionStore({
      secret: config.sessionSecret,
      ttlSeconds: config.sessionTtlSeconds,
    });
  }
  return globalThis.__merriloopSessionStore;
}

export async function readCurrentSession() {
  const value = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return getSessionStore().read(value);
}

export function sessionCookieOptions(expires: Date) {
  return {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function expiredSessionCookieOptions() {
  return sessionCookieOptions(new Date(0));
}
