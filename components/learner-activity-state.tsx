"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type LearnerActivityState = Readonly<{
  completedStandaloneGames: ReadonlySet<string>;
  markStandaloneComplete: (gameAlias: string) => void;
  markVideoOpened: (videoAlias: string) => void;
  openedVideos: ReadonlySet<string>;
}>;

const ActivityContext = createContext<LearnerActivityState | null>(null);

export function useLearnerActivityState(): LearnerActivityState {
  const state = useContext(ActivityContext);
  if (!state) throw new Error("Learner activity provider is missing");
  return state;
}

function addToSet(
  setState: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
  alias: string,
) {
  setState((current) => {
    if (current.has(alias)) return current;
    const next = new Set(current);
    next.add(alias);
    return next;
  });
}

export function LearnerActivityProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [completedStandaloneGames, setCompletedStandaloneGames] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [openedVideos, setOpenedVideos] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const markStandaloneComplete = useCallback(
    (gameAlias: string) => addToSet(setCompletedStandaloneGames, gameAlias),
    [],
  );
  const markVideoOpened = useCallback(
    (videoAlias: string) => addToSet(setOpenedVideos, videoAlias),
    [],
  );

  return (
    <ActivityContext
      value={{
        completedStandaloneGames,
        markStandaloneComplete,
        markVideoOpened,
        openedVideos,
      }}
    >
      {children}
    </ActivityContext>
  );
}
