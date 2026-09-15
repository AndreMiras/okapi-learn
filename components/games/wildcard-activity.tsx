"use client";

/* eslint-disable @next/next/no-img-element -- validated Blob URLs cannot use the Next image optimizer. */

import { useEffect, useRef, useState } from "react";

import type { WildcardDynamic } from "@/lib/games/package/types";

import { assetUrls, type ActivityProps } from "./activity-types";
import { GameAudioError } from "./game-audio";

type WildcardActivityProps = ActivityProps &
  Readonly<{ dynamic: WildcardDynamic }>;

export function WildcardActivity(props: WildcardActivityProps) {
  const {
    assets,
    audio,
    dynamic,
    generationId,
    onAudioFailed,
    onComplete,
    onFeedbackFinished,
    onPromptFinished,
    phase,
  } = props;
  const [reducedMotion, setReducedMotion] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const feedbackStarted = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (phase !== "prompt") return;
    let active = true;
    void audio
      .playPrompt([], assetUrls(assets, dynamic.initialSound))
      .then(() => active && onPromptFinished())
      .catch((error: unknown) => {
        if (
          active &&
          !(error instanceof GameAudioError && error.code === "cancelled")
        )
          onAudioFailed();
      });
    return () => {
      active = false;
      audio.cancel();
    };
  }, [
    assets,
    audio,
    dynamic.initialSound,
    generationId,
    onAudioFailed,
    onPromptFinished,
    phase,
  ]);

  useEffect(() => {
    if (
      phase !== "accepting-input" ||
      !dynamic.automatic ||
      reducedMotion ||
      replaying ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let remaining = dynamic.waitSeconds * 1_000;
    let started = performance.now();
    let timer: number | undefined;
    const start = () => {
      started = performance.now();
      timer = window.setTimeout(onComplete, remaining);
    };
    if (!document.hidden) start();
    const visibility = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (document.hidden) {
        remaining = Math.max(0, remaining - (performance.now() - started));
        timer = undefined;
      } else start();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    dynamic.automatic,
    dynamic.waitSeconds,
    onComplete,
    phase,
    reducedMotion,
    replaying,
  ]);

  useEffect(() => {
    if (phase !== "feedback") {
      feedbackStarted.current = false;
      return;
    }
    if (feedbackStarted.current) return;
    feedbackStarted.current = true;
    let active = true;
    void audio
      .play(assetUrls(assets, dynamic.finalSound))
      .then(() => active && onFeedbackFinished())
      .catch((error: unknown) => {
        if (
          active &&
          !(error instanceof GameAudioError && error.code === "cancelled")
        )
          onAudioFailed();
      });
    return () => {
      active = false;
      audio.cancel();
    };
  }, [
    assets,
    audio,
    dynamic.finalSound,
    generationId,
    onAudioFailed,
    onFeedbackFinished,
    phase,
  ]);

  return (
    <section
      aria-labelledby="wildcard-heading"
      className="grid justify-items-center gap-5 text-center"
    >
      {dynamic.backgroundImage && (
        <img
          alt=""
          className="max-h-[55vh] w-full rounded-2xl object-contain"
          src={assets.getUrl(dynamic.backgroundImage)}
        />
      )}
      <h2
        className="m-0 font-['Fraunces_Variable',serif] text-3xl"
        id="wildcard-heading"
      >
        {dynamic.name}
      </h2>
      <p className="m-0">Take a moment, then continue when you are ready.</p>
      <div className="flex flex-wrap justify-center gap-3">
        {dynamic.speaker && dynamic.initialSound.length > 0 && (
          <button
            className="game-secondary-action"
            disabled={phase !== "accepting-input" || replaying}
            onClick={() => {
              setReplaying(true);
              void audio.replayCurrentPrompt().then(
                () => setReplaying(false),
                () => {
                  setReplaying(false);
                  onAudioFailed();
                },
              );
            }}
            type="button"
          >
            Replay
          </button>
        )}
        {phase === "accepting-input" &&
          (!dynamic.automatic || reducedMotion) && (
            <button
              className="game-primary-action"
              onClick={onComplete}
              type="button"
            >
              {dynamic.automatic ? "Skip wait" : "Continue"}
            </button>
          )}
      </div>
    </section>
  );
}
