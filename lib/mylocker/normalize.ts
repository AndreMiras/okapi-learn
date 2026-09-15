import { UpstreamError } from "./errors";
import type {
  AuthenticationGraph,
  MediaKind,
  NormalizedCourse,
  NormalizedGameLink,
  NormalizedLearner,
  NormalizedMedia,
} from "./types";
import { normalizeServerHeldMediaUrl } from "./url-policy";

const MAX_LEARNERS = 16;
const MAX_COURSES = 32;
const MAX_MEDIA_PER_KIND = 256;
const MAX_VIEWED_BY = 16;
const MAX_STRUCTURE_DEPTH = 12;
const MAX_STRUCTURE_NODES = 25_000;
const UNSAFE_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

function invalid(): never {
  throw new UpstreamError("invalid_response");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(
  value: unknown,
  maximumLength: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || value.length > maximumLength) invalid();
  const normalized = value.trim();
  if (
    (!allowEmpty && !normalized) ||
    UNSAFE_CONTROL_CHARACTERS.test(normalized)
  )
    invalid();
  return normalized;
}

function optionalText(value: unknown, maximumLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return boundedString(value, maximumLength, true);
}

function boundedArray(
  value: unknown,
  maximumLength: number,
): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximumLength) invalid();
  return value;
}

function assertStructuralBounds(root: unknown): void {
  const pending: Array<{ depth: number; value: unknown }> = [
    { depth: 0, value: root },
  ];
  let visited = 0;
  while (pending.length) {
    const current = pending.pop();
    if (!current) break;
    visited += 1;
    if (visited > MAX_STRUCTURE_NODES || current.depth > MAX_STRUCTURE_DEPTH)
      invalid();
    if (Array.isArray(current.value)) {
      for (const value of current.value)
        pending.push({ depth: current.depth + 1, value });
    } else if (isRecord(current.value)) {
      const values = Object.values(current.value);
      if (values.length > 128) invalid();
      for (const value of values)
        pending.push({ depth: current.depth + 1, value });
    }
  }
}

const GAME_FIELDS = [
  ["GameId", 1],
  ["GameId2", 2],
  ["GameId3", 3],
] as const;

function normalizeGames(
  value: Record<string, unknown>,
): readonly NormalizedGameLink[] {
  const ids = new Set<string>();
  return Object.freeze(
    GAME_FIELDS.flatMap(([key, slot]) => {
      const source = value[key];
      if (source === null || source === undefined || source === "") return [];
      const id = boundedString(source, 256);
      if (ids.has(id)) invalid();
      ids.add(id);
      return [Object.freeze({ id, slot })];
    }),
  );
}

function normalizeViewedBy(
  value: unknown,
  learnerIds: ReadonlySet<string>,
): readonly string[] {
  if (value === null || value === undefined) return Object.freeze([]);
  const ids = boundedArray(value, MAX_VIEWED_BY).map((id) =>
    boundedString(id, 256),
  );
  if (new Set(ids).size !== ids.length) invalid();
  return Object.freeze(ids.filter((id) => learnerIds.has(id)));
}

function normalizeMedia(
  value: unknown,
  kind: MediaKind,
  learnerIds: ReadonlySet<string>,
): NormalizedMedia {
  if (!isRecord(value)) invalid();
  const idKey = kind === "audio" ? "AudioId" : "VideoId";
  const urlKey = kind === "audio" ? "UrlAudio" : "UrlVideo";
  const order = value.Orden;
  if (
    !Number.isSafeInteger(order) ||
    (order as number) < 0 ||
    (order as number) > 100_000
  ) {
    invalid();
  }
  return Object.freeze({
    description: optionalText(value.Description, 4_000),
    duration: optionalText(value.Duration, 100),
    games: kind === "video" ? normalizeGames(value) : Object.freeze([]),
    id: boundedString(value[idKey], 256),
    kind,
    order: order as number,
    title: boundedString(value.Title, 500),
    url: normalizeServerHeldMediaUrl(value[urlKey]),
    viewedByLearnerIds:
      kind === "video"
        ? normalizeViewedBy(value.ViewedBy, learnerIds)
        : Object.freeze([]),
  });
}

function normalizeCourse(
  value: unknown,
  mediaIds: Set<string>,
  learnerIdsByCourse: ReadonlyMap<string, ReadonlySet<string>>,
): NormalizedCourse {
  if (!isRecord(value)) invalid();
  const id = boundedString(value.CourseId, 256);
  const learnerIds = learnerIdsByCourse.get(id) ?? new Set<string>();
  const normalizeCollection = (key: "Audios" | "Videos", kind: MediaKind) => {
    const source =
      value[key] === null || value[key] === undefined ? [] : value[key];
    return boundedArray(source, MAX_MEDIA_PER_KIND).map((item) => {
      const media = normalizeMedia(item, kind, learnerIds);
      const qualifiedId = `${kind}:${media.id}`;
      if (mediaIds.has(qualifiedId)) invalid();
      mediaIds.add(qualifiedId);
      return media;
    });
  };
  return Object.freeze({
    audios: Object.freeze(normalizeCollection("Audios", "audio")),
    id,
    name: boundedString(value.Name, 500),
    videos: Object.freeze(normalizeCollection("Videos", "video")),
  });
}

function normalizeLearner(value: unknown): NormalizedLearner {
  if (!isRecord(value)) invalid();
  return Object.freeze({
    courseId: boundedString(value.CourseId, 256),
    id: boundedString(value.StudentId, 256),
    name: boundedString(value.Name, 200),
  });
}

function uniqueById<T extends { id: string }>(values: readonly T[]): void {
  if (new Set(values.map(({ id }) => id)).size !== values.length) invalid();
}

export function normalizeAuthenticationResponse(
  value: unknown,
): AuthenticationGraph {
  assertStructuralBounds(value);
  if (!isRecord(value)) invalid();
  if (
    typeof value.TermsPending !== "boolean" ||
    typeof value.GameTester !== "boolean" ||
    typeof value.GameMapTester !== "boolean"
  ) {
    invalid();
  }

  const learners = boundedArray(value.Students, MAX_LEARNERS).map(
    normalizeLearner,
  );
  uniqueById(learners);
  const learnerIdsByCourse = new Map<string, Set<string>>();
  for (const learner of learners) {
    const ids = learnerIdsByCourse.get(learner.courseId) ?? new Set<string>();
    ids.add(learner.id);
    learnerIdsByCourse.set(learner.courseId, ids);
  }
  const mediaIds = new Set<string>();
  const courses = boundedArray(value.Courses, MAX_COURSES).map((course) =>
    normalizeCourse(course, mediaIds, learnerIdsByCourse),
  );
  uniqueById(courses);
  const courseIds = new Set(courses.map(({ id }) => id));
  if (learners.some(({ courseId }) => !courseIds.has(courseId))) invalid();

  return Object.freeze({
    courses: Object.freeze(courses),
    gameMapTester: value.GameMapTester,
    gameTester: value.GameTester,
    learners: Object.freeze(learners),
    termsPending: value.TermsPending,
    token: boundedString(value.authToken, 4096),
  });
}
