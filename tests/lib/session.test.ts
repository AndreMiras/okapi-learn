import { describe, expect, it, vi } from "vitest";

import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import {
  expiredSessionCookieOptions,
  sessionCookieOptions,
} from "@/lib/session/server";
import { MemorySessionStore, SessionCapacityError } from "@/lib/session/store";
import { syntheticAuthenticationResponse } from "@/tests/fixtures/upstream";

function randomSequence() {
  let value = 0;
  return (size: number) => Buffer.alloc(size, ++value);
}

function graph() {
  return normalizeAuthenticationResponse(syntheticAuthenticationResponse());
}

describe("MemorySessionStore", () => {
  it("issues, reads, rotates, and deletes opaque sessions", () => {
    const store = new MemorySessionStore({
      now: () => 1_000,
      random: randomSequence(),
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    });
    const first = store.issue(graph());
    const second = store.issue(graph());
    expect(first.cookieValue).not.toBe(second.cookieValue);
    expect(first.cookieValue).not.toContain("learner-nova");
    expect(store.read(first.cookieValue)?.learners[0]?.name).toBe("Nova");
    expect(store.delete(first.cookieValue)?.token).toBe(
      "fictional-upstream-token",
    );
    expect(store.read(first.cookieValue)).toBeNull();
  });

  it.each([
    "",
    "v2.61000.invalid.signature",
    "v1.words.invalid.signature",
    "v1.61000.short.signature",
    "x".repeat(513),
  ])("rejects malformed or unsupported cookie %s", (cookie) => {
    const store = new MemorySessionStore({
      now: () => 1_000,
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    });
    expect(store.read(cookie)).toBeNull();
  });

  it("rejects tampering, a wrong secret, authenticated expiry changes, and missing records", () => {
    const options = {
      now: () => 1_000,
      random: randomSequence(),
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 60,
    };
    const store = new MemorySessionStore(options);
    const issued = store.issue(graph());
    const parts = issued.cookieValue.split(".");
    expect(store.read(`${parts.slice(0, 3).join(".")}.bad`)).toBeNull();
    expect(store.read(issued.cookieValue.replace("61000", "62000"))).toBeNull();
    expect(
      new MemorySessionStore({
        ...options,
        secret: "a-different-long-session-test-secret",
      }).read(issued.cookieValue),
    ).toBeNull();
    expect(new MemorySessionStore(options).read(issued.cookieValue)).toBeNull();
  });

  it("expires records without sliding their lifetime and frees capacity", () => {
    let now = 1_000;
    const store = new MemorySessionStore({
      maximumSessions: 1,
      now: () => now,
      random: randomSequence(),
      secret: "a-secret-long-enough-for-session-tests",
      ttlSeconds: 1,
    });
    const issued = store.issue(graph());
    expect(() => store.issue(graph())).toThrow(SessionCapacityError);
    now = 2_000;
    expect(store.read(issued.cookieValue)).toBeNull();
    expect(store.size).toBe(0);
    expect(() => store.issue(graph())).not.toThrow();
  });

  it("uses matching security attributes when setting and deleting cookies", () => {
    vi.stubEnv("PUBLIC_APP_ORIGIN", "https://learn.okapi.example");
    const active = sessionCookieOptions(new Date(10_000));
    const expired = expiredSessionCookieOptions();
    expect({ ...active, expires: undefined }).toEqual({
      ...expired,
      expires: undefined,
    });
    expect(active).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(expired.expires.getTime()).toBe(0);

    vi.stubEnv("PUBLIC_APP_ORIGIN", "http://localhost:3100");
    expect(sessionCookieOptions(new Date(10_000)).secure).toBe(false);
  });
});
