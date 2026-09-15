// @vitest-environment happy-dom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExploreActivity } from "@/components/games/explore-activity";
import { GameAudioController } from "@/components/games/game-audio";
import { GameRunner } from "@/components/games/game-runner";
import { GameStatus } from "@/components/games/game-status";
import { ListenActivity } from "@/components/games/listen-activity";
import { WildcardActivity } from "@/components/games/wildcard-activity";
import type { GameAssetRegistry } from "@/lib/games/package/assets";
import type {
  DynamicElement,
  ExploreDynamic,
  ListenDynamic,
  WildcardDynamic,
} from "@/lib/games/package/types";
import type { RunnerState } from "@/lib/games/runtime/state";
import { createFictionalGameZip } from "@/tests/fixtures/games";

class ImmediateAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  load() {}
  pause() {}
  play() {
    queueMicrotask(() => this.onended?.());
    return Promise.resolve();
  }
  removeAttribute() {
    this.src = "";
  }
}

class BlockOnceAudio extends ImmediateAudio {
  attempts = 0;

  override play() {
    if (this.attempts++ === 0) return Promise.reject(new Error("blocked"));
    return super.play();
  }
}

const assets = {
  dispose: vi.fn(),
  getUrl: (path: string) => `blob:${path}`,
} as unknown as GameAssetRegistry;

const element = (
  id: string,
  label: string,
  frames = [{ x1: 0, x2: 4, y1: 0, y2: 3 }],
): DynamicElement => ({
  errorSound: [],
  frames,
  id,
  image: `${id}.png`,
  initialSound: [],
  label,
  okSound: [],
});

const common = {
  backgroundImage: null,
  errorSound: [],
  finalSound: [],
  initialSound: [],
  name: "Fictional activity",
  okSound: [],
  rgb: null,
  textureImage: null,
};

function controls() {
  return {
    onAudioFailed: vi.fn(),
    onComplete: vi.fn(),
    onCorrect: vi.fn<(promptNext: boolean) => void>(),
    onFeedbackFinished: vi.fn(),
    onIncorrect: vi.fn(),
    onPromptFinished: vi.fn(),
  };
}

function audio() {
  return new GameAudioController(
    () => new ImmediateAudio() as unknown as HTMLAudioElement,
  );
}

