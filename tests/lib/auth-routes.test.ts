import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import { MemorySessionStore, SESSION_COOKIE_NAME } from "@/lib/session/store";
import {
  FICTIONAL_PASSWORD,
  FICTIONAL_TOKEN,
  FICTIONAL_USERNAME,
  syntheticAuthenticationResponse,
} from "@/tests/fixtures/upstream";

const origin = "http://localhost:3000";
const secret = "a-fictional-secret-that-is-long-enough";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/auth/login`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Host: "localhost:3000",
      Origin: origin,
      ...headers,
    },
    method: "POST",
  });
}

function successfulFetch(payload: unknown = syntheticAuthenticationResponse()) {
  return vi.fn(async () =>
    Response.json(payload, { headers: { "Cache-Control": "no-store" } }),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MYLOCKER_API_BASE_URL", "http://127.0.0.1:4100");
  vi.stubEnv("PUBLIC_APP_ORIGIN", origin);
  vi.stubEnv("SESSION_SECRET", secret);
  vi.stubEnv("SESSION_TTL_SECONDS", "3600");
  globalThis.__merriloopSessionStore = undefined;
  globalThis.__merriloopLoginLimiter = undefined;
});

describe("login Route Handler", () => {
  it("creates only an opaque session and calls upstream exactly once", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    const response = await login(
      request({ username: FICTIONAL_USERNAME, password: FICTIONAL_PASSWORD }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).not.toContain(FICTIONAL_TOKEN);
    expect(cookie).not.toContain("learner-nova");
    const retained = JSON.stringify(globalThis.__merriloopSessionStore);
    expect(retained).not.toContain(FICTIONAL_PASSWORD);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("enforces origin, host, content type, exact fields, and body size before fetch", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    const cases = [
      new Request(`${origin}/api/auth/login`, { method: "POST" }),
      request(
        { username: FICTIONAL_USERNAME, password: FICTIONAL_PASSWORD },
        { Origin: "https://evil.example" },
      ),
      request({
        username: FICTIONAL_USERNAME,
        password: FICTIONAL_PASSWORD,
        extra: true,
      }),
      request({ username: FICTIONAL_USERNAME, password: "x".repeat(1_025) }),
    ];
    for (const invalid of cases) expect((await login(invalid)).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["terms", { TermsPending: true }, "terms_pending"],
    ["game tester", { GameTester: true }, "account_unavailable"],
    ["map tester", { GameMapTester: true }, "account_unavailable"],
  ])(
    "fails closed for %s without a usable session",
    async (_name, update, code) => {
      vi.stubGlobal(
        "fetch",
        successfulFetch({ ...syntheticAuthenticationResponse(), ...update }),
      );
      const response = await login(
        request({ username: FICTIONAL_USERNAME, password: FICTIONAL_PASSWORD }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: code });
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(globalThis.__merriloopSessionStore?.size ?? 0).toBe(0);
    },
  );

  it.each([
    [401, "sign_in_failed"],
    [403, "service_unavailable"],
    [429, "try_later"],
    [500, "service_unavailable"],
  ])("maps upstream %s to a safe error", async (status, code) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status })),
    );
    const response = await login(
      request({ username: FICTIONAL_USERNAME, password: FICTIONAL_PASSWORD }),
    );
    expect(await response.json()).toEqual({ error: code });
  });

  it("limits repeated submissions without additional upstream calls", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await login(
        request({
          username: `${attempt}@example.test`,
          password: FICTIONAL_PASSWORD,
        }),
      );
    }
    const limited = await login(
      request({ username: "last@example.test", password: FICTIONAL_PASSWORD }),
    );
    expect(limited.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});

describe("logout Route Handler", () => {
  it("deletes local state before one best-effort upstream call and is idempotent", async () => {
    const store = new MemorySessionStore({ secret, ttlSeconds: 60 });
    globalThis.__merriloopSessionStore = store;
    const issued = store.issue(
      normalizeAuthenticationResponse(syntheticAuthenticationResponse()),
    );
    const fetchMock = vi.fn(async () => {
      expect(store.read(issued.cookieValue)).toBeNull();
      throw new TypeError("fictional disconnect");
    });
    vi.stubGlobal("fetch", fetchMock);
    const logoutRequest = new Request(`${origin}/api/auth/logout`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${issued.cookieValue}`,
        Host: "localhost:3000",
        Origin: origin,
      },
      method: "POST",
    });
    const response = await logout(logoutRequest);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie")).toContain(
      "Expires=Thu, 01 Jan 1970",
    );

    const repeated = await logout(logoutRequest);
    expect(repeated.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
