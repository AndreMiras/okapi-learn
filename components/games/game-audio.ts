"use client";

export type GameAudioErrorCode = "blocked" | "cancelled" | "playback";

export class GameAudioError extends Error {
  readonly code: GameAudioErrorCode;

  constructor(code: GameAudioErrorCode) {
    const messages: Record<GameAudioErrorCode, string> = {
      blocked: "Audio playback was blocked.",
      cancelled: "Audio playback was cancelled.",
      playback: "Audio playback failed.",
    };
    super(messages[code]);
    this.name = "GameAudioError";
    this.code = code;
  }
}

export type AudioElementFactory = () => HTMLAudioElement;

type ActiveSequence = {
  generation: number;
  queue: string[];
  reject: (reason: GameAudioError) => void;
  resolve: () => void;
};

function createBrowserAudio(): HTMLAudioElement {
  if (typeof Audio === "undefined") {
    throw new Error(
      "Game audio requires a browser or an injected audio factory.",
    );
  }
  return new Audio();
}

export class GameAudioController {
  private readonly audio: HTMLAudioElement;
  private active: ActiveSequence | null = null;
  private currentPrompt: string[] = [];
  private disposed = false;
  private generation = 0;

  constructor(createAudio: AudioElementFactory = createBrowserAudio) {
    this.audio = createAudio();
  }

  play(urls: readonly string[]): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new GameAudioError("cancelled"));
    }

    this.cancelActive();
    const generation = ++this.generation;
    if (urls.length === 0) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      this.active = {
        generation,
        queue: [...urls],
        reject,
        resolve,
      };
      this.playNext(generation);
    });
  }

  playPrompt(
    commonUrls: readonly string[],
    promptUrls: readonly string[],
  ): Promise<void> {
    this.currentPrompt = [...promptUrls];
    return this.play([...commonUrls, ...promptUrls]);
  }

  replayCurrentPrompt(): Promise<void> {
    return this.play(this.currentPrompt);
  }

  cancel(): void {
    this.cancelActive();
    ++this.generation;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.currentPrompt = [];
    this.cancel();
  }

  private playNext(generation: number): void {
    const active = this.active;
    if (!active || active.generation !== generation) return;

    const url = active.queue.shift();
    if (url === undefined) {
      this.active = null;
      this.clearSource();
      active.resolve();
      return;
    }

    this.audio.onended = () => this.playNext(generation);
    this.audio.onerror = () => this.fail(generation, "playback");
    this.audio.src = url;

    let playback: Promise<void>;
    try {
      playback = this.audio.play();
    } catch {
      this.fail(generation, "blocked");
      return;
    }

    void Promise.resolve(playback).catch(() => {
      this.fail(generation, "blocked");
    });
  }

  private fail(generation: number, code: "blocked" | "playback"): void {
    const active = this.active;
    if (!active || active.generation !== generation) return;

    this.active = null;
    ++this.generation;
    this.clearSource();
    active.reject(new GameAudioError(code));
  }

  private cancelActive(): void {
    const active = this.active;
    if (!active) {
      this.clearSource();
      return;
    }

    this.active = null;
    this.clearSource();
    active.reject(new GameAudioError("cancelled"));
  }

  private clearSource(): void {
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
