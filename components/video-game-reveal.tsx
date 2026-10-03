"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useLearnerActivityState } from "@/components/learner-activity-state";
import { englishMessages } from "@/lib/i18n/messages/en";

type SafeGameLink = Readonly<{
  alias: string;
  slot: 1 | 2 | 3;
}>;

export function VideoOpenedMarker({
  videoAlias,
}: Readonly<{ videoAlias: string }>) {
  const { markVideoOpened } = useLearnerActivityState();
  useEffect(() => markVideoOpened(videoAlias), [markVideoOpened, videoAlias]);
  return null;
}

export function VideoGameLaunchers({
  enabled,
  games,
  initiallyRevealed,
  learnerAlias,
  videoAlias,
}: Readonly<{
  enabled: boolean;
  games: readonly SafeGameLink[];
  initiallyRevealed: boolean;
  learnerAlias: string;
  videoAlias: string;
}>) {
  const { openedVideos } = useLearnerActivityState();
  if (!games.length || (!initiallyRevealed && !openedVideos.has(videoAlias))) {
    return null;
  }
  return (
    <div className="grid gap-2" aria-label="Linked activities">
      {!enabled && (
        <p className="m-0 text-sm">{englishMessages.games.disabled}</p>
      )}
      <div className="flex flex-wrap gap-3">
        {games.map((game) => {
          const label = game.slot === 1 ? "Activity" : `Activity ${game.slot}`;
          return (
            <Link
              className={`inline-flex min-h-11 items-center rounded-full border-2 border-[#16324f] px-4 py-2 font-bold no-underline shadow-[3px_3px_0_#16324f] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#dd796f] ${enabled ? "bg-[#f4b942]" : "bg-[#e7e2d5] text-[#435467]"}`}
              href={`/learn/${learnerAlias}/media/${videoAlias}/game/${game.alias}`}
              key={game.alias}
              prefetch={false}
            >
              {enabled ? label : `${label} unavailable`}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
