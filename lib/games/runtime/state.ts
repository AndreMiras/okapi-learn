import type { GamePackage } from "../package/types";

export type ErrorCounts = Readonly<Record<string, number>>;
export type RuntimeFailureReason = "audio" | "load" | "runtime" | "unavailable";

type Progress = Readonly<{
  completedDynamicIds: readonly string[];
  errors: ErrorCounts;
  generationId: number;
  index: number;
  package: GamePackage;
  requestId: number;
}>;

export type LoadingState = Readonly<{
  requestId: number;
  status: "loading";
}>;

export type ReadyState = Progress & Readonly<{ status: "ready" }>;
export type PromptState = Progress & Readonly<{ status: "prompt" }>;
export type AcceptingInputState = Progress &
  Readonly<{ status: "accepting-input" }>;
export type FeedbackState = Progress &
  Readonly<{
    outcome: "complete" | "continue" | "incorrect";
    promptNext: boolean;
    status: "feedback";
  }>;

export type RuntimeSummary = Readonly<{
  completedDynamicIds: readonly string[];
  errors: ErrorCounts;
  gameId: string;
  totalDynamics: number;
  totalErrors: number;
}>;

export type CompleteState = Readonly<{
  completedDynamicIds: readonly string[];
  errors: ErrorCounts;
  requestId: number;
  status: "complete";
  summary: RuntimeSummary;
}>;

export type RetryTarget =
  | Readonly<{ kind: "load" }>
  | Readonly<{ kind: "prompt"; state: PromptState }>
  | Readonly<{ kind: "feedback"; state: FeedbackState }>;

export type FailedState = Readonly<{
  reason: RuntimeFailureReason;
  requestId: number;
  retry: RetryTarget;
  status: "failed";
}>;

export type RunnerState =
  | Readonly<{ status: "idle" }>
  | LoadingState
  | ReadyState
  | PromptState
  | AcceptingInputState
  | FeedbackState
  | CompleteState
  | FailedState;

export type RunnerEvent =
  | Readonly<{ requestId: number; type: "START_LOAD" }>
  | Readonly<{
      package: GamePackage;
      requestId: number;
      type: "LOAD_SUCCEEDED";
    }>
  | Readonly<{
      reason: RuntimeFailureReason;
      requestId: number;
      type: "LOAD_FAILED";
    }>
  | Readonly<{ type: "BEGIN_PROMPT" }>
  | Readonly<{ generationId: number; type: "PROMPT_FINISHED" }>
  | Readonly<{ generationId: number; type: "REPORT_INCORRECT" }>
  | Readonly<{
      generationId: number;
      promptNext: boolean;
      type: "REPORT_CORRECT";
    }>
  | Readonly<{ generationId: number; type: "REPORT_COMPLETE" }>
  | Readonly<{ generationId: number; type: "FEEDBACK_FINISHED" }>
  | Readonly<{
      generationId: number;
      reason: RuntimeFailureReason;
      type: "DYNAMIC_FAILED";
    }>
  | Readonly<{ requestId: number; type: "RETRY" }>;

export function createLoadingState(requestId: number): LoadingState {
  return { requestId, status: "loading" };
}

function hasGeneration(
  state: Progress,
  event: Readonly<{ generationId: number }>,
): boolean {
  return state.generationId === event.generationId;
}

function progressOnly(state: Progress): Progress {
  return {
    completedDynamicIds: state.completedDynamicIds,
    errors: state.errors,
    generationId: state.generationId,
    index: state.index,
    package: state.package,
    requestId: state.requestId,
  };
}

function finishDynamic(state: FeedbackState): ReadyState | CompleteState {
  const progress = progressOnly(state);
  const dynamicId = state.package.dynamics[state.index]!.id;
  const completedDynamicIds = [...state.completedDynamicIds, dynamicId];
  const nextIndex = state.index + 1;

  if (nextIndex < state.package.dynamics.length) {
    return {
      ...progress,
      completedDynamicIds,
      index: nextIndex,
      status: "ready",
    };
  }

  const errors = { ...state.errors };
  return {
    completedDynamicIds,
    errors,
    requestId: state.requestId,
    status: "complete",
    summary: {
      completedDynamicIds,
      errors,
      gameId: state.package.id,
      totalDynamics: state.package.dynamics.length,
      totalErrors: Object.values(errors).reduce(
        (total, count) => total + count,
        0,
      ),
    },
  };
}

