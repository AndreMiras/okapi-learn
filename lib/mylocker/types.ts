export type MediaKind = "audio" | "video";

export type NormalizedGameLink = Readonly<{
  id: string;
  slot: 1 | 2 | 3;
}>;

export type NormalizedMedia = Readonly<{
  description: string | null;
  duration: string | null;
  games: readonly NormalizedGameLink[];
  id: string;
  kind: MediaKind;
  order: number;
  title: string;
  url: string | null;
  viewedByLearnerIds: readonly string[];
}>;

export type NormalizedCourse = Readonly<{
  audios: readonly NormalizedMedia[];
  id: string;
  name: string;
  videos: readonly NormalizedMedia[];
}>;

export type NormalizedLearner = Readonly<{
  courseId: string;
  id: string;
  name: string;
}>;

export type AuthenticationGraph = Readonly<{
  courses: readonly NormalizedCourse[];
  gameMapTester: boolean;
  gameTester: boolean;
  learners: readonly NormalizedLearner[];
  termsPending: boolean;
  token: string;
}>;

export type LoginCredentials = Readonly<{
  password: string;
  username: string;
}>;
