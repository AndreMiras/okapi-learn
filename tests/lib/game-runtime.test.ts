import { describe, expect, it } from "vitest";

import type { GamePackage, WildcardDynamic } from "@/lib/games/package/types";
import { shuffle } from "@/lib/games/runtime/shuffle";
import {
  createLoadingState,
  runnerReducer,
  type RunnerEvent,
  type RunnerState,
} from "@/lib/games/runtime/state";

function wildcard(id: string): WildcardDynamic {
  return {
    automatic: false,
    backgroundImage: null,
    errorSound: [],
    finalSound: [],
    id,
    initialSound: [],
    name: id,
    nextImage: null,
    okSound: [],
    position: 0,
    rgb: null,
    speaker: false,
    textureImage: null,
    type: "WILDCARD",
    waitSeconds: 0,
  };
}

const game: GamePackage = {
  book: false,
  dynamics: [wildcard("first"), wildcard("second")],
  id: "runtime-test",
  name: "Runtime test",
};

function reduce(state: RunnerState, event: RunnerEvent): RunnerState {
  return runnerReducer(state, event);
}

describe("shuffle", () => {
  it("uses injected Fisher-Yates randomness without mutating its input", () => {
    const input = Object.freeze(["a", "b", "c", "d"]);
    const values = [0, 0.5, 0.25];

    expect(shuffle(input, () => values.shift()!)).toEqual(["c", "d", "b", "a"]);
    expect(input).toEqual(["a", "b", "c", "d"]);
  });

  it("rejects values outside the random source contract", () => {
    expect(() => shuffle([1, 2], () => 1)).toThrow(RangeError);
    expect(() => shuffle([1, 2], () => -0.1)).toThrow(RangeError);
    expect(() => shuffle([1, 2], () => Number.NaN)).toThrow(RangeError);
  });
});

