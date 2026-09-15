"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { englishMessages } from "@/lib/i18n/messages/en";

type SafeGameLink = Readonly<{
  alias: string;
  slot: 1 | 2 | 3;
}>;

type RevealState = Readonly<{
  markOpened: (videoAlias: string) => void;
  openedVideos: ReadonlySet<string>;
}>;

const RevealContext = createContext<RevealState | null>(null);

function useRevealState(): RevealState {
  const state = useContext(RevealContext);
  if (!state) throw new Error("Video game reveal provider is missing");
  return state;
}

export function VideoGameRevealProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [openedVideos, setOpenedVideos] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const markOpened = useCallback((videoAlias: string) => {
    setOpenedVideos((current) => {
      if (current.has(videoAlias)) return current;
      const next = new Set(current);
      next.add(videoAlias);
      return next;
    });
  }, []);
  return (
    <RevealContext value={{ markOpened, openedVideos }}>
      {children}
    </RevealContext>
  );
}

export function VideoOpenedMarker({
  videoAlias,
}: Readonly<{ videoAlias: string }>) {
  const { markOpened } = useRevealState();
  useEffect(() => markOpened(videoAlias), [markOpened, videoAlias]);
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
  const { openedVideos } = useRevealState();
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
