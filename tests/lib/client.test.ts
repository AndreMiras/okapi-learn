import { afterEach, describe, expect, it, vi } from "vitest";

import { createUpstreamClient } from "@/lib/mylocker/client";
import { UpstreamError } from "@/lib/mylocker/errors";
import {
  FICTIONAL_PASSWORD,
  FICTIONAL_TOKEN,
  FICTIONAL_USERNAME,
  startSyntheticUpstream,
  type FixtureScenario,
} from "@/tests/fixtures/upstream";

const openFixtures: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(openFixtures.splice(0).map(({ close }) => close()));
});

async function setup(scenario: FixtureScenario = "success", timeoutMs = 500) {
  const fixture = await startSyntheticUpstream(scenario);
  openFixtures.push(fixture);
  return {
    client: createUpstreamClient({
      apiBaseUrl: fixture.baseUrl,
      maxResponseBytes: scenario === "oversized" ? 1_000 : undefined,
      timeoutMs,
    }),
    fixture,
  };
}

const credentials = {
  password: FICTIONAL_PASSWORD,
  username: FICTIONAL_USERNAME,
};

describe("createUpstreamClient", () => {
  it("makes exactly one strict authentication request", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const { client, fixture } = await setup();
    const graph = await client.authenticate(credentials);
    expect(graph.token).toBe(FICTIONAL_TOKEN);
    expect(fixture.ledger).toHaveLength(1);
    expect(fixture.ledger[0]).toMatchObject({
      accepted: true,
      fieldNames: ["PasswordHash", "Username", "isTablet"],
      method: "POST",
      path: "/api/Alumnes/AutenticateUser",
    });
    expect(fixture.ledger[0]?.headerNames).not.toContain("authorization");
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("makes one bounded best-effort logout request with only the token", async () => {
    const { client, fixture } = await setup();
    await client.logout(FICTIONAL_TOKEN);
    expect(fixture.ledger).toHaveLength(1);
    expect(fixture.ledger[0]).toMatchObject({
      accepted: true,
      fieldNames: [],
      method: "POST",
      path: "/api/Alumnes/LogOut",
    });
  });

  it.each([
    ["rejected", "authentication_rejected"],
    ["forbidden", "forbidden"],
    ["rate-limited", "rate_limited"],
    ["server-error", "unavailable"],
    ["wrong-content-type", "invalid_response"],
    ["malformed-json", "invalid_response"],
    ["oversized", "invalid_response"],
    ["disconnect", "unavailable"],
  ] as const)("maps %s to a safe %s error", async (scenario, category) => {
    const { client } = await setup(scenario);
    await expect(client.authenticate(credentials)).rejects.toMatchObject({
      category,
    });
  });

  it("times out once without retry", async () => {
    const { client, fixture } = await setup("timeout", 20);
    await expect(client.authenticate(credentials)).rejects.toMatchObject({
      category: "timeout",
    });
    expect(fixture.ledger).toHaveLength(1);
  });

  it("never exposes upstream details in errors", async () => {
    const { client } = await setup("server-error");
    const error = await client
      .authenticate(credentials)
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(UpstreamError);
    const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
    expect(serialized).not.toContain(FICTIONAL_USERNAME);
    expect(serialized).not.toContain(FICTIONAL_PASSWORD);
    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("AutenticateUser");
  });

  it("rejects a streamed body that crosses the byte limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response(new Uint8Array(1_100), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    const client = createUpstreamClient({
      apiBaseUrl: "http://127.0.0.1:4100",
      maxResponseBytes: 1_000,
    });
    await expect(client.authenticate(credentials)).rejects.toMatchObject({
      category: "invalid_response",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects invalid UTF-8 and empty response bodies", async () => {
    const client = createUpstreamClient({
      apiBaseUrl: "http://127.0.0.1:4100",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response(new Uint8Array([0xc3, 0x28]), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    await expect(client.authenticate(credentials)).rejects.toMatchObject({
      category: "invalid_response",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response(null, {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    await expect(client.authenticate(credentials)).rejects.toMatchObject({
      category: "invalid_response",
    });
  });

  it("maps an explicit abort without retrying", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("fictional", "AbortError");
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = createUpstreamClient({
      apiBaseUrl: "http://127.0.0.1:4100",
    });
    await expect(client.authenticate(credentials)).rejects.toMatchObject({
      category: "timeout",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("synthetic upstream rejection", () => {
  it.each([
    ["GET", "/api/Alumnes/AutenticateUser", undefined],
    ["POST", "/api/Alumnes/AuthenticateUser", credentials],
    ["POST", "/api/Alumnes/AutenticateUser", { username: FICTIONAL_USERNAME }],
    [
      "POST",
      "/api/Alumnes/AutenticateUser",
      {
        PasswordHash: FICTIONAL_PASSWORD,
        Username: FICTIONAL_USERNAME,
        isTablet: "false",
      },
    ],
    [
      "POST",
      "/api/Alumnes/AutenticateUser",
      {
        PasswordHash: FICTIONAL_PASSWORD,
        Username: "unknown@example.test",
        isTablet: false,
      },
    ],
  ])(
    "rejects wrong method, path, casing, or kinds",
    async (method, path, body) => {
      const fixture = await startSyntheticUpstream();
      openFixtures.push(fixture);
      const response = await fetch(`${fixture.baseUrl}${path}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
        method,
      });
      expect(response.status).toBe(400);
      expect(fixture.ledger.at(-1)?.accepted).toBe(false);
    },
  );

  it("rejects wrong content types and authorization headers", async () => {
    const fixture = await startSyntheticUpstream();
    openFixtures.push(fixture);
    const exactBody = JSON.stringify({
      PasswordHash: FICTIONAL_PASSWORD,
      Username: FICTIONAL_USERNAME,
      isTablet: false,
    });
    for (const headers of [
      new Headers({
        Accept: "application/json",
        "Cache-Control": "no-store",
        "Content-Type": "text/plain",
      }),
      new Headers({
        Accept: "application/json",
        Authorization: "Basic fictional",
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      }),
    ]) {
      const response = await fetch(
        `${fixture.baseUrl}/api/Alumnes/AutenticateUser`,
        { body: exactBody, headers, method: "POST" },
      );
      expect(response.status).toBe(400);
    }
    expect(fixture.ledger).toHaveLength(2);
    expect(fixture.ledger.every(({ accepted }) => !accepted)).toBe(true);
  });
});
