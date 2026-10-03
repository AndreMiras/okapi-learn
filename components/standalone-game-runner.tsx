"use client";

import { GameRunner } from "@/components/games/game-runner";
import { useLearnerActivityState } from "@/components/learner-activity-state";
import { englishMessages } from "@/lib/i18n/messages/en";

export function StandaloneGameRunner({
  activityLabel,
  enabled,
  expiresAt,
  gameAlias,
  learnerAlias,
}: Readonly<{
  activityLabel: string;
  enabled: boolean;
  expiresAt: number;
  gameAlias: string;
  learnerAlias: string;
}>) {
  const { markStandaloneComplete } = useLearnerActivityState();
  const returnHref = `/learn/${learnerAlias}/games`;

  return (
    <>
      <p className="mt-5 max-w-2xl text-lg">
        {englishMessages.gameMap.standaloneNotice}
      </p>
      <GameRunner
        activityLabel={activityLabel}
        enabled={enabled}
        expiresAt={expiresAt}
        onComplete={() => markStandaloneComplete(gameAlias)}
        packageHref={`/api/learn/${learnerAlias}/games/${gameAlias}/package`}
        returnHref={returnHref}
        returnLabel={englishMessages.games.backToMap}
      />
    </>
  );
}
