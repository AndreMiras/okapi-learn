import "server-only";

import type { SessionRecord } from "./types";

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
