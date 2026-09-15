import { describe, expect, it } from "vitest";

import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import {
  isVideoViewedByLearner,
  selectLearner,
  selectMedia,
  selectVideoGame,
} from "@/lib/session/selectors";
import { MemorySessionStore } from "@/lib/session/store";
import { syntheticAuthenticationResponse } from "@/tests/fixtures/upstream";

function createSession(seed = 0) {
  let randomValue = seed;
  const store = new MemorySessionStore({
    now: () => 1_000,
    random: (size) => Buffer.alloc(size, ++randomValue),
    secret: "a-secret-long-enough-for-selector-tests",
    ttlSeconds: 60,
  });
  const input = syntheticAuthenticationResponse();
  input.Courses[0]!.Videos.push(
    {
      ...input.Courses[0]!.Videos[0]!,
      Orden: 1,
      GameId: "game-first-video",
      GameId2: null,
      GameId3: null,
      Title: "First by order",
      VideoId: "video-first",
      ViewedBy: [],
    } as any,
    {
      ...input.Courses[0]!.Videos[0]!,
      Orden: 2,
      GameId: "game-second-video",
      GameId2: null,
      GameId3: null,
      Title: "Second stable item",
      VideoId: "video-second",
      ViewedBy: [],
    } as any,
  );
  const issued = store.issue(normalizeAuthenticationResponse(input));
  return store.read(issued.cookieValue)!;
}

describe("session selectors", () => {
  it("selects only current aliases and preserves stable order", () => {
    const session = createSession();
    const learner = session.learners[0]!;
    const selected = selectLearner(session, learner.alias);
    expect(selected?.course.videos.map(({ title }) => title)).toEqual([
      "First by order",
      "Moonlight Story",
      "Second stable item",
    ]);
    const media = selected!.course.videos[0]!;
    expect(selectMedia(session, learner.alias, media.alias)?.media.title).toBe(
      "First by order",
    );
  });

  it("selects a game only through the exact learner-video relationship", () => {
    const session = createSession();
    const learner = session.learners[0]!;
    const videos = session.courses[0]!.videos;
    const first = videos[0]!;
    const moonlight = videos[1]!;
    const game = moonlight.games[0]!;

    expect(
      selectVideoGame(session, learner.alias, moonlight.alias, game.alias)
        ?.game,
    ).toEqual(game);
    expect(
      selectVideoGame(session, learner.alias, first.alias, game.alias),
    ).toBeNull();
    expect(
      selectVideoGame(session, learner.alias, moonlight.alias, game.id),
    ).toBeNull();
    expect(
      selectVideoGame(session, learner.alias, moonlight.alias, "missing"),
    ).toBeNull();
    const otherSession = createSession(20);
    expect(
      selectVideoGame(
        session,
        learner.alias,
        moonlight.alias,
        otherSession.courses[0]!.videos[1]!.games[0]!.alias,
      ),
    ).toBeNull();

    const duplicateGame = { ...game, alias: "duplicate-game-alias" };
    const malformed = {
      ...session,
      courses: [
        {
          ...session.courses[0]!,
          videos: [
            first,
            { ...moonlight, games: [duplicateGame, duplicateGame] },
            videos[2]!,
          ],
        },
      ],
    };
    expect(
      selectVideoGame(
        malformed,
        learner.alias,
        moonlight.alias,
        duplicateGame.alias,
      ),
    ).toBeNull();
  });

  it("computes learner-specific video reveal without exposing the viewed list", () => {
    const session = createSession();
    const learner = session.learners[0]!;
    const [unviewed, viewed] = session.courses[0]!.videos;
    expect(isVideoViewedByLearner(learner, unviewed!)).toBe(false);
    expect(isVideoViewedByLearner(learner, viewed!)).toBe(true);
  });

  it.each(["learner-nova", "missing", "", "../course-orbit"])(
    "rejects raw, arbitrary, or missing learner alias %s",
    (alias) => expect(selectLearner(createSession(), alias)).toBeNull(),
  );

  it("rejects stale media aliases and aliases from another session", () => {
    const first = createSession();
    const second = createSession(20);
    expect(
      selectMedia(
        first,
        first.learners[0]!.alias,
        second.courses[0]!.videos[0]!.alias,
      ),
    ).toBeNull();
    expect(
      selectMedia(first, first.learners[0]!.alias, "video-moonlight"),
    ).toBeNull();
  });

  it("fails closed for a malformed learner-course relationship", () => {
    const session = createSession();
    const malformed = { ...session, courses: [] };
    expect(selectLearner(malformed, session.learners[0]!.alias)).toBeNull();
  });
});
