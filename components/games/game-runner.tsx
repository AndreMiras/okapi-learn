"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";

import { PackageError } from "@/lib/games/package/errors";
import { prepareGamePackage } from "@/lib/games/package/preflight";
import type { PreparedGame, SupportedDynamic } from "@/lib/games/package/types";
import {
  runnerReducer,
  type RunnerEvent,
  type RunnerState,
} from "@/lib/games/runtime/state";
import { subscribeToLogout } from "@/lib/session/client-events";
import { englishMessages } from "@/lib/i18n/messages/en";

import { ExploreActivity } from "./explore-activity";
import { GameAudioController } from "./game-audio";
import { GameStage } from "./game-stage";
import { GameStatus } from "./game-status";
import { ListenActivity } from "./listen-activity";
import { useGameAssets } from "./use-game-assets";
import { WildcardActivity } from "./wildcard-activity";

type GameRunnerProps = Readonly<{
  activityLabel: string;
  enabled: boolean;
  expiresAt: number;
  gameAlias: string;
  learnerAlias: string;
  mediaAlias: string;
  returnHref: string;
}>;

class DeliveryError extends Error {
  readonly reason: "runtime" | "unavailable";

  constructor(reason: "runtime" | "unavailable") {
    super(reason);
    this.name = "DeliveryError";
    this.reason = reason;
  }
}

function ActivityRenderer({
  audio,
  completeCleanup,
  dispatch,
  dynamic,
  paused,
  prepared,
  state,
}: Readonly<{
  audio: GameAudioController;
  completeCleanup: () => void;
  dispatch: Dispatch<RunnerEvent>;
  dynamic: SupportedDynamic;
  paused: boolean;
  prepared: PreparedGame;
  state: Extract<
    RunnerState,
    { status: "accepting-input" | "feedback" | "prompt" }
  >;
}>) {
  const generationId = state.generationId;
  const common = {
    assets: prepared.assets,
    audio,
    feedbackOutcome: state.status === "feedback" ? state.outcome : undefined,
    generationId,
    onAudioFailed: () =>
      dispatch({ generationId, reason: "audio", type: "DYNAMIC_FAILED" }),
    onComplete: () => dispatch({ generationId, type: "REPORT_COMPLETE" }),
    onCorrect: (promptNext: boolean) =>
      dispatch({ generationId, promptNext, type: "REPORT_CORRECT" }),
    onFeedbackFinished: () => {
      if (state.status === "feedback" && state.outcome === "complete") {
        if (state.index + 1 === state.package.dynamics.length) {
          completeCleanup();
        }
      }
      dispatch({ generationId, type: "FEEDBACK_FINISHED" });
    },
    onIncorrect: () => dispatch({ generationId, type: "REPORT_INCORRECT" }),
    onPromptFinished: () => dispatch({ generationId, type: "PROMPT_FINISHED" }),
    phase: paused ? "paused" : state.status,
  } as const;
  if (dynamic.type === "LISTEN")
    return <ListenActivity {...common} dynamic={dynamic} />;
  if (dynamic.type === "EXPLORE")
    return <ExploreActivity {...common} dynamic={dynamic} />;
  return <WildcardActivity {...common} dynamic={dynamic} />;
}