function stubObjectUrls(revokeObjectURL: (value: string) => void) {
  const BrowserUrl = URL;
  class TestUrl extends BrowserUrl {
    static createObjectURL(blob: Blob) {
      return `blob:${blob.type}`;
    }

    static revokeObjectURL(value: string) {
      revokeObjectURL(value);
    }
  }
  vi.stubGlobal("URL", TestUrl);
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("activity renderers", () => {
  it("runs LISTEN wrong, retry, and multi-target completion with named buttons", async () => {
    const callbacks = controls();
    const dynamic: ListenDynamic = {
      ...common,
      fuzzyElements: [element("wrong", "Silver leaf", [])],
      id: "listen",
      random: false,
      selectableElements: [
        element("first", "Amber kite", []),
        element("second", "Blue drum", []),
      ],
      type: "LISTEN",
    };
    const sound = audio();
    const view = render(
      <ListenActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        generationId={1}
        phase="prompt"
      />,
    );
    await waitFor(() =>
      expect(callbacks.onPromptFinished).toHaveBeenCalledOnce(),
    );
    view.rerender(
      <ListenActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        generationId={1}
        phase="accepting-input"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Silver leaf" }));
    expect(callbacks.onIncorrect).toHaveBeenCalledOnce();

    view.rerender(
      <ListenActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        feedbackOutcome="incorrect"
        generationId={1}
        phase="feedback"
      />,
    );
    await waitFor(() =>
      expect(callbacks.onFeedbackFinished).toHaveBeenCalledOnce(),
    );
    view.rerender(
      <ListenActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        generationId={1}
        phase="accepting-input"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Amber kite" }));
    expect(callbacks.onCorrect).toHaveBeenCalledOnce();

    view.rerender(
      <ListenActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        feedbackOutcome="continue"
        generationId={1}
        phase="feedback"
      />,
    );
    await waitFor(() =>
      expect(callbacks.onFeedbackFinished).toHaveBeenCalledTimes(2),
    );
    view.rerender(
      <ListenActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        generationId={1}
        phase="accepting-input"
      />,
    );
    expect(screen.getByText("Question 2 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Blue drum" }));
    expect(callbacks.onComplete).toHaveBeenCalledOnce();
  });

  it("supports free EXPLORE hotspots and visible progress", async () => {
    const callbacks = controls();
    const dynamic: ExploreDynamic = {
      ...common,
      backgroundHeight: 6,
      backgroundImage: "background.png",
      backgroundWidth: 8,
      elements: [element("star", "Bright star"), element("moon", "Round moon")],
      id: "explore",
      listen: false,
      type: "EXPLORE",
    };
    const sound = audio();
    const view = render(
      <ExploreActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        generationId={1}
        phase="prompt"
      />,
    );
    await waitFor(() =>
      expect(callbacks.onPromptFinished).toHaveBeenCalledOnce(),
    );
    view.rerender(
      <ExploreActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        generationId={1}
        phase="accepting-input"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Bright star" }));
    expect(callbacks.onCorrect).toHaveBeenCalledOnce();
    view.rerender(
      <ExploreActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        feedbackOutcome="continue"
        generationId={1}
        phase="feedback"
      />,
    );
    await waitFor(() =>
      expect(callbacks.onFeedbackFinished).toHaveBeenCalledOnce(),
    );
    view.rerender(
      <ExploreActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={dynamic}
        generationId={1}
        phase="accepting-input"
      />,
    );
    expect(screen.getByText("1 of 2 found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Round moon" }));
    expect(callbacks.onComplete).toHaveBeenCalledOnce();
  });

  it("keeps an overlapping listening EXPLORE target pointer-accessible", () => {
    const callbacks = controls();
    const dynamic: ExploreDynamic = {
      ...common,
      backgroundHeight: 6,
      backgroundImage: "background.png",
      backgroundWidth: 8,
      elements: [element("star", "Bright star"), element("moon", "Round moon")],
      id: "listen-explore",
      listen: true,
      type: "EXPLORE",
    };
    render(
      <ExploreActivity
        {...callbacks}
        assets={assets}
        audio={audio()}
        dynamic={dynamic}
        generationId={1}
        phase="accepting-input"
      />,
    );
    const wrong = screen.getByRole("button", { name: "Round moon" });
    const stage = wrong.parentElement?.parentElement;
    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
      bottom: 60,
      height: 60,
      left: 0,
      right: 80,
      toJSON: () => ({}),
      top: 0,
      width: 80,
      x: 0,
      y: 0,
    });
    fireEvent.click(wrong, { clientX: 10, clientY: 10, detail: 1 });
    expect(callbacks.onCorrect).toHaveBeenCalledWith(true);
    expect(callbacks.onIncorrect).not.toHaveBeenCalled();
  });

  it("renders manual WILDCARD controls and completes automatic waits", async () => {
    const callbacks = controls();
    const manual: WildcardDynamic = {
      ...common,
      automatic: false,
      id: "wildcard",
      nextImage: null,
      position: 0,
      speaker: false,
      type: "WILDCARD",
      waitSeconds: 2,
    };
    const sound = audio();
    const view = render(
      <WildcardActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={manual}
        generationId={1}
        phase="accepting-input"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(callbacks.onComplete).toHaveBeenCalledOnce();

    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    view.rerender(
      <WildcardActivity
        {...callbacks}
        assets={assets}
        audio={sound}
        dynamic={{ ...manual, automatic: true, waitSeconds: 2 }}
        generationId={2}
        phase="accepting-input"
      />,
    );
    act(() => vi.advanceTimersByTime(1_000));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(5_000));
    expect(callbacks.onComplete).toHaveBeenCalledOnce();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(1_000));
    expect(callbacks.onComplete).toHaveBeenCalledTimes(2);
  });

  it("offers a manual skip for reduced-motion automatic waits", async () => {
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: vi.fn(),
      matches: true,
      removeEventListener: vi.fn(),
    }));
    const callbacks = controls();
    const dynamic: WildcardDynamic = {
      ...common,
      automatic: true,
      id: "reduced-wildcard",
      nextImage: null,
      position: 0,
      speaker: false,
      type: "WILDCARD",
      waitSeconds: 30,
    };
    render(
      <WildcardActivity
        {...callbacks}
        assets={assets}
        audio={audio()}
        dynamic={dynamic}
        generationId={1}
        phase="accepting-input"
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Skip wait" }));
    expect(callbacks.onComplete).toHaveBeenCalledOnce();
  });

  it("announces textual progress and feedback", () => {
    const state = {
      completedDynamicIds: [],
      errors: { listen: 1 },
      generationId: 1,
      index: 0,
      outcome: "incorrect",
      package: { book: false, dynamics: [], id: "game", name: "Game" },
      promptNext: false,
      requestId: 1,
      status: "feedback",
    } as RunnerState;
    render(<GameStatus state={state} />);
    expect(screen.getByRole("status").textContent).toContain("Not quite");
  });
});

