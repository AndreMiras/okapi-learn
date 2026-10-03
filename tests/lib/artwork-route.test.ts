import { beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  allowedAudioOrigins: [] as string[],
  allowedGameArtworkOrigins: ["https://images.example.test"],
  allowedGameOrigins: ["https://packages.example"],
  allowedVideoOrigins: [] as string[],
  apiBaseUrl: "https://api.kidsandus.es",
  audioPlaybackEnabled: false,
  gamePlaybackEnabled: true,
  production: true,
  publicAppOrigin: "http://localhost:3000",
  sessionSecret: "a-fictional-artwork-route-secret-long-enough",
  sessionTtlSeconds: 3_600,
  videoPlaybackEnabled: false,
}));

vi.mock("@/lib/config/server", () => ({ getServerConfig: () => config }));

import { GET } from "@/app/api/learn/[learnerAlias]/game-map/sections/[sectionAlias]/artwork/route";
import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import { GameRateLimiter } from "@/lib/security/game-rate-limit";
import { MemorySessionStore, SESSION_COOKIE_NAME } from "@/lib/session/store";
import { createPng } from "@/tests/fixtures/games";
import { syntheticAuthenticationResponse } from "@/tests/fixtures/upstream";

const png = createPng();

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
  return {
    issued,
    learner: session.learners[0]!,
    section: session.courses[0]!.gameMap!.sections[0]!,
    session,
    store,
  };
}

function issueCrossCourseSession() {
  const input: any = syntheticAuthenticationResponse();
  input.Courses.push({
    Audios: [],
    CourseId: "course-garden",
    GameMap: {
      ...structuredClone(input.Courses[0].GameMap),
      Id: "map-garden",
    },
    Name: "Garden English",
    Videos: [],
  });
  input.Students.push({
    CourseId: "course-garden",
    Name: "Milo",
    StudentId: "learner-milo",
  });
  let randomValue = 60;
  const store = new MemorySessionStore({
    now: () => 1_000,
    random: (size) => Buffer.alloc(size, ++randomValue),
    secret: config.sessionSecret,
    ttlSeconds: 60,
  });
  const issued = store.issue(normalizeAuthenticationResponse(input));
  const session = store.read(issued.cookieValue)!;
  return { issued, session, store };
}

function request(
  aliases: { learner: string; section: string },
  cookieValue?: string,
) {
  const headers = new Headers();
  if (cookieValue) {
    headers.set("Cookie", `${SESSION_COOKIE_NAME}=${cookieValue}`);
  }
  return new Request(
    `http://localhost:3000/api/learn/${aliases.learner}/game-map/sections/${aliases.section}/artwork`,
    { headers },
  );
}

function context(aliases: { learner: string; section: string }) {
  return {
    params: Promise.resolve({
      learnerAlias: aliases.learner,
      sectionAlias: aliases.section,
    }),
  } as RouteContext<"/api/learn/[learnerAlias]/game-map/sections/[sectionAlias]/artwork">;
}

function successfulFetch() {
  return vi.fn(async (url: URL, init: RequestInit) => {
    void url;
    void init;
    return new Response(png, {
      headers: {
        "Content-Length": String(png.byteLength),
        "Content-Type": "image/png",
      },
    });
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  config.gamePlaybackEnabled = true;
  globalThis.__okapiLearnArtworkLimiter = undefined;
  globalThis.__okapiLearnSessionStore = undefined;
});

describe("game artwork Route Handler", () => {
  it("returns one private PNG through the exact learner-section relationship", async () => {
    const fixture = issueSession();
    globalThis.__okapiLearnSessionStore = fixture.store;
    const aliases = {
      learner: fixture.learner.alias,
      section: fixture.section.alias,
    };
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      request(aliases, fixture.issued.cookieValue),
      context(aliases),
    );
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(String(png.byteLength));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      fixture.section.frontImageUrl,
    );
  });

  it("makes zero external requests for missing, disabled, raw, and stale aliases", async () => {
    const fixture = issueSession();
    const other = issueSession(30);
    globalThis.__okapiLearnSessionStore = fixture.store;
    const aliases = {
      learner: fixture.learner.alias,
      section: fixture.section.alias,
    };
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    const invalid = [
      [request(aliases), context(aliases)],
      [
        request(
          { ...aliases, section: "section-one" },
          fixture.issued.cookieValue,
        ),
        context({ ...aliases, section: "section-one" }),
      ],
      [
        request(
          { ...aliases, section: other.section.alias },
          fixture.issued.cookieValue,
        ),
        context({ ...aliases, section: other.section.alias }),
      ],
      [
        request(
          { ...aliases, learner: "learner-nova" },
          fixture.issued.cookieValue,
        ),
        context({ ...aliases, learner: "learner-nova" }),
      ],
    ] as const;
    for (const [incoming, routeContext] of invalid) {
      const response = await GET(incoming, routeContext);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }

    config.gamePlaybackEnabled = false;
    expect(
      (
        await GET(
          request(aliases, fixture.issued.cookieValue),
          context(aliases),
        )
      ).status,
    ).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a section alias from another learner course without fetching", async () => {
    const fixture = issueCrossCourseSession();
    globalThis.__okapiLearnSessionStore = fixture.store;
    const aliases = {
      learner: fixture.session.learners[1]!.alias,
      section: fixture.session.courses[0]!.gameMap!.sections[0]!.alias,
    };
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      request(aliases, fixture.issued.cookieValue),
      context(aliases),
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps session, artwork, and capacity failures to fixed private errors", async () => {
    const fixture = issueSession();
    const aliases = {
      learner: fixture.learner.alias,
      section: fixture.section.alias,
    };
    globalThis.__okapiLearnSessionStore = {
      delete: fixture.store.delete.bind(fixture.store),
      issue: fixture.store.issue.bind(fixture.store),
      read: async () => {
        throw new Error("redis detail");
      },
    };
    let response = await GET(
      request(aliases, fixture.issued.cookieValue),
      context(aliases),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not_available" });

    globalThis.__okapiLearnSessionStore = fixture.store;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    response = await GET(
      request(aliases, fixture.issued.cookieValue),
      context(aliases),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not_available" });
    expect(JSON.stringify(await response.headers)).not.toContain(
      "artwork.example",
    );

    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    globalThis.__okapiLearnArtworkLimiter = new GameRateLimiter({
      maximumConcurrent: 0,
      secret: config.sessionSecret,
    });
    response = await GET(
      request(aliases, fixture.issued.cookieValue),
      context(aliases),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "try_later" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
