import { describe, expect, it, vi } from "vitest";

import {
  GameAudioController,
  GameAudioError,
} from "@/components/games/game-audio";

class FakeAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  readonly loadedSources: string[] = [];
  readonly load = vi.fn();
  readonly pause = vi.fn();
  readonly removeAttribute = vi.fn((name: string) => {
    if (name === "src") this.src = "";
  });
  playResult: Promise<void> = Promise.resolve();
  readonly play = vi.fn(() => {
    this.loadedSources.push(this.src);
    return this.playResult;
  });
}

function setup() {
  const audio = new FakeAudio();
  const factory = vi.fn(() => audio as unknown as HTMLAudioElement);
  return {
    audio,
    controller: new GameAudioController(factory),
    factory,
  };
}

describe("GameAudioController", () => {
  it("owns one injected element and resolves an empty queue immediately", async () => {
    const { audio, controller, factory } = setup();

    await expect(controller.play([])).resolves.toBeUndefined();
    expect(factory).toHaveBeenCalledOnce();
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("plays URLs in order and settles only after the final ended event", async () => {
    const { audio, controller } = setup();
    const settled = vi.fn();
    const playback = controller.play(["first", "second"]).then(settled);

    expect(audio.loadedSources).toEqual(["first"]);
    audio.onended?.();
    expect(audio.loadedSources).toEqual(["first", "second"]);
    expect(settled).not.toHaveBeenCalled();
    audio.onended?.();

    await playback;
    expect(settled).toHaveBeenCalledOnce();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenLastCalledWith("src");
    expect(audio.src).toBe("");
  });

  it("rejects browser-blocked playback with a safe retry code", async () => {
    const { audio, controller } = setup();
    audio.playResult = Promise.reject(new Error("file:///private/prompt.mp3"));

    const playback = controller.play(["secret-url"]);

    await expect(playback).rejects.toEqual(
      expect.objectContaining({
        code: "blocked",
        message: "Audio playback was blocked.",
      } satisfies Partial<GameAudioError>),
    );
    expect(audio.src).toBe("");
  });

  it("rejects media errors without exposing the failed URL", async () => {
    const { audio, controller } = setup();
    const playback = controller.play(["sensitive-asset-url"]);

    audio.onerror?.();

    await expect(playback).rejects.toMatchObject({
      code: "playback",
      message: "Audio playback failed.",
    });
    expect(audio.src).toBe("");
  });

  it("replays only the current prompt rather than its common lead-in", async () => {
    const { audio, controller } = setup();
    const initial = controller.playPrompt(["common"], ["prompt-a", "prompt-b"]);
    audio.onended?.();
    audio.onended?.();
    audio.onended?.();
    await initial;

    const replay = controller.replayCurrentPrompt();
    audio.onended?.();
    audio.onended?.();
    await replay;

    expect(audio.loadedSources).toEqual([
      "common",
      "prompt-a",
      "prompt-b",
      "prompt-a",
      "prompt-b",
    ]);
  });

  it("settles cancellation and ignores callbacks from its old generation", async () => {
    const { audio, controller } = setup();
    const first = controller.play(["old", "stale"]);
    const staleEnded = audio.onended;
    const second = controller.play(["current"]);

    await expect(first).rejects.toMatchObject({ code: "cancelled" });
    staleEnded?.();
    expect(audio.loadedSources).toEqual(["old", "current"]);

    audio.onended?.();
    await expect(second).resolves.toBeUndefined();
  });

  it("cancels and cleans the source on disposal", async () => {
    const { audio, controller } = setup();
    const playback = controller.play(["prompt"]);

    controller.dispose();

    await expect(playback).rejects.toMatchObject({ code: "cancelled" });
    await expect(controller.play(["later"])).rejects.toMatchObject({
      code: "cancelled",
    });
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(audio.src).toBe("");
  });
});