export function runnerReducer(
  state: RunnerState,
  event: RunnerEvent,
): RunnerState {
  switch (state.status) {
    case "idle":
      return event.type === "START_LOAD"
        ? createLoadingState(event.requestId)
        : state;

    case "loading":
      if (event.type !== "LOAD_FAILED" && event.type !== "LOAD_SUCCEEDED") {
        return state;
      }
      if (event.requestId !== state.requestId) return state;
      if (event.type === "LOAD_FAILED") {
        return {
          reason: event.reason,
          requestId: state.requestId,
          retry: { kind: "load" },
          status: "failed",
        };
      }
      if (event.type === "LOAD_SUCCEEDED") {
        const errors = Object.fromEntries(
          event.package.dynamics.map(({ id }) => [id, 0]),
        );
        return {
          completedDynamicIds: [],
          errors,
          generationId: 0,
          index: 0,
          package: event.package,
          requestId: state.requestId,
          status: "ready",
        };
      }
      return state;

    case "ready":
      if (event.type !== "BEGIN_PROMPT") return state;
      return {
        ...state,
        generationId: state.generationId + 1,
        status: "prompt",
      };

    case "prompt":
      if (event.type !== "PROMPT_FINISHED" && event.type !== "DYNAMIC_FAILED") {
        return state;
      }
      if (!hasGeneration(state, event)) return state;
      if (event.type === "PROMPT_FINISHED") {
        return { ...state, status: "accepting-input" };
      }
      if (event.type === "DYNAMIC_FAILED") {
        return {
          reason: event.reason,
          requestId: state.requestId,
          retry: { kind: "prompt", state },
          status: "failed",
        };
      }
      return state;

    case "accepting-input": {
      if (
        (event.type !== "REPORT_INCORRECT" &&
          event.type !== "REPORT_CORRECT" &&
          event.type !== "REPORT_COMPLETE") ||
        !hasGeneration(state, event)
      ) {
        return state;
      }

      if (event.type === "REPORT_INCORRECT") {
        const dynamicId = state.package.dynamics[state.index]!.id;
        return {
          ...state,
          errors: {
            ...state.errors,
            [dynamicId]: state.errors[dynamicId]! + 1,
          },
          outcome: "incorrect",
          promptNext: false,
          status: "feedback",
        };
      }
      if (event.type === "REPORT_CORRECT") {
        return {
          ...state,
          outcome: "continue",
          promptNext: event.promptNext,
          status: "feedback",
        };
      }
      return {
        ...state,
        outcome: "complete",
        promptNext: false,
        status: "feedback",
      };
    }

    case "feedback":
      if (
        event.type !== "FEEDBACK_FINISHED" &&
        event.type !== "DYNAMIC_FAILED"
      ) {
        return state;
      }
      if (!hasGeneration(state, event)) return state;
      if (event.type === "DYNAMIC_FAILED") {
        return {
          reason: event.reason,
          requestId: state.requestId,
          retry: { kind: "feedback", state },
          status: "failed",
        };
      }
      if (event.type !== "FEEDBACK_FINISHED") return state;
      if (state.outcome !== "complete") {
        const progress = progressOnly(state);
        return state.promptNext
          ? {
              ...progress,
              generationId: progress.generationId + 1,
              status: "prompt",
            }
          : { ...progress, status: "accepting-input" };
      }
      return finishDynamic(state);

    case "failed":
      if (event.type !== "RETRY") return state;
      if (state.retry.kind === "load") {
        return createLoadingState(event.requestId);
      }
      if (event.requestId !== state.requestId) return state;
      return {
        ...state.retry.state,
        generationId: state.retry.state.generationId + 1,
      };

    case "complete":
      return state;
  }
}
