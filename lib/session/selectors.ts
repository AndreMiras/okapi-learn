import "server-only";

import type { SessionLearner, SessionMedia, SessionRecord } from "./types";

export function selectLearner(record: SessionRecord, learnerAlias: string) {
  const learner = record.learners.find(({ alias }) => alias === learnerAlias);
  if (!learner) return null;
  const matchingCourses = record.courses.filter(
    ({ id }) => id === learner.courseId,
  );
  if (matchingCourses.length !== 1) return null;
  return Object.freeze({ course: matchingCourses[0]!, learner });
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
