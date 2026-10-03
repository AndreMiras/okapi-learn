import { describe, expect, it } from "vitest";

import { isUpstreamError, UpstreamError } from "@/lib/mylocker/errors";
import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import {
  normalizeServerHeldArtworkUrl,
  normalizeServerHeldMediaUrl,
} from "@/lib/mylocker/url-policy";
import {
  FICTIONAL_MAP_GAME_IDS,
  syntheticAuthenticationResponse,
  syntheticGameMap,
} from "@/tests/fixtures/upstream";

function response() {
  return structuredClone(syntheticAuthenticationResponse());
}

describe("normalizeAuthenticationResponse", () => {
  it("projects only the minimum observed graph and preserves Unicode", () => {
    const input = response();
    input.Students[0].Name = "Nóva 星";
    input.Courses[0].Name = "Òrbita";
    input.Courses[0].Videos[0].Title = "Lluna 🌙";
    const normalized = normalizeAuthenticationResponse(input);

    expect(normalized.learners[0]?.name).toBe("Nóva 星");
    expect(normalized.courses[0]?.name).toBe("Òrbita");
    expect(normalized.courses[0]?.videos[0]?.title).toBe("Lluna 🌙");
    expect(normalized.courses[0]?.videos[0]?.games).toEqual([
      { id: "game-starlight", slot: 1 },
      { id: "game-comet", slot: 2 },
      { id: "game-constellation", slot: 3 },
    ]);
    expect(normalized.courses[0]?.videos[0]?.viewedByLearnerIds).toEqual([
      "learner-nova",
    ]);
    expect(normalized.courses[0]?.gameMap).toEqual({
      color: "#24365f",
      id: "map-orbit",
      sections: [
        {
          frontImageUrl:
            "https://images.example.test/maps/section-one-front.png",
          height: 600,
          positions: [
            {
              finishedByLearnerIds: ["learner-nova"],
              gameId: FICTIONAL_MAP_GAME_IDS[0],
              order: 1,
              viewedByLearnerIds: ["learner-nova"],
              xEnd: 190,
              xStart: 110,
              yEnd: 190,
              yStart: 110,
            },
            {
              finishedByLearnerIds: [],
              gameId: FICTIONAL_MAP_GAME_IDS[1],
              order: 2,
              viewedByLearnerIds: [],
              xEnd: 430,
              xStart: 350,
              yEnd: 340,
              yStart: 260,
            },
          ],
          width: 800,
        },
        {
          frontImageUrl: "https://images.example.test/maps/empty-front.png",
          height: 500,
          positions: [],
          width: 800,
        },
        {
          frontImageUrl:
            "https://images.example.test/maps/section-three-front.png",
          height: 700,
          positions: [
            {
              finishedByLearnerIds: [],
              gameId: FICTIONAL_MAP_GAME_IDS[2],
              order: 3,
              viewedByLearnerIds: [],
              xEnd: 540,
              xStart: 440,
              yEnd: 560,
              yStart: 460,
            },
          ],
          width: 800,
        },
      ],
      title: "Orbit game map",
    });
    const retained = JSON.stringify(normalized);
    for (const excluded of [
      "Surname",
      "Fictional-Surname",
      "DateOfBirth",
      "UrlPhoto",
      "GameMap",
      "GameSections",
      "ignored-course-game",
      "ignored-section-game",
      "ignored-map",
      "orbit-back.png",
      "marker.png",
      "GameViewedBy",
      "game-progress-must-be-dropped",
      "ZipUrl",
      "nivellId",
      "unknownRoot",
    ]) {
      expect(retained).not.toContain(excluded);
    }
  });

  it("accepts absent, null, empty, and nullable-presentation maps", () => {
    const absent: any = response();
    delete absent.Courses[0].GameMap;
    expect(
      normalizeAuthenticationResponse(absent).courses[0]?.gameMap,
    ).toBeNull();

    const nullable: any = response();
    nullable.Courses[0].GameMap = null;
    expect(
      normalizeAuthenticationResponse(nullable).courses[0]?.gameMap,
    ).toBeNull();

    const empty: any = response();
    empty.Courses[0].GameMap = {
      ...syntheticGameMap(),
      Color: null,
      Sections: [],
      Title: null,
    };
    expect(normalizeAuthenticationResponse(empty).courses[0]?.gameMap).toEqual({
      color: null,
      id: "map-orbit",
      sections: [],
      title: null,
    });
  });

  it("filters map progress to learners in the same course", () => {
    const input: any = response();
    input.Students.push({
      CourseId: "course-orbit",
      Name: "Lyra",
      StudentId: "learner-lyra",
    });
    const positions = normalizeAuthenticationResponse(
      input,
    ).courses[0]!.gameMap!.sections.flatMap(({ positions }) => positions);
    expect(positions[0]).toMatchObject({
      finishedByLearnerIds: ["learner-nova"],
      viewedByLearnerIds: ["learner-nova", "learner-lyra"],
    });
    expect(positions[1]?.viewedByLearnerIds).toEqual(["learner-lyra"]);
    expect(positions[2]).toMatchObject({
      finishedByLearnerIds: ["learner-lyra"],
      viewedByLearnerIds: ["learner-lyra"],
    });
  });

  it.each([
    ["map object", (input: any) => (input.Courses[0].GameMap = [])],
    [
      "sections array",
      (input: any) => (input.Courses[0].GameMap.Sections = null),
    ],
    [
      "section object",
      (input: any) => (input.Courses[0].GameMap.Sections[0] = null),
    ],
    [
      "positions array",
      (input: any) => (input.Courses[0].GameMap.Sections[0].Positions = null),
    ],
    ["map ID", (input: any) => (input.Courses[0].GameMap.Id = "")],
    [
      "game ID",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].GameId = ""),
    ],
    [
      "duplicate game",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[2].Positions[0].GameId =
          FICTIONAL_MAP_GAME_IDS[0]),
    ],
    [
      "duplicate order",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[2].Positions[0].Orden = 1),
    ],
    [
      "negative order",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].Orden = -1),
    ],
    [
      "noninteger order",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].Orden = 1.5),
    ],
    [
      "zero width",
      (input: any) => (input.Courses[0].GameMap.Sections[0].Width = 0),
    ],
    [
      "excessive height",
      (input: any) => (input.Courses[0].GameMap.Sections[0].Height = 16_385),
    ],
    [
      "noninteger dimension",
      (input: any) => (input.Courses[0].GameMap.Sections[0].Width = 2.5),
    ],
    [
      "negative coordinate",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].XStart = -1),
    ],
    [
      "reversed coordinate",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].XEnd = 100),
    ],
    [
      "out-of-bounds coordinate",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].YEnd = 601),
    ],
    [
      "nonfinite coordinate",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].XStart =
          Number.POSITIVE_INFINITY),
    ],
    [
      "viewed list kind",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].ViewedBy =
          "learner-nova"),
    ],
    [
      "finished list kind",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].FinishedBy = null),
    ],
    [
      "duplicate learner reference",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].Positions[0].ViewedBy = [
          "learner-nova",
          "learner-nova",
        ]),
    ],
    [
      "invalid artwork URL",
      (input: any) =>
        (input.Courses[0].GameMap.Sections[0].FrontImage =
          "http://images.example.test/map.png"),
    ],
  ])(
    "rejects malformed %s without retaining a partial map",
    (_name, mutate) => {
      const input = response();
      mutate(input);
      expect(() => normalizeAuthenticationResponse(input)).toThrowError(
        expect.objectContaining({ category: "invalid_response" }),
      );
    },
  );

  it("enforces map section, per-section position, total position, and learner-reference limits", () => {
    const tooManySections: any = response();
    tooManySections.Courses[0].GameMap.Sections = Array.from(
      { length: 65 },
      (_, index) => ({
        ...syntheticGameMap().Sections[1],
        FrontImage: `https://images.example.test/maps/empty-${index}.png`,
      }),
    );
    expect(() => normalizeAuthenticationResponse(tooManySections)).toThrow();

    const makePosition = (index: number) => ({
      FinishedBy: [],
      GameId: `bounded-game-${index}`,
      Orden: index,
      ViewedBy: [],
      XEnd: 2,
      XStart: 1,
      YEnd: 2,
      YStart: 1,
    });
    const tooManyInSection: any = response();
    tooManyInSection.Courses[0].GameMap.Sections[0].Positions = Array.from(
      { length: 17 },
      (_, index) => makePosition(index),
    );
    expect(() => normalizeAuthenticationResponse(tooManyInSection)).toThrow();

    const maximum: any = response();
    maximum.Courses[0].GameMap.Sections = Array.from(
      { length: 32 },
      (_, sectionIndex) => ({
        FrontImage: `https://images.example.test/maps/max-${sectionIndex}.png`,
        Height: 2,
        Positions: Array.from({ length: 16 }, (_, positionIndex) =>
          makePosition(sectionIndex * 16 + positionIndex),
        ),
        Width: 2,
      }),
    );
    expect(
      normalizeAuthenticationResponse(maximum).courses[0]?.gameMap?.sections,
    ).toHaveLength(32);

    const tooManyTotal = structuredClone(maximum);
    tooManyTotal.Courses[0].GameMap.Sections.push({
      FrontImage: "https://images.example.test/maps/overflow.png",
      Height: 2,
      Positions: [makePosition(512)],
      Width: 2,
    });
    expect(() => normalizeAuthenticationResponse(tooManyTotal)).toThrow();

    const tooManyReferences: any = response();
    tooManyReferences.Courses[0].GameMap.Sections[0].Positions[0].ViewedBy =
      Array.from({ length: 17 }, (_, index) => `learner-${index}`);
    expect(() => normalizeAuthenticationResponse(tooManyReferences)).toThrow();
  });

  it("retains bounded video relationships while audio relationships stay empty", () => {
    const input: any = response();
    input.Courses[0].Audios = [
      {
        AudioId: "audio-safe",
        Description: null,
        Duration: null,
        GameId: "ignored-audio-game",
        Orden: 1,
        Title: "Safe audio",
        UrlAudio: null,
        ViewedBy: "ignored-audio-view-state",
      },
    ];
    const course = normalizeAuthenticationResponse(input).courses[0]!;
    expect(course.audios[0]).toMatchObject({
      games: [],
      viewedByLearnerIds: [],
    });
    expect(JSON.stringify(course)).not.toContain("ignored-audio");
  });

  it("accepts absent game slots and drops viewed references outside the course", () => {
    const input: any = response();
    input.Courses[0].Videos[0].GameId = "";
    input.Courses[0].Videos[0].GameId2 = null;
    delete input.Courses[0].Videos[0].GameId3;
    input.Courses[0].Videos[0].ViewedBy = ["unknown-learner"];
    expect(
      normalizeAuthenticationResponse(input).courses[0]?.videos[0],
    ).toMatchObject({ games: [], viewedByLearnerIds: [] });
  });

  it.each([
    (input: any) => (input.Courses[0].Videos[0].GameId2 = "game-starlight"),
    (input: any) => (input.Courses[0].Videos[0].GameId = 42),
    (input: any) =>
      (input.Courses[0].Videos[0].ViewedBy = ["learner-nova", "learner-nova"]),
    (input: any) => (input.Courses[0].Videos[0].ViewedBy = "learner-nova"),
    (input: any) =>
      (input.Courses[0].Videos[0].ViewedBy = Array.from(
        { length: 17 },
        (_, index) => `learner-${index}`,
      )),
  ])("rejects malformed video game or viewed relationships", (mutate) => {
    const input = response();
    mutate(input);
    expect(() => normalizeAuthenticationResponse(input)).toThrow(UpstreamError);
  });

  it("accepts omitted Games, nullable unknown fields, and missing media collections", () => {
    const input = response() as Record<string, any>;
    delete input.Courses[0].Audios;
    input.Courses[0].Videos[0].Description = null;
    input.Courses[0].Videos[0].Duration = undefined;
    expect(normalizeAuthenticationResponse(input).courses[0]).toMatchObject({
      audios: [],
    });
  });

  it("accepts empty learner, course, and media collections", () => {
    const input = response();
    input.Students = [];
    input.Courses = [];
    expect(normalizeAuthenticationResponse(input)).toMatchObject({
      learners: [],
      courses: [],
    });
  });

  it.each([
    (input: any) => input.Students.push({ ...input.Students[0] }),
    (input: any) => input.Courses.push({ ...input.Courses[0] }),
    (input: any) =>
      input.Courses.push({ ...input.Courses[0], CourseId: "another-course" }),
    (input: any) => (input.Students[0].CourseId = "missing-course"),
  ])("rejects duplicate or mismatched relationships", (mutate) => {
    const input = response();
    mutate(input);
    expect(() => normalizeAuthenticationResponse(input)).toThrow(UpstreamError);
  });

  it("rejects duplicate media IDs across courses", () => {
    const input = response();
    input.Courses.push({
      ...structuredClone(input.Courses[0]),
      CourseId: "course-two",
    });
    expect(() => normalizeAuthenticationResponse(input)).toThrow(UpstreamError);
  });

  it.each([
    (input: any) => (input.authToken = ""),
    (input: any) => (input.TermsPending = "false"),
    (input: any) => (input.Students = null),
    (input: any) => (input.Courses[0].Videos[0].Orden = -1),
    (input: any) => (input.Courses[0].Videos[0].Title = "bad\u0000title"),
    (input: any) =>
      (input.Courses[0].Videos[0].UrlVideo = "http://media.example.test/x"),
  ])("rejects malformed required data", (mutate) => {
    const input = response();
    mutate(input);
    expect(() => normalizeAuthenticationResponse(input)).toThrowError(
      expect.objectContaining({ category: "invalid_response" }),
    );
  });

  it("rejects excessive arrays and nesting", () => {
    const tooManyLearners = response();
    tooManyLearners.Students = Array.from({ length: 17 }, (_, index) => ({
      ...tooManyLearners.Students[0],
      StudentId: `learner-${index}`,
    }));
    expect(() => normalizeAuthenticationResponse(tooManyLearners)).toThrow();

    const tooDeep: any = response();
    let cursor: any = (tooDeep.unknown = {});
    for (let index = 0; index < 14; index += 1) cursor = cursor.next = {};
    expect(() => normalizeAuthenticationResponse(tooDeep)).toThrow();
  });

  it("rejects excessive object keys and media collections", () => {
    const tooManyKeys: any = response();
    tooManyKeys.unknown = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [`key-${index}`, index]),
    );
    expect(() => normalizeAuthenticationResponse(tooManyKeys)).toThrow();

    const tooMuchMedia = response();
    tooMuchMedia.Courses[0].Videos = Array.from(
      { length: 257 },
      (_, index) => ({
        ...tooMuchMedia.Courses[0].Videos[0],
        VideoId: `video-${index}`,
      }),
    );
    expect(() => normalizeAuthenticationResponse(tooMuchMedia)).toThrow();
  });

  it.each([
    null,
    "response",
    { ...response(), GameTester: null },
    { ...response(), GameMapTester: null },
  ])("rejects malformed roots and tester gates", (input) => {
    expect(() => normalizeAuthenticationResponse(input)).toThrow();
  });
});

