import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGameArtworkClient,
  GameArtworkError,
} from "@/lib/mylocker/artwork-client";
import { createPng } from "@/tests/fixtures/games";

const artworkOrigin = "https://artwork.example";
const png = createPng();

function client(overrides: Record<string, unknown> = {}) {
  return createGameArtworkClient({
    allowedOrigins: [artworkOrigin],
    maximumBytes: 1_024,
    production: true,
    timeoutMs: 100,
    ...overrides,
  });
}

function artwork(
  body: BodyInit | null = png,
  headers: Record<string, string> = {},
  status = 200,
) {
  return new Response(body, {
    headers: { "Content-Type": "image/png", ...headers },
    status,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("createGameArtworkClient", () => {
  it("fetches one exact-origin PNG anonymously without redirects or caching", async () => {
    const fetchMock = vi.fn(async (url: URL, init: RequestInit) => {
      void url;
      void init;
      return artwork(png, { "Content-Length": String(png.byteLength) });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      client().fetchArtwork(`${artworkOrigin}/section.png?grant=fake`),
    ).resolves.toEqual(png);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${artworkOrigin}/section.png?grant=fake`);
    expect(init).toMatchObject({
      cache: "no-store",
      credentials: "omit",
      method: "GET",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    expect([...new Headers(init.headers).keys()].sort()).toEqual([
      "accept",
      "cache-control",
    ]);
  });

  it.each([
    "not-a-url",
    "http://artwork.example/section.png",
    "https://other.example/section.png",
    "https://user:pass@artwork.example/section.png",
    "https://artwork.example:444/section.png",
    "https://artwork.example/section.png#fragment",
    `https://artwork.example/${"x".repeat(2_100)}`,
  ])("rejects unsafe artwork URL %s before fetching", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(client().fetchArtwork(url)).rejects.toBeInstanceOf(
      GameArtworkError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("permits an exact loopback HTTP origin only outside production", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => artwork()),
    );
    await expect(
      client({
        allowedOrigins: ["http://127.0.0.1:4400"],
        production: false,
      }).fetchArtwork("http://127.0.0.1:4400/section.png"),
    ).resolves.toEqual(png);
  });

  it.each([
    artwork(null),
    artwork(png, {}, 302),
    artwork(png, {}, 404),
    artwork(png, { "Content-Type": "text/html" }),
    artwork(png, { "Content-Length": "words" }),
    artwork(png, { "Content-Length": "1025" }),
    artwork(png, { "Content-Length": String(png.byteLength + 1) }),
    artwork(new Uint8Array([1, 2, 3, 4])),
  ])("rejects an invalid artwork response", async (response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    await expect(
      client().fetchArtwork(`${artworkOrigin}/section.png`),
    ).rejects.toBeInstanceOf(GameArtworkError);
  });

  it("accepts the bounded octet-stream fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        artwork(png, { "Content-Type": "application/octet-stream" }),
      ),
    );
    await expect(
      client().fetchArtwork(`${artworkOrigin}/section.png`),
    ).resolves.toEqual(png);
  });

  it("rejects streamed overflow and cancels the body", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
      start(controller) {
        controller.enqueue(png);
        controller.enqueue(png);
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => artwork(body)),
    );
    await expect(
      client({ maximumBytes: png.byteLength }).fetchArtwork(
        `${artworkOrigin}/section.png`,
      ),
    ).rejects.toBeInstanceOf(GameArtworkError);
    expect(cancelled).toBe(true);
  });

  it("maps timeout, disconnect, and body failures without exposing the URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason),
            );
          }),
      ),
    );
    const timeout = await client({ timeoutMs: 5 })
      .fetchArtwork(`${artworkOrigin}/private-section.png`)
      .catch((error: unknown) => error);
    expect(timeout).toBeInstanceOf(GameArtworkError);
    expect(
      JSON.stringify(timeout, Object.getOwnPropertyNames(timeout)),
    ).not.toContain("private-section");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError())),
    );
    await expect(
      client().fetchArtwork(`${artworkOrigin}/section.png`),
    ).rejects.toBeInstanceOf(GameArtworkError);

    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("broken"));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => artwork(broken)),
    );
    await expect(
      client().fetchArtwork(`${artworkOrigin}/section.png`),
    ).rejects.toBeInstanceOf(GameArtworkError);
  });
});