describe("runnerReducer", () => {
  it("rejects stale loads and retries a failed load with a new request", () => {
    const loading = createLoadingState(4);
    expect(
      reduce(loading, { package: game, requestId: 3, type: "LOAD_SUCCEEDED" }),
    ).toBe(loading);

    const failed = reduce(loading, {
      reason: "load",
      requestId: 4,
      type: "LOAD_FAILED",
    });
    expect(failed).toMatchObject({ status: "failed", retry: { kind: "load" } });
    expect(reduce(failed, { requestId: 5, type: "RETRY" })).toEqual({
      requestId: 5,
      status: "loading",
    });
  });

  it("allows only the ordered legal transitions and advances once", () => {
    let state = reduce(createLoadingState(7), {
      package: game,
      requestId: 7,
      type: "LOAD_SUCCEEDED",
    });
    expect(state).toMatchObject({
      completedDynamicIds: [],
      errors: { first: 0, second: 0 },
      index: 0,
      status: "ready",
    });

    const ready = state;
    expect(reduce(state, { generationId: 0, type: "PROMPT_FINISHED" })).toBe(
      ready,
    );
    state = reduce(state, { type: "BEGIN_PROMPT" });
    expect(state).toMatchObject({ generationId: 1, status: "prompt" });
    expect(reduce(state, { generationId: 0, type: "PROMPT_FINISHED" })).toBe(
      state,
    );
    state = reduce(state, { generationId: 1, type: "PROMPT_FINISHED" });
    expect(state.status).toBe("accepting-input");

    state = reduce(state, { generationId: 1, type: "REPORT_INCORRECT" });
    expect(state).toMatchObject({
      errors: { first: 1, second: 0 },
      outcome: "incorrect",
      status: "feedback",
    });
    const feedback = state;
    expect(reduce(state, { generationId: 1, type: "REPORT_COMPLETE" })).toBe(
      feedback,
    );
    state = reduce(state, { generationId: 1, type: "FEEDBACK_FINISHED" });
    expect(state.status).toBe("accepting-input");

    state = reduce(state, { generationId: 1, type: "REPORT_COMPLETE" });
    state = reduce(state, { generationId: 1, type: "FEEDBACK_FINISHED" });
    expect(state).toMatchObject({
      completedDynamicIds: ["first"],
      index: 1,
      status: "ready",
    });
    const advanced = state;
    expect(reduce(state, { generationId: 1, type: "FEEDBACK_FINISHED" })).toBe(
      advanced,
    );
  });

  it("rejects stale dynamic callbacks, retries, and creates a local summary", () => {
    let state = reduce(createLoadingState(9), {
      package: game,
      requestId: 9,
      type: "LOAD_SUCCEEDED",
    });

    for (const id of ["first", "second"]) {
      state = reduce(state, { type: "BEGIN_PROMPT" });
      const generationId = id === "first" ? 1 : 2;

      if (id === "second") {
        expect(
          reduce(state, {
            generationId: 1,
            reason: "audio",
            type: "DYNAMIC_FAILED",
          }),
        ).toBe(state);
        state = reduce(state, {
          generationId,
          reason: "audio",
          type: "DYNAMIC_FAILED",
        });
        expect(state.status).toBe("failed");
        state = reduce(state, { requestId: 9, type: "RETRY" });
        expect(state).toMatchObject({ generationId: 3, status: "prompt" });
      }

      const activeGeneration = id === "first" ? 1 : 3;
      if (id === "second") {
        expect(
          reduce(state, {
            generationId,
            type: "PROMPT_FINISHED",
          }),
        ).toBe(state);
      }
      state = reduce(state, {
        generationId: activeGeneration,
        type: "PROMPT_FINISHED",
      });
      state = reduce(state, {
        generationId: activeGeneration,
        type: "REPORT_COMPLETE",
      });
      state = reduce(state, {
        generationId: activeGeneration,
        type: "FEEDBACK_FINISHED",
      });
    }

    expect(state).toEqual({
      completedDynamicIds: ["first", "second"],
      errors: { first: 0, second: 0 },
      requestId: 9,
      status: "complete",
      summary: {
        completedDynamicIds: ["first", "second"],
        errors: { first: 0, second: 0 },
        gameId: "runtime-test",
        totalDynamics: 2,
        totalErrors: 0,
      },
    });
    expect(reduce(state, { type: "BEGIN_PROMPT" })).toBe(state);
  });

  it("retries feedback without incrementing errors or accepting stale completion", () => {
    let state = reduce(createLoadingState(2), {
      package: game,
      requestId: 2,
      type: "LOAD_SUCCEEDED",
    });
    state = reduce(state, { type: "BEGIN_PROMPT" });
    state = reduce(state, { generationId: 1, type: "PROMPT_FINISHED" });
    state = reduce(state, { generationId: 1, type: "REPORT_COMPLETE" });
    state = reduce(state, {
      generationId: 1,
      reason: "audio",
      type: "DYNAMIC_FAILED",
    });
    state = reduce(state, { requestId: 2, type: "RETRY" });
    expect(state).toMatchObject({
      errors: { first: 0, second: 0 },
      generationId: 2,
      status: "feedback",
    });
    expect(reduce(state, { generationId: 1, type: "FEEDBACK_FINISHED" })).toBe(
      state,
    );
    expect(
      reduce(state, { generationId: 2, type: "FEEDBACK_FINISHED" }),
    ).toMatchObject({ completedDynamicIds: ["first"], status: "ready" });
  });

  it("can prompt the next item or continue accepting input after correct feedback", () => {
    let state = reduce(createLoadingState(3), {
      package: game,
      requestId: 3,
      type: "LOAD_SUCCEEDED",
    });
    state = reduce(state, { type: "BEGIN_PROMPT" });
    state = reduce(state, { generationId: 1, type: "PROMPT_FINISHED" });
    state = reduce(state, {
      generationId: 1,
      promptNext: true,
      type: "REPORT_CORRECT",
    });
    state = reduce(state, { generationId: 1, type: "FEEDBACK_FINISHED" });
    expect(state).toMatchObject({ generationId: 2, status: "prompt" });

    state = reduce(state, { generationId: 2, type: "PROMPT_FINISHED" });
    state = reduce(state, {
      generationId: 2,
      promptNext: false,
      type: "REPORT_CORRECT",
    });
    state = reduce(state, { generationId: 2, type: "FEEDBACK_FINISHED" });
    expect(state).toMatchObject({ generationId: 2, status: "accepting-input" });
  });
});
