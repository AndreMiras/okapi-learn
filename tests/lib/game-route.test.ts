import { beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  allowedAudioOrigins: [] as string[],
  allowedGameOrigins: ["https://packages.example"],
  allowedVideoOrigins: [] as string[],
  apiBaseUrl: "https://api.kidsandus.es",
  audioPlaybackEnabled: false,
  gamePlaybackEnabled: true,
  publicAppOrigin: "http://localhost:3000",
  sessionSecret: "a-fictional-game-route-secret-long-enough",
  sessionTtlSeconds: 3_600,
  videoPlaybackEnabled: false,
}));

vi.mock("@/lib/config/server", () => ({ getServerConfig: () => config }));

import { POST } from "@/app/api/learn/[learnerAlias]/media/[mediaAlias]/games/[gameAlias]/package/route";
import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import { GameRateLimiter } from "@/lib/security/game-rate-limit";
import { MemorySessionStore, SESSION_COOKIE_NAME } from "@/lib/session/store";
import { syntheticAuthenticationResponse } from "@/tests/fixtures/upstream";

const packageBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function issueSession(seed = 0) {
  let randomValue = seed;
  const store = new MemorySessionStore({
    now: () => 1_000,
    random: (size) => Buffer.alloc(size, ++randomValue),
    secret: config.sessionSecret,
    ttlSeconds: 60,
  });
  const issued = store.issue(
    normalizeAuthenticationResponse(syntheticAuthenticationResponse()),
  );
  const session = store.read(issued.cookieValue)!;
  const learner = session.learners[0]!;
  const video = session.courses[0]!.videos[0]!;
  const game = video.games[0]!;
  return { game, issued, learner, session, store, video };
}

function request(
  aliases: { game: string; learner: string; media: string },
  cookieValue?: string,
  options: { body?: BodyInit; origin?: string } = {},
) {
  const url = `http://localhost:3000/api/learn/${aliases.learner}/media/${aliases.media}/games/${aliases.game}/package`;
  const headers = new Headers({
    Host: "localhost:3000",
    Origin: options.origin ?? "http://localhost:3000",
  });
  if (cookieValue) {
    headers.set("Cookie", `${SESSION_COOKIE_NAME}=${cookieValue}`);
  }
  return new Request(url, {
    body: options.body,
    duplex: "half",
    headers,
    method: "POST",
  } as RequestInit);
}

function context(aliases: { game: string; learner: string; media: string }) {
  return {
    params: Promise.resolve({
      gameAlias: aliases.game,
      learnerAlias: aliases.learner,
      mediaAlias: aliases.media,
    }),
  } as RouteContext<"/api/learn/[learnerAlias]/media/[mediaAlias]/games/[gameAlias]/package">;
}

