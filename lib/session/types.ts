import type { MediaKind } from "@/lib/mylocker/types";

export type SessionGameLink = Readonly<{
  alias: string;
  id: string;
  slot: 1 | 2 | 3;
}>;

export type SessionMedia = Readonly<{
  alias: string;
  description: string | null;
  duration: string | null;
  games: readonly SessionGameLink[];
  id: string;
  kind: MediaKind;
  order: number;
  title: string;
  url: string | null;
  viewedByLearnerIds: readonly string[];
}>;

export type SessionCourse = Readonly<{
  audios: readonly SessionMedia[];
  id: string;
  name: string;
  videos: readonly SessionMedia[];
}>;

export type SessionLearner = Readonly<{
  alias: string;
  courseId: string;
  id: string;
  name: string;
}>;

export type SessionRecord = Readonly<{
  courses: readonly SessionCourse[];
  expiresAt: number;
  issuedAt: number;
  learners: readonly SessionLearner[];
  locale: "en";
  token: string;
}>;
