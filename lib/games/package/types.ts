import type { GameAssetRegistry } from "./assets";

export type SupportedDynamicType = "LISTEN" | "EXPLORE" | "WILDCARD";

export type Frame = Readonly<{
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}>;

export type DynamicElement = Readonly<{
  errorSound: readonly string[];
  frames: readonly Frame[];
  id: string;
  image: string;
  initialSound: readonly string[];
  label: string | null;
  okSound: readonly string[];
}>;

export type DynamicCommon = Readonly<{
  backgroundImage: string | null;
  errorSound: readonly string[];
  finalSound: readonly string[];
  id: string;
  initialSound: readonly string[];
  name: string;
  okSound: readonly string[];
  rgb: string | null;
  textureImage: string | null;
}>;

export type ListenDynamic = DynamicCommon &
  Readonly<{
    fuzzyElements: readonly DynamicElement[];
    random: boolean;
    selectableElements: readonly DynamicElement[];
    type: "LISTEN";
  }>;

export type ExploreDynamic = DynamicCommon &
  Readonly<{
    backgroundHeight: number;
    backgroundImage: string;
    backgroundWidth: number;
    elements: readonly DynamicElement[];
    listen: boolean;
    type: "EXPLORE";
  }>;

export type WildcardDynamic = DynamicCommon &
  Readonly<{
    automatic: boolean;
    nextImage: string | null;
    position: number;
    speaker: boolean;
    type: "WILDCARD";
    waitSeconds: number;
  }>;

export type SupportedDynamic = ExploreDynamic | ListenDynamic | WildcardDynamic;

export type GamePackage = Readonly<{
  book: false;
  dynamics: readonly SupportedDynamic[];
  id: string;
  name: string;
}>;

export type PreparedGame = Readonly<{
  assets: GameAssetRegistry;
  game: GamePackage;
}>;
