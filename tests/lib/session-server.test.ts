import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validEnvironment = {
  ALLOWED_AUDIO_ORIGINS: "",
  ALLOWED_VIDEO_ORIGINS: "",
  ENABLE_AUDIO_PLAYBACK: "false",
  ENABLE_VIDEO_PLAYBACK: "false",
  MYLOCKER_API_BASE_URL: "http://127.0.0.1:4100",
  NODE_ENV: "test",
  PUBLIC_APP_ORIGIN: "http://localhost:3000",
  SESSION_SECRET: "a-fictional-session-secret-at-least-32-bytes",
  SESSION_TTL_SECONDS: "3600",
};

async function loadSessionModules() {
  const [{ getSessionStore }, { RedisSessionStore }, { MemorySessionStore }] =
    await Promise.all([
      import("@/lib/session/server"),
      import("@/lib/session/redis-store"),
      import("@/lib/session/store"),
    ]);
  return { getSessionStore, MemorySessionStore, RedisSessionStore };
}

describe("getSessionStore", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [name, value] of Object.entries(validEnvironment)) {
      vi.stubEnv(name, value);
    }
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    globalThis.__merriloopSessionStore = undefined;
  });

  afterEach(() => {
    globalThis.__merriloopSessionStore = undefined;
    vi.unstubAllEnvs();
  });

  it("uses process-local memory outside Vercel when Redis is not configured", async () => {
    const { getSessionStore, MemorySessionStore } = await loadSessionModules();

    expect(getSessionStore()).toBeInstanceOf(MemorySessionStore);
  });

  it.each([
    ["https://fictional-redis.example", ""],
    ["", "fictional-redis-token"],
  ])("rejects partially configured Redis", async (url, token) => {
    vi.stubEnv("KV_REST_API_URL", url);
    vi.stubEnv("KV_REST_API_TOKEN", token);
    const { getSessionStore } = await loadSessionModules();

    expect(() => getSessionStore()).toThrow(
      "Both Upstash Redis credentials must be configured",
    );
  });

  it("requires Redis when running on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    const { getSessionStore } = await loadSessionModules();

    expect(() => getSessionStore()).toThrow(
      "Upstash Redis is required when running on Vercel",
    );
  });

  it("uses Redis when both fictional credentials are configured", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://fictional-redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "fictional-redis-token");
    const { getSessionStore, RedisSessionStore } = await loadSessionModules();

    expect(getSessionStore()).toBeInstanceOf(RedisSessionStore);
  });

  it("reuses a previously initialized global store", async () => {
    const existing = {
      delete: vi.fn(),
      issue: vi.fn(),
      read: vi.fn(),
    };
    globalThis.__merriloopSessionStore = existing;
    vi.stubEnv("SESSION_SECRET", "invalid");
    const { getSessionStore } = await loadSessionModules();

    expect(getSessionStore()).toBe(existing);
  });
});
