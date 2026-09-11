import { describe, expect, it } from "vitest";

import {
  createContentSecurityPolicy,
  createSecurityHeaders,
} from "@/lib/security/headers";

function asRecord(production: boolean) {
  return Object.fromEntries(
    createSecurityHeaders(production).map(({ key, value }) => [key, value]),
  );
}

describe("createSecurityHeaders", () => {
  it("sets the restrictive baseline", () => {
    const headers = asRecord(false);
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });

  it("creates a nonce-bound production CSP without eval", () => {
    const policy = createContentSecurityPolicy("fictional-nonce", false);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("media-src 'none'");
    expect(policy).toContain("'nonce-fictional-nonce'");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("permits eval only for framework development diagnostics", () => {
    expect(createContentSecurityPolicy("fictional-nonce", true)).toContain(
      "'unsafe-eval'",
    );
  });

  it("sets HSTS only in production", () => {
    expect(asRecord(true)["Strict-Transport-Security"]).toContain(
      "max-age=31536000",
    );
    expect(asRecord(false)["Strict-Transport-Security"]).toBeUndefined();
  });
});
