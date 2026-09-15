import type { RunnerState } from "@/lib/games/runtime/state";

function statusText(state: RunnerState): string {
  switch (state.status) {
    case "idle":
      return "Ready to start.";
    case "loading":
      return "Loading and checking this activity.";
    case "ready":
    case "prompt":
      return "Listen for the prompt.";
    case "accepting-input":
      return "Prompt ready. Choose an answer.";
    case "feedback":
      return state.outcome === "incorrect"
        ? "Not quite. Try again."
        : "Correct.";
    case "failed":
      return state.reason === "audio"
        ? "Audio could not continue. Try again or exit."
        : "This activity could not continue.";
    case "complete":
      return `Activity complete with ${state.summary.totalErrors} ${state.summary.totalErrors === 1 ? "error" : "errors"}.`;
  }
}

export function GameStatus({ state }: Readonly<{ state: RunnerState }>) {
  const progress =
    "index" in state
      ? `Activity ${state.index + 1} of ${state.package.dynamics.length}`
      : state.status === "complete"
        ? `${state.summary.totalDynamics} activities complete`
        : null;
  return (
    <div
      className="grid gap-1"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {progress && <p className="m-0 text-sm font-bold">{progress}</p>}
      <p className="m-0">{statusText(state)}</p>
    </div>
  );
}
