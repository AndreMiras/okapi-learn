import "server-only";

import { cookies } from "next/headers";
import { Redis } from "@upstash/redis";

import { getServerConfig } from "@/lib/config/server";

import { RedisSessionStore } from "./redis-store";
import {
  MemorySessionStore,
  SESSION_COOKIE_NAME,
  type SessionStore,
} from "./store";

declare global {
  var __merriloopSessionStore: SessionStore | undefined;
}

export function getSessionStore(): SessionStore {
  if (!globalThis.__merriloopSessionStore) {
    const config = getServerConfig();
    const redisUrl = process.env.KV_REST_API_URL?.trim();
    const redisToken = process.env.KV_REST_API_TOKEN?.trim();
    if (Boolean(redisUrl) !== Boolean(redisToken)) {
      throw new Error("Both Upstash Redis credentials must be configured");
    }
    if (process.env.VERCEL && !redisUrl) {
      throw new Error("Upstash Redis is required when running on Vercel");
    }
    globalThis.__merriloopSessionStore = redisUrl
      ? new RedisSessionStore({
          redis: new Redis({ token: redisToken!, url: redisUrl }),
          secret: config.sessionSecret,
          ttlSeconds: config.sessionTtlSeconds,
        })
      : new MemorySessionStore({
          secret: config.sessionSecret,
          ttlSeconds: config.sessionTtlSeconds,
        });
  }
  return globalThis.__merriloopSessionStore;
}

export async function readCurrentSession() {
  const value = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return await getSessionStore().read(value);
}

export function sessionCookieOptions(expires: Date) {
  const publicOrigin = process.env.PUBLIC_APP_ORIGIN;
  return {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: publicOrigin
      ? new URL(publicOrigin).protocol === "https:"
      : process.env.NODE_ENV === "production",
  };
}

export function expiredSessionCookieOptions() {
  return sessionCookieOptions(new Date(0));
}
