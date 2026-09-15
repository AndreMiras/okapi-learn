import { Redis } from "@upstash/redis";
import { describe, expect, it, vi } from "vitest";

import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import { RedisSessionStore } from "@/lib/session/redis-store";
import { syntheticAuthenticationResponse } from "@/tests/fixtures/upstream";

function fakeRedis(options: { failSet?: boolean } = {}) {
  const values = new Map<string, string>();
  const calls = { del: 0, get: 0, getdel: 0, set: 0 };
  return {
    calls,
    client: {
      async del(key: string) {
        calls.del += 1;
        return values.delete(key) ? 1 : 0;
      },
      async get(key: string) {
        calls.get += 1;
        return values.get(key) ?? null;
      },
      async getdel(key: string) {
        calls.getdel += 1;
        const value = values.get(key) ?? null;
        values.delete(key);
        return value;
      },
      async set(key: string, value: string) {
        calls.set += 1;
        if (options.failSet || values.has(key)) return null;
        values.set(key, value);
        return "OK";
      },
    } as unknown as Redis,
    values,
  };
}

function graph() {
  return normalizeAuthenticationResponse(syntheticAuthenticationResponse());
}

describe("RedisSessionStore", () => {
  it("shares encrypted session records across store instances", async () => {
    const redis = fakeRedis();
    const options = {
      redis: redis.client,
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    };
    const issued = await new RedisSessionStore(options).issue(graph());

    expect([...redis.values.values()][0]).not.toContain(
      "fictional-upstream-token",
    );
    const secondInstance = new RedisSessionStore(options);
    expect(
      (await secondInstance.read(issued.cookieValue))?.learners[0]?.name,
    ).toBe("Nova");
    expect(
      (await secondInstance.read(issued.cookieValue))?.courses[0]?.videos[0]
        ?.games,
    ).toHaveLength(3);
    expect((await secondInstance.delete(issued.cookieValue))?.token).toBe(
      "fictional-upstream-token",
    );
    expect(await secondInstance.read(issued.cookieValue)).toBeNull();
  });

  it("rejects records encrypted with another secret", async () => {
    const redis = fakeRedis();
    const options = {
      redis: redis.client,
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    };
    const store = new RedisSessionStore(options);
    const issued = await store.issue(graph());
    const otherRedis = fakeRedis();
    await new RedisSessionStore({
      redis: otherRedis.client,
      secret: "a-different-long-session-test-secret",
      ttlSeconds: 60,
    }).issue(graph());
    const key = [...redis.values.keys()][0]!;
    redis.values.set(key, [...otherRedis.values.values()][0]!);

    expect(await store.read(issued.cookieValue)).toBeNull();
    expect(redis.values.size).toBe(0);
  });

  it.each([undefined, "", "x".repeat(513)])(
    "rejects invalid cookie value %s without reading Redis",
    async (cookieValue) => {
      const redis = fakeRedis();
      const store = new RedisSessionStore({
        redis: redis.client,
        secret: "a-secret-long-enough-for-session-tests",
        ttlSeconds: 60,
      });

      expect(await store.read(cookieValue)).toBeNull();
      expect(redis.calls.get).toBe(0);
    },
  );

  it("returns null for an absent Redis record", async () => {
    const redis = fakeRedis();
    const store = new RedisSessionStore({
      redis: redis.client,
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    });

    expect(await store.read("fictional-missing-cookie")).toBeNull();
    expect(redis.calls.get).toBe(1);
  });

  it.each([
    "v3.nonce.tag.ciphertext",
    "v2.nonce.tag",
    "v2.nonce.tag.ciphertext.extra",
    "v1.nonce.tag.ciphertext",
  ])("rejects malformed encrypted record %s", async (encrypted) => {
    const redis = fakeRedis();
    const store = new RedisSessionStore({
      redis: redis.client,
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    });
    const issued = await store.issue(graph());
    const key = [...redis.values.keys()][0]!;
    redis.values.set(key, encrypted);

    expect(await store.read(issued.cookieValue)).toBeNull();
    expect(redis.values.size).toBe(0);
  });

  it("removes an expired encrypted record", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const redis = fakeRedis();
      const store = new RedisSessionStore({
        redis: redis.client,
        secret: "a-secret-long-enough-for-session-tests",
        ttlSeconds: 1,
      });
      const issued = await store.issue(graph());
      vi.setSystemTime(2_001);

      expect(await store.read(issued.cookieValue)).toBeNull();
      expect(redis.values.size).toBe(0);
      expect(redis.calls.del).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null when deleting invalid, missing, or malformed records", async () => {
    const redis = fakeRedis();
    const store = new RedisSessionStore({
      redis: redis.client,
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    });

    expect(await store.delete(undefined)).toBeNull();
    expect(await store.delete("x".repeat(513))).toBeNull();
    expect(redis.calls.getdel).toBe(0);
    expect(await store.delete("fictional-missing-cookie")).toBeNull();

    const issued = await store.issue(graph());
    const key = [...redis.values.keys()][0]!;
    redis.values.set(key, "malformed-record");
    expect(await store.delete(issued.cookieValue)).toBeNull();
    expect(redis.values.size).toBe(0);
  });

  it("rejects when Redis cannot reserve the session key", async () => {
    const redis = fakeRedis({ failSet: true });
    const store = new RedisSessionStore({
      redis: redis.client,
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    });

    await expect(store.issue(graph())).rejects.toThrow(
      "Failed to reserve session key",
    );
    expect(redis.calls.set).toBe(1);
  });
});