export function GameRunner({
  activityLabel,
  enabled,
  expiresAt,
  gameAlias,
  learnerAlias,
  mediaAlias,
  returnHref,
}: GameRunnerProps) {
  const [state, dispatch] = useReducer(runnerReducer, { status: "idle" });
  const [prepared, setPrepared] = useState<PreparedGame | null>(null);
  const [audioController, setAudioController] =
    useState<GameAudioController | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const assetsRef = useRef<PreparedGame | null>(null);
  const audioRef = useRef<GameAudioController | null>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  useGameAssets(prepared?.assets ?? null);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.dispose();
    audioRef.current = null;
    setAudioController(null);
    assetsRef.current?.assets.dispose();
    assetsRef.current = null;
  }, []);
  const completeCleanup = useCallback(() => {
    clear();
    setPrepared(null);
  }, [clear]);

  useEffect(() => {
    assetsRef.current = prepared;
  }, [prepared]);

  useEffect(() => {
    const expire = () => {
      clear();
      window.location.replace("/login?reason=expired");
    };
    const timeout = window.setTimeout(
      expire,
      Math.max(0, expiresAt - Date.now()),
    );
    const unsubscribe = subscribeToLogout(() => {
      clear();
      window.location.replace("/login");
    });
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
      clear();
    };
  }, [clear, expiresAt]);

  useEffect(() => {
    if (state.status === "ready") dispatch({ type: "BEGIN_PROMPT" });
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "complete") return;
    completionRef.current?.focus();
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "failed") return;
    failureRef.current?.focus();
  }, [state.status]);

  const load = async (nextRequestId: number, retry: boolean) => {
    clear();
    setPrepared(null);
    const controller = new AbortController();
    const audio = new GameAudioController();
    abortRef.current = controller;
    audioRef.current = audio;
    setAudioController(audio);
    dispatch({
      requestId: nextRequestId,
      type: retry ? "RETRY" : "START_LOAD",
    });
    try {
      const response = await fetch(
        `/api/learn/${learnerAlias}/media/${mediaAlias}/games/${gameAlias}/package`,
        {
          body: null,
          cache: "no-store",
          credentials: "same-origin",
          method: "POST",
          redirect: "error",
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        let category: unknown;
        try {
          category = ((await response.json()) as { error?: unknown }).error;
        } catch {
          category = undefined;
        }
        if (category === "not_available" || category === "not_found") {
          throw new DeliveryError("unavailable");
        }
        if (category === "unsupported") throw new DeliveryError("runtime");
        throw new Error("delivery");
      }
      const nextPrepared = await prepareGamePackage(
        await response.arrayBuffer(),
        controller.signal,
      );
      if (controller.signal.aborted) {
        nextPrepared.assets.dispose();
        return;
      }
      assetsRef.current = nextPrepared;
      setPrepared(nextPrepared);
      dispatch({
        package: nextPrepared.game,
        requestId: nextRequestId,
        type: "LOAD_SUCCEEDED",
      });
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof PackageError && error.category === "aborted")
      )
        return;
      dispatch({
        reason:
          error instanceof DeliveryError
            ? error.reason
            : error instanceof PackageError
              ? error.category === "inaccessible"
                ? "inaccessible"
                : "runtime"
              : "load",
        requestId: nextRequestId,
        type: "LOAD_FAILED",
      });
    }
  };

  const start = () => {
    const next = ++requestId.current;
    void load(next, false);
  };

  const retryLoad = () => {
    const next = ++requestId.current;
    void load(next, true);
  };

  const exit = () => {
    const inProgress =
      state.status !== "idle" &&
      state.status !== "complete" &&
      state.status !== "failed";
    if (inProgress && !window.confirm(englishMessages.games.exitConfirmation))
      return;
    clear();
    window.location.assign(returnHref);
  };

  if (!enabled) {
    return (
      <div className="mt-6 grid gap-4 rounded-2xl border border-[#16324f26] bg-[#f4b9421f] p-5">
        <p className="m-0" role="status">
          {englishMessages.games.disabled}
        </p>
        <a
          className="game-secondary-action justify-self-start"
          href={returnHref}
        >
          {englishMessages.games.backToVideo}
        </a>
      </div>
    );
  }

  const failureMessage =
    state.status !== "failed"
      ? ""
      : state.reason === "audio"
        ? englishMessages.games.audioFailure
        : state.reason === "runtime"
          ? englishMessages.games.unsupported
          : state.reason === "inaccessible"
            ? englishMessages.games.inaccessible
            : state.reason === "unavailable"
              ? englishMessages.games.unavailable
              : englishMessages.games.retryable;

  const activeState =
    state.status === "prompt" ||
    state.status === "accepting-input" ||
    state.status === "feedback"
      ? state
      : state.status === "failed" && state.retry.kind !== "load"
        ? state.retry.state
        : null;

  return (
    <div aria-label={activityLabel} className="mt-6 grid gap-5">
      <GameStatus state={state} />
      {state.status === "idle" && (
        <button
          className="game-primary-action justify-self-start"
          onClick={start}
          type="button"
        >
          {englishMessages.games.play}
        </button>
      )}
      {state.status === "loading" && (
        <p aria-busy="true" className="m-0" role="status">
          {englishMessages.games.loading}
        </p>
      )}
      {prepared && audioController && activeState && (
        <GameStage>
          <ActivityRenderer
            audio={audioController}
            completeCleanup={completeCleanup}
            dispatch={dispatch}
            dynamic={activeState.package.dynamics[activeState.index]!}
            paused={state.status === "failed"}
            prepared={prepared}
            state={activeState}
          />
        </GameStage>
      )}
      {state.status === "failed" && (
        <div
          className="grid justify-items-start gap-3"
          ref={failureRef}
          role="alert"
          tabIndex={-1}
        >
          <p className="m-0">{failureMessage}</p>
          <button
            className="game-secondary-action"
            onClick={() => {
              if (state.retry.kind === "load") retryLoad();
              else dispatch({ requestId: state.requestId, type: "RETRY" });
            }}
            type="button"
          >
            {state.reason === "audio"
              ? englishMessages.games.resumeAudio
              : englishMessages.games.retry}
          </button>
        </div>
      )}
      {state.status === "complete" && (
        <div className="grid gap-2" ref={completionRef} tabIndex={-1}>
          <h2 className="m-0 font-['Fraunces_Variable',serif] text-3xl">
            {englishMessages.games.completeHeading}
          </h2>
          <p className="m-0">{englishMessages.games.completeNotice}</p>
        </div>
      )}
      <button
        className="game-link-action justify-self-start"
        onClick={exit}
        type="button"
      >
        {englishMessages.games.exit}
      </button>
    </div>
  );
}
