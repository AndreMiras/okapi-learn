import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGamePackageClient,
  GamePackageError,
} from "@/lib/mylocker/game-client";
import {
  FICTIONAL_GAME_IDS,
  FICTIONAL_GAME_PACKAGE_BYTES,
  startSyntheticGameDelivery,
} from "@/tests/fixtures/upstream";

const apiOrigin = "https://api.kidsandus.es";
const packageOrigin = "https://packages.example";
const packageBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const openFixtures: Array<{ close: () => Promise<void> }> = [];

function client(overrides: Record<string, unknown> = {}) {
  return createGamePackageClient({
    allowedGameOrigins: [packageOrigin],
    apiBaseUrl: apiOrigin,
    maximumBytes: 16,
    production: true,
    timeoutMs: 100,
    ...overrides,
  });
}

function redirect(location = `${packageOrigin}/fictional.zip`, status = 302) {
  return new Response(null, { headers: { Location: location }, status });
}

function pkg(
  body: BodyInit | null = packageBytes,
  headers: Record<string, string> = {},
  status = 200,
) {
  return new Response(body, {
    headers: { "Content-Type": "application/zip", ...headers },
    status,
  });
}

function successfulFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce(redirect())
    .mockResolvedValueOnce(
      pkg(packageBytes, { "Content-Length": String(packageBytes.byteLength) }),
    );
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(openFixtures.splice(0).map(({ close }) => close()));
});