describe("normalizeServerHeldMediaUrl", () => {
  it("retains an HTTPS URL with a query only on the server model", () => {
    expect(
      normalizeServerHeldMediaUrl(
        "https://media.example.test/file.mp4?grant=fake",
      ),
    ).toBe("https://media.example.test/file.mp4?grant=fake");
    expect(normalizeServerHeldMediaUrl(null)).toBeNull();
    expect(normalizeServerHeldMediaUrl(undefined)).toBeNull();
    expect(normalizeServerHeldMediaUrl("")).toBeNull();
  });

  it.each([
    "http://media.example.test/file.mp4",
    "https://user:pass@media.example.test/file.mp4",
    "https://media.example.test:8443/file.mp4",
    "https://media.example.test/file.mp4#fragment",
    "not-a-url",
    42,
    "x".repeat(2_049),
  ])("rejects unsupported URL %s", (url) => {
    expect(() => normalizeServerHeldMediaUrl(url)).toThrow(UpstreamError);
  });
});

describe("normalizeServerHeldArtworkUrl", () => {
  it("requires a syntactically safe server-held artwork URL", () => {
    expect(
      normalizeServerHeldArtworkUrl(
        "https://images.example.test/map.png?grant=fake",
      ),
    ).toBe("https://images.example.test/map.png?grant=fake");
    expect(() => normalizeServerHeldArtworkUrl(null)).toThrow(UpstreamError);
    expect(() =>
      normalizeServerHeldArtworkUrl("https://user@images.example.test/map.png"),
    ).toThrow(UpstreamError);
  });
});

describe("isUpstreamError", () => {
  it("recognizes only the safe upstream error type", () => {
    expect(isUpstreamError(new UpstreamError("unavailable"))).toBe(true);
    expect(isUpstreamError(new Error("unavailable"))).toBe(false);
  });
});