describe("GameRunner", () => {
  it("keeps disabled playback inert", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <GameRunner
        activityLabel="Activity"
        enabled={false}
        expiresAt={Date.now() + 60_000}
        gameAlias="game-a"
        learnerAlias="learner-a"
        mediaAlias="media-a"
        returnHref="/video"
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("not enabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches on Play, preflights, and starts the first renderer", async () => {
    const zip = await createFictionalGameZip();
    const fetchMock = vi.fn(async () => new Response(zip, { status: 200 }));
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Audio", ImmediateAudio);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close: vi.fn(), height: 6, width: 8 })),
    );
    stubObjectUrls(revokeObjectURL);
    const view = render(
      <GameRunner
        activityLabel="Activity"
        enabled
        expiresAt={Date.now() + 60_000}
        gameAlias="game-a"
        learnerAlias="learner-a"
        mediaAlias="media-a"
        returnHref="/video"
      />,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Play activity" }));
    await screen.findByRole("heading", { name: "Listen and choose" });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Prompt ready"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/learn/learner-a/media/media-a/games/game-a/package",
      expect.objectContaining({ method: "POST" }),
    );
    view.unmount();
    await act(async () => undefined);
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it("shows a safe retry after delivery failure", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Audio", ImmediateAudio);
    render(
      <GameRunner
        activityLabel="Activity"
        enabled
        expiresAt={Date.now() + 60_000}
        gameAlias="game-a"
        learnerAlias="learner-a"
        mediaAlias="media-a"
        returnHref="/video"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play activity" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "temporarily unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "temporarily unavailable",
    );
  });

  it("preserves the mounted activity while resuming blocked audio", async () => {
    const zip = await createFictionalGameZip();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(zip, { status: 200 })),
    );
    vi.stubGlobal("Audio", BlockOnceAudio);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close: vi.fn(), height: 6, width: 8 })),
    );
    stubObjectUrls(vi.fn());
    render(
      <GameRunner
        activityLabel="Activity"
        enabled
        expiresAt={Date.now() + 60_000}
        gameAlias="game-a"
        learnerAlias="learner-a"
        mediaAlias="media-a"
        returnHref="/video"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play activity" }));
    const resume = await screen.findByRole("button", { name: "Resume audio" });
    expect(
      screen.getByRole("heading", { name: "Listen and choose" }),
    ).toBeTruthy();
    fireEvent.click(resume);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Prompt ready"),
    );
  });

  it("releases package URLs on cross-tab logout", async () => {
    const zip = await createFictionalGameZip();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(zip, { status: 200 })),
    );
    vi.stubGlobal("Audio", ImmediateAudio);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close: vi.fn(), height: 6, width: 8 })),
    );
    stubObjectUrls(revokeObjectURL);
    render(
      <GameRunner
        activityLabel="Activity"
        enabled
        expiresAt={Date.now() + 60_000}
        gameAlias="game-a"
        learnerAlias="learner-a"
        mediaAlias="media-a"
        returnHref="/video"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play activity" }));
    await screen.findByRole("heading", { name: "Listen and choose" });
    window.dispatchEvent(
      new StorageEvent("storage", { key: "merriloop-logout" }),
    );
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalled());
  });

  it("confirms an in-progress exit and releases package URLs", async () => {
    const zip = await createFictionalGameZip();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(zip, { status: 200 })),
    );
    vi.stubGlobal("Audio", ImmediateAudio);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close: vi.fn(), height: 6, width: 8 })),
    );
    stubObjectUrls(revokeObjectURL);
    render(
      <GameRunner
        activityLabel="Activity"
        enabled
        expiresAt={Date.now() + 60_000}
        gameAlias="game-a"
        learnerAlias="learner-a"
        mediaAlias="media-a"
        returnHref="/video"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play activity" }));
    await screen.findByRole("heading", { name: "Listen and choose" });
    fireEvent.click(screen.getByRole("button", { name: "Exit activity" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it("releases package URLs at absolute session expiry", async () => {
    const zip = await createFictionalGameZip();
    const revokeObjectURL = vi.fn();
    let expire: (() => void) | undefined;
    const browserSetTimeout = window.setTimeout.bind(window);
    vi.spyOn(window, "setTimeout").mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
      ...arguments_: unknown[]
    ) => {
      if ((timeout ?? 0) > 10_000) {
        expire = handler as () => void;
        return 1;
      }
      return browserSetTimeout(handler, timeout, ...arguments_);
    }) as typeof window.setTimeout);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(zip, { status: 200 })),
    );
    vi.stubGlobal("Audio", ImmediateAudio);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close: vi.fn(), height: 6, width: 8 })),
    );
    stubObjectUrls(revokeObjectURL);
    render(
      <GameRunner
        activityLabel="Activity"
        enabled
        expiresAt={Date.now() + 60_000}
        gameAlias="game-a"
        learnerAlias="learner-a"
        mediaAlias="media-a"
        returnHref="/video"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play activity" }));
    await screen.findByRole("heading", { name: "Listen and choose" });
    act(() => expire?.());
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it("completes the mixed package locally and releases package URLs", async () => {
    const zip = await createFictionalGameZip();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(zip, { status: 200 })),
    );
    vi.stubGlobal("Audio", ImmediateAudio);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close: vi.fn(), height: 6, width: 8 })),
    );
    stubObjectUrls(revokeObjectURL);
    render(
      <GameRunner
        activityLabel="Activity"
        enabled
        expiresAt={Date.now() + 60_000}
        gameAlias="game-a"
        learnerAlias="learner-a"
        mediaAlias="media-a"
        returnHref="/video"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play activity" }));
    for (const label of [
      "Amber kite",
      "Blue drum",
      "Coral boat",
      "Daisy bell",
    ]) {
      const choice = await screen.findByRole("button", { name: label });
      await waitFor(() =>
        expect((choice as HTMLButtonElement).disabled).toBe(false),
      );
      fireEvent.click(choice);
    }
    const target = await screen.findByRole("button", { name: "Green comet" });
    await waitFor(() =>
      expect((target as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(target);
    const hotspot = await screen.findByRole("button", { name: "Bright star" });
    await waitFor(() =>
      expect((hotspot as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(hotspot);
    const continueButton = await screen.findByRole("button", {
      name: "Continue",
    });
    fireEvent.click(continueButton);
    expect(
      await screen.findByRole("heading", { name: "Play complete" }),
    ).toBeTruthy();
    expect(screen.getByText(/not sent to MyLocker/)).toBeTruthy();
    expect(revokeObjectURL).toHaveBeenCalled();
  });
});
