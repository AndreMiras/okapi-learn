import { describe, expect, it } from "vitest";

import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import {
  isVideoViewedByLearner,
  projectGameMapForLearner,
  selectGameMap,
  selectLearner,
  selectMapSection,
  selectMedia,
  selectStandaloneGame,
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
  input.Students.push({
    CourseId: "course-orbit",
    DateOfBirth: "2018-02-02",
    Name: "Lyra",
    nivellId: null,
    StudentId: "learner-lyra",
    Surname: "Fictional-Surname",
    UrlPhoto: "https://images.example.test/private-lyra.jpg",
  });
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

  it("selects the exact learner map, section, and standalone game relationships", () => {
    const session = createSession();
    const learner = session.learners[0]!;
    const map = session.courses[0]!.gameMap!;
    const section = map.sections[0]!;
    const dualLinkedGame = section.positions[0]!.game;
    const mapOnlyGame = section.positions[1]!.game;
    const videoOnlyGame = session.courses[0]!.videos.flatMap(
      ({ games }) => games,
    ).find(({ id }) => id === "game-comet")!;

    expect(selectGameMap(session, learner.alias)?.gameMap).toBe(map);
    expect(
      selectMapSection(session, learner.alias, section.alias)?.section,
    ).toBe(section);
    expect(
      selectStandaloneGame(session, learner.alias, dualLinkedGame.alias)?.game,
    ).toBe(dualLinkedGame);
    expect(
      selectStandaloneGame(session, learner.alias, mapOnlyGame.alias)?.game,
    ).toBe(mapOnlyGame);
    expect(
      selectStandaloneGame(session, learner.alias, videoOnlyGame.alias),
    ).toBeNull();
    expect(
      selectVideoGame(
        session,
        learner.alias,
        session.courses[0]!.videos[0]!.alias,
        mapOnlyGame.alias,
      ),
    ).toBeNull();
    expect(dualLinkedGame.alias).toBe(
      session.courses[0]!.videos.flatMap(({ games }) => games).find(
        ({ id }) => id === dualLinkedGame.id,
      )!.alias,
    );
  });

  it("projects learner-specific safe map data without server-held values", () => {
    const session = createSession();
    const nova = session.learners[0]!;
    const lyra = session.learners[1]!;
    const novaMap = projectGameMapForLearner(session, nova.alias)!;
    const lyraMap = projectGameMapForLearner(session, lyra.alias)!;
    expect(novaMap.sections[0]!.positions[0]).toMatchObject({
      initiallyFinished: true,
      initiallyViewed: true,
    });
    expect(lyraMap.sections[0]!.positions[0]).toMatchObject({
      initiallyFinished: false,
      initiallyViewed: true,
    });
    expect(lyraMap.sections[2]!.positions[0]).toMatchObject({
      initiallyFinished: true,
      initiallyViewed: true,
    });

    const serialized = JSON.stringify(novaMap);
    expect(serialized).toContain("gameAlias");
    expect(serialized).toContain("initiallyFinished");
    for (const excluded of [
      "learner-nova",
      "learner-lyra",
      "course-orbit",
      "map-orbit",
      "game-starlight",
      "ViewedBy",
      "viewedByLearnerIds",
      "finishedByLearnerIds",
      "images.example.test",
      "ZipUrl",
    ]) {
      expect(serialized).not.toContain(excluded);
    }
  });

  it("rejects stale map aliases and malformed duplicate aliases", () => {
    const session = createSession();
    const other = createSession(30);
    const learner = session.learners[0]!;
    const map = session.courses[0]!.gameMap!;
    expect(
      selectMapSection(
        session,
        learner.alias,
        other.courses[0]!.gameMap!.sections[0]!.alias,
      ),
    ).toBeNull();
    expect(
      selectStandaloneGame(
        session,
        learner.alias,
        other.courses[0]!.gameMap!.sections[0]!.positions[0]!.game.alias,
      ),
    ).toBeNull();

    const duplicateSection = {
      ...map.sections[1]!,
      alias: map.sections[0]!.alias,
    };
    const malformedSections = {
      ...session,
      courses: [
        {
          ...session.courses[0]!,
          gameMap: {
            ...map,
            sections: [map.sections[0]!, duplicateSection, map.sections[2]!],
          },
        },
      ],
    };
    expect(selectGameMap(malformedSections, learner.alias)).toBeNull();

    const duplicateGame = {
      ...map.sections[0]!.positions[1]!,
      game: {
        ...map.sections[0]!.positions[1]!.game,
        alias: map.sections[0]!.positions[0]!.game.alias,
      },
    };
    const malformedGames = {
      ...session,
      courses: [
        {
          ...session.courses[0]!,
          gameMap: {
            ...map,
            sections: [
              {
                ...map.sections[0]!,
                positions: [map.sections[0]!.positions[0]!, duplicateGame],
              },
              ...map.sections.slice(1),
            ],
          },
        },
      ],
    };
    expect(selectGameMap(malformedGames, learner.alias)).toBeNull();

    const duplicateLearner = {
      ...session,
      learners: [session.learners[0]!, session.learners[0]!],
    };
    expect(selectLearner(duplicateLearner, learner.alias)).toBeNull();
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