describe("createGamePackageClient", () => {
  it("performs exactly one anonymous redirect and bounded package request", async () => {
    const fixture = await startSyntheticGameDelivery();
    openFixtures.push(fixture);
    const bytes = await createGamePackageClient({
      allowedGameOrigins: [fixture.packageOrigin],
      apiBaseUrl: fixture.apiOrigin,
      maximumBytes: 16,
      production: false,
    }).fetchPackage(FICTIONAL_GAME_IDS[0]);

    expect(bytes).toEqual(FICTIONAL_GAME_PACKAGE_BYTES);
    expect(fixture.apiLedger).toHaveLength(1);
    expect(fixture.packageLedger).toHaveLength(1);
    expect(fixture.apiLedger[0]).toMatchObject({
      accepted: true,
      method: "GET",
      path: `/api/Alumnes/GetGame/${FICTIONAL_GAME_IDS[0]}`,
    });
    expect(fixture.packageLedger[0]).toMatchObject({
      accepted: true,
      method: "GET",
      path: "/objects/fictional-game.zip",
    });
    for (const entry of [fixture.apiLedger[0]!, fixture.packageLedger[0]!]) {
      expect(entry.headerNames).not.toContain("authorization");
      expect(entry.headerNames).not.toContain("cookie");
      expect(entry.headerNames).not.toContain("referer");
    }
  });

  it("encodes the selected game ID rather than treating it as a path", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    await client().fetchPackage("fictional/game id");
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      `${apiOrigin}/api/Alumnes/GetGame/fictional%2Fgame%20id`,
    );
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({
        cache: "no-store",
        credentials: "omit",
        method: "GET",
        redirect: "manual",
        referrerPolicy: "no-referrer",
      });
      const headers = new Headers(init.headers);
      expect([...headers.keys()].sort()).toEqual(["accept", "cache-control"]);
    }
  });

  it.each([".", ".."])(
    "rejects the URL dot-segment game ID %s",
    async (gameId) => {
      const fetchMock = successfulFetch();
      vi.stubGlobal("fetch", fetchMock);
      await expect(client().fetchPackage(gameId)).rejects.toMatchObject({
        category: "unsupported",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([301, 302, 303, 307, 308])(
    "accepts one approved %s redirect",
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(redirect(undefined, status))
        .mockResolvedValueOnce(pkg());
      vi.stubGlobal("fetch", fetchMock);
      await expect(client().fetchPackage("game-id")).resolves.toEqual(
        packageBytes,
      );
    },
  );

  it.each([
    [new Response(null, { status: 302 }), "unsupported"],
    [redirect(null as unknown as string), "unsupported"],
    [redirect("not a url"), "unsupported"],
    [redirect("https://["), "unsupported"],
    [redirect("/relative.zip"), "unsupported"],
    [redirect("https://other.example/file.zip"), "unsupported"],
    [redirect("https://user:pass@packages.example/file.zip"), "unsupported"],
    [redirect("https://packages.example/file.zip#part"), "unsupported"],
    [redirect("https://packages.example:444/file.zip"), "unsupported"],
    [redirect("http://packages.example/file.zip"), "unsupported"],
    [new Response(null, { status: 200 }), "service_unavailable"],
    [new Response(null, { status: 404 }), "not_found"],
    [new Response(null, { status: 429 }), "try_later"],
    [new Response(null, { status: 403 }), "not_available"],
  ])("rejects an unsafe initial response", async (response, category) => {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(client().fetchPackage("game-id")).rejects.toMatchObject({
      category,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    [redirect(`${packageOrigin}/again.zip`), "unsupported"],
    [pkg(null), "unsupported"],
    [pkg(packageBytes, { "Content-Type": "text/html" }), "unsupported"],
    [pkg(packageBytes, { "Content-Length": "words" }), "unsupported"],
    [pkg(packageBytes, { "Content-Length": "17" }), "unsupported"],
    [pkg(packageBytes, { "Content-Length": "5" }), "unsupported"],
    [pkg(packageBytes, {}, 404), "not_found"],
    [pkg(packageBytes, {}, 429), "try_later"],
    [pkg(packageBytes, {}, 500), "service_unavailable"],
  ])("rejects an unsafe final response", async (response, category) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect())
      .mockResolvedValueOnce(response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(client().fetchPackage("game-id")).rejects.toMatchObject({
      category,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts the bounded octet-stream content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(redirect())
        .mockResolvedValueOnce(
          pkg(packageBytes, { "Content-Type": "application/octet-stream" }),
        ),
    );
    await expect(client().fetchPackage("game-id")).resolves.toEqual(
      packageBytes,
    );
  });

  it("rejects streamed overflow and cancels the reader", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
      start(controller) {
        controller.enqueue(new Uint8Array(10));
        controller.enqueue(new Uint8Array(10));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(redirect())
        .mockResolvedValueOnce(pkg(body)),
    );
    await expect(client().fetchPackage("game-id")).rejects.toMatchObject({
      category: "unsupported",
    });
    expect(cancelled).toBe(true);
  });

  it("cancels rejected initial and final response bodies", async () => {
    let cancellations = 0;
    const rejectedBody = () =>
      new ReadableStream<Uint8Array>({
        cancel() {
          cancellations += 1;
        },
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(rejectedBody(), { status: 500 })),
    );
    await expect(client().fetchPackage("game-id")).rejects.toMatchObject({
      category: "service_unavailable",
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(redirect())
        .mockResolvedValueOnce(
          new Response(rejectedBody(), {
            headers: { "Content-Type": "text/html" },
          }),
        ),
    );
    await expect(client().fetchPackage("game-id")).rejects.toMatchObject({
      category: "unsupported",
    });
    expect(cancellations).toBe(2);
  });

  it("maps timeout, disconnect, and body failure without exposing details", async () => {
    const timeoutFetch = vi.fn(
      (_url: URL, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    vi.stubGlobal("fetch", timeoutFetch);
    const timeout = await client({ timeoutMs: 5 })
      .fetchPackage("private-game-id")
      .catch((error: unknown) => error);
    expect(timeout).toBeInstanceOf(GamePackageError);
    expect(timeout).toMatchObject({ category: "service_unavailable" });
    expect(
      JSON.stringify(timeout, Object.getOwnPropertyNames(timeout)),
    ).not.toContain("private-game-id");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("host"))),
    );
    await expect(client().fetchPackage("game-id")).rejects.toMatchObject({
      category: "service_unavailable",
    });

    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("body failed"));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(redirect())
        .mockResolvedValueOnce(pkg(broken)),
    );
    await expect(client().fetchPackage("game-id")).rejects.toMatchObject({
      category: "service_unavailable",
    });
  });

  it("allows an exact loopback HTTP target only outside production", async () => {
    const target = "http://127.0.0.1:4200/package.zip";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(redirect(target))
        .mockResolvedValueOnce(pkg()),
    );
    await expect(
      client({
        allowedGameOrigins: ["http://127.0.0.1:4200"],
        production: false,
      }).fetchPackage("game-id"),
    ).resolves.toEqual(packageBytes);
  });
});
