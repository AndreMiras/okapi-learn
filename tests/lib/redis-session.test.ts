import { Redis } from "@upstash/redis";
import { describe, expect, it } from "vitest";

import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import { RedisSessionStore } from "@/lib/session/redis-store";
import { syntheticAuthenticationResponse } from "@/tests/fixtures/upstream";

function fakeRedis() {
  const values = new Map<string, string>();
  return {
    client: {
      async del(key: string) {
        return values.delete(key) ? 1 : 0;
      },
      async get(key: string) {
        return values.get(key) ?? null;
      },
      async getdel(key: string) {
        const value = values.get(key) ?? null;
        values.delete(key);
        return value;
      },
      async set(key: string, value: string) {
        if (values.has(key)) return null;
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
    expect((await secondInstance.delete(issued.cookieValue))?.token).toBe(
      "fictional-upstream-token",
    );
    expect(await secondInstance.read(issued.cookieValue)).toBeNull();
  });

  it("rejects records encrypted with another secret", async () => {
    const redis = fakeRedis();
    const issued = await new RedisSessionStore({
      redis: redis.client,
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    }).issue(graph());

    expect(
      await new RedisSessionStore({
        redis: redis.client,
        secret: "a-different-long-session-test-secret",
        ttlSeconds: 60,
      }).read(issued.cookieValue),
    ).toBeNull();
  });
});
