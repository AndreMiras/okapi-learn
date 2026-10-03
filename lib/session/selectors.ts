import "server-only";

import type {
  SessionGameMap,
  SessionLearner,
  SessionMedia,
  SessionRecord,
} from "./types";

export type LearnerGameMap = Readonly<{
  color: string | null;
  sections: readonly Readonly<{
    alias: string;
    height: number;
    positions: readonly Readonly<{
      gameAlias: string;
      initiallyFinished: boolean;
      initiallyViewed: boolean;
      order: number;
      xEnd: number;
      xStart: number;
      yEnd: number;
      yStart: number;
    }>[];
    width: number;
  }>[];
  title: string | null;
}>;

function hasValidMapAliases(gameMap: SessionGameMap): boolean {
  if (
    typeof gameMap.id !== "string" ||
    !gameMap.id ||
    !Array.isArray(gameMap.sections)
  ) {
    return false;
  }
  const sectionAliases = new Set<string>();
  const gameAliases = new Set<string>();
  const gameIds = new Set<string>();
  const orders = new Set<number>();
  for (const section of gameMap.sections) {
    if (
      !section ||
      typeof section.alias !== "string" ||
      !section.alias ||
      sectionAliases.has(section.alias) ||
      typeof section.frontImageUrl !== "string" ||
      !Number.isSafeInteger(section.width) ||
      section.width < 1 ||
      !Number.isSafeInteger(section.height) ||
      section.height < 1 ||
      !Array.isArray(section.positions)
    ) {
      return false;
    }
    sectionAliases.add(section.alias);
    for (const position of section.positions) {
      if (
        !position?.game ||
        typeof position.game.alias !== "string" ||
        !position.game.alias ||
        typeof position.game.id !== "string" ||
        !position.game.id ||
        gameAliases.has(position.game.alias) ||
        gameIds.has(position.game.id) ||
        !Number.isSafeInteger(position.order) ||
        orders.has(position.order) ||
        ![position.xStart, position.xEnd, position.yStart, position.yEnd].every(
          (coordinate) =>
            typeof coordinate === "number" && Number.isFinite(coordinate),
        ) ||
        position.xStart < 0 ||
        position.xStart >= position.xEnd ||
        position.xEnd > section.width ||
        position.yStart < 0 ||
        position.yStart >= position.yEnd ||
        position.yEnd > section.height ||
        !Array.isArray(position.viewedByLearnerIds) ||
        !position.viewedByLearnerIds.every(
          (id: unknown) => typeof id === "string",
        ) ||
        !Array.isArray(position.finishedByLearnerIds) ||
        !position.finishedByLearnerIds.every(
          (id: unknown) => typeof id === "string",
        )
      ) {
        return false;
      }
      gameAliases.add(position.game.alias);
      gameIds.add(position.game.id);
      orders.add(position.order);
    }
  }
  return true;
}

export function selectLearner(record: SessionRecord, learnerAlias: string) {
  const learners = record.learners.filter(
    ({ alias }) => alias === learnerAlias,
  );
  if (learners.length !== 1) return null;
  const learner = learners[0]!;
  const matchingCourses = record.courses.filter(
    ({ id }) => id === learner.courseId,
  );
  if (matchingCourses.length !== 1) return null;
  return Object.freeze({ course: matchingCourses[0]!, learner });
}

export function selectGameMap(record: SessionRecord, learnerAlias: string) {
  const selection = selectLearner(record, learnerAlias);
  const gameMap = selection?.course.gameMap;
  if (!selection || !gameMap || !hasValidMapAliases(gameMap)) return null;
  return Object.freeze({ ...selection, gameMap });
}

export function selectStandaloneGame(
  record: SessionRecord,
  learnerAlias: string,
  gameAlias: string,
) {
  const selection = selectGameMap(record, learnerAlias);
  if (!selection) return null;
  const matches = selection.gameMap.sections.flatMap((section) =>
    section.positions
      .filter(({ game }) => game.alias === gameAlias)
      .map((position) => ({ position, section })),
  );
  if (matches.length !== 1) return null;
  const { position, section } = matches[0]!;
  return Object.freeze({
    ...selection,
    game: position.game,
    position,
    section,
  });
}

export function selectMapSection(
  record: SessionRecord,
  learnerAlias: string,
  sectionAlias: string,
) {
  const selection = selectGameMap(record, learnerAlias);
  if (!selection) return null;
  const sections = selection.gameMap.sections.filter(
    ({ alias }) => alias === sectionAlias,
  );
  if (sections.length !== 1) return null;
  return Object.freeze({ ...selection, section: sections[0]! });
}

export function projectGameMapForLearner(
  record: SessionRecord,
  learnerAlias: string,
): LearnerGameMap | null {
  const selection = selectGameMap(record, learnerAlias);
  if (!selection) return null;
  return Object.freeze({
    color: selection.gameMap.color,
    sections: Object.freeze(
      selection.gameMap.sections.map((section) =>
        Object.freeze({
          alias: section.alias,
          height: section.height,
          positions: Object.freeze(
            section.positions.map((position) =>
              Object.freeze({
                gameAlias: position.game.alias,
                initiallyFinished: position.finishedByLearnerIds.includes(
                  selection.learner.id,
                ),
                initiallyViewed: position.viewedByLearnerIds.includes(
                  selection.learner.id,
                ),
                order: position.order,
                xEnd: position.xEnd,
                xStart: position.xStart,
                yEnd: position.yEnd,
                yStart: position.yStart,
              }),
            ),
          ),
          width: section.width,
        }),
      ),
    ),
    title: selection.gameMap.title,
  });
}

export function selectMedia(
  record: SessionRecord,
  learnerAlias: string,
  mediaAlias: string,
) {
  const selection = selectLearner(record, learnerAlias);
  if (!selection) return null;
  const media = [...selection.course.audios, ...selection.course.videos].filter(
    ({ alias }) => alias === mediaAlias,
  );
  if (media.length !== 1) return null;
  return Object.freeze({ ...selection, media: media[0]! });
}

export function selectVideoGame(
  record: SessionRecord,
  learnerAlias: string,
  mediaAlias: string,
  gameAlias: string,
) {
  const selection = selectMedia(record, learnerAlias, mediaAlias);
  if (!selection || selection.media.kind !== "video") return null;
  const games = selection.media.games.filter(
    ({ alias }) => alias === gameAlias,
  );
  if (games.length !== 1) return null;
  return Object.freeze({ ...selection, game: games[0]! });
}

export function isVideoViewedByLearner(
  learner: SessionLearner,
  media: SessionMedia,
): boolean {
  return (
    media.kind === "video" && media.viewedByLearnerIds.includes(learner.id)
  );
}
