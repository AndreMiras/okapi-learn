import { describe, expect, it } from "vitest";

import { LoginRateLimiter } from "@/lib/security/rate-limit";

describe("LoginRateLimiter", () => {
  it("limits IP and keyed username independently and resets after the window", () => {
    let now = 0;
    const limiter = new LoginRateLimiter("fictional-limiter-secret", () => now);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(limiter.allow("192.0.2.1", `person-${attempt}`)).toBe(true);
    }
    expect(limiter.allow("192.0.2.1", "another-person")).toBe(false);
    now = 5 * 60 * 1_000;
    expect(limiter.allow("192.0.2.1", "another-person")).toBe(true);
  });

  it("normalizes username case before limiting", () => {
    const limiter = new LoginRateLimiter("fictional-limiter-secret", () => 0);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(limiter.allow(`192.0.2.${attempt}`, "Person@Example.test")).toBe(
        true,
      );
    }
    expect(limiter.allow("198.51.100.1", "person@example.test")).toBe(false);
  });
});
