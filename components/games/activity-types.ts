import type { GameAssetRegistry } from "@/lib/games/package/assets";
import type { FeedbackState } from "@/lib/games/runtime/state";

import type { GameAudioController } from "./game-audio";

export type ActivityPhase =
  "accepting-input" | "feedback" | "paused" | "prompt";

export type ActivityProps = Readonly<{
  assets: GameAssetRegistry;
  audio: GameAudioController;
  feedbackOutcome?: FeedbackState["outcome"];
  generationId: number;
  onAudioFailed: () => void;
  onComplete: () => void;
  onCorrect: (promptNext: boolean) => void;
  onFeedbackFinished: () => void;
  onIncorrect: () => void;
  onPromptFinished: () => void;
  phase: ActivityPhase;
}>;

export function assetUrls(
  assets: GameAssetRegistry,
  paths: readonly string[],
): string[] {
  return paths.map((path) => assets.getUrl(path));
}
