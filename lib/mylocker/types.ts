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

export type NormalizedMapPosition = Readonly<{
  finishedByLearnerIds: readonly string[];
  gameId: string;
  order: number;
  viewedByLearnerIds: readonly string[];
  xEnd: number;
  xStart: number;
  yEnd: number;
  yStart: number;
}>;

export type NormalizedMapSection = Readonly<{
  frontImageUrl: string;
  height: number;
  positions: readonly NormalizedMapPosition[];
  width: number;
}>;

export type NormalizedGameMap = Readonly<{
  color: string | null;
  id: string;
  sections: readonly NormalizedMapSection[];
  title: string | null;
}>;

export type NormalizedCourse = Readonly<{
  audios: readonly NormalizedMedia[];
  gameMap: NormalizedGameMap | null;
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