function successfulFetch() {
  return vi.fn(async (url: URL | string) => {
    if (String(url).startsWith("https://api.kidsandus.es/")) {
      return new Response(null, {
        headers: { Location: "https://packages.example/game.zip" },
        status: 302,
      });
    }
    return new Response(packageBytes, {
      headers: {
        "Content-Length": String(packageBytes.byteLength),
        "Content-Type": "application/zip",
      },
    });
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  config.gamePlaybackEnabled = true;
  globalThis.__okapiLearnGameLimiter = undefined;
  globalThis.__okapiLearnSessionStore = undefined;
});

describe("game package Route Handler", () => {
  it("returns a private bounded package for one exact owned alias graph", async () => {
    const fixture = issueSession();
    globalThis.__okapiLearnSessionStore = fixture.store;
    const aliases = {
      game: fixture.game.alias,
      learner: fixture.learner.alias,
      media: fixture.video.alias,
    };
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request(aliases, fixture.issued.cookieValue, {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        }),
      }),
      context(aliases),
    );
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(packageBytes);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("makes zero upstream calls for every local rejection", async () => {
    const fixture = issueSession();
    globalThis.__okapiLearnSessionStore = fixture.store;
    const aliases = {
      game: fixture.game.alias,
      learner: fixture.learner.alias,
      media: fixture.video.alias,
    };
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    const invalidCases = [
      [
        request(aliases, fixture.issued.cookieValue, {
          origin: "https://evil.example",
        }),
        context(aliases),
      ],
      [request(aliases), context(aliases)],
      [
        request(aliases, fixture.issued.cookieValue, { body: "x" }),
        context(aliases),
      ],
      [
        request(
          { ...aliases, game: fixture.game.id },
          fixture.issued.cookieValue,
        ),
        context({ ...aliases, game: fixture.game.id }),
      ],
      [
        request({ ...aliases, game: "missing" }, fixture.issued.cookieValue),
        context({ ...aliases, game: "missing" }),
      ],
    ] as const;
    for (const [incoming, routeContext] of invalidCases) {
      const response = await POST(incoming, routeContext);
      expect(response.ok).toBe(false);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("pragma")).toBe("no-cache");
    }

    config.gamePlaybackEnabled = false;
    expect(
      (
        await POST(
          request(aliases, fixture.issued.cookieValue),
          context(aliases),
        )
      ).status,
    ).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects stale and cross-session aliases without upstream detail", async () => {
    const first = issueSession();
    const second = issueSession(20);
    globalThis.__okapiLearnSessionStore = first.store;
    vi.stubGlobal("fetch", successfulFetch());
    const aliases = {
      game: second.game.alias,
      learner: first.learner.alias,
      media: first.video.alias,
    };
    const response = await POST(
      request(aliases, first.issued.cookieValue),
      context(aliases),
    );
    expect(response.status).toBe(404);
    const visible = await response.text();
    expect(visible).toContain("not_found");
    expect(visible).not.toContain(second.game.id);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("limits a session to six starts per minute", async () => {
    const fixture = issueSession();
    globalThis.__okapiLearnSessionStore = fixture.store;
    const aliases = {
      game: fixture.game.alias,
      learner: fixture.learner.alias,
      media: fixture.video.alias,
    };
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    for (let index = 0; index < 6; index += 1) {
      expect(
        (
          await POST(
            request(aliases, fixture.issued.cookieValue),
            context(aliases),
          )
        ).status,
      ).toBe(200);
    }
    const limited = await POST(
      request(aliases, fixture.issued.cookieValue),
      context(aliases),
    );
    expect(limited.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it("bounds process concurrency and releases slots idempotently", () => {
    const limiter = new GameRateLimiter({
      maximumConcurrent: 2,
      secret: config.sessionSecret,
    });
    const first = limiter.acquire("cookie-one")!;
    const second = limiter.acquire("cookie-two")!;
    expect(limiter.acquire("cookie-three")).toBeNull();
    first();
    first();
    expect(limiter.acquire("cookie-three")).toBeTypeOf("function");
    second();
  });

  it("bounds limiter keys and resets independent session windows", () => {
    let now = 0;
    const limiter = new GameRateLimiter({
      maximumKeys: 2,
      maximumStarts: 2,
      now: () => now,
      secret: config.sessionSecret,
      windowMs: 10,
    });
    limiter.acquire("cookie-one")!();
    limiter.acquire("cookie-one")!();
    expect(limiter.acquire("cookie-one")).toBeNull();
    limiter.acquire("cookie-two")!();
    expect(limiter.acquire("cookie-three")).toBeNull();

    now = 11;
    const afterReset = limiter.acquire("cookie-three");
    expect(afterReset).toBeTypeOf("function");
    afterReset?.();
  });

  it("maps upstream failures to fixed private errors", async () => {
    const fixture = issueSession();
    globalThis.__okapiLearnSessionStore = fixture.store;
    const aliases = {
      game: fixture.game.alias,
      learner: fixture.learner.alias,
      media: fixture.video.alias,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const response = await POST(
      request(aliases, fixture.issued.cookieValue),
      context(aliases),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "service_unavailable" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
