"use client";

/* eslint-disable @next/next/no-img-element -- validated Blob URLs cannot use the Next image optimizer. */

import { useEffect, useRef, useState } from "react";

import type { ListenDynamic } from "@/lib/games/package/types";
import { shuffle, type RandomSource } from "@/lib/games/runtime/shuffle";

import { assetUrls, type ActivityProps } from "./activity-types";
import { GameAudioError } from "./game-audio";

type ListenActivityProps = ActivityProps &
  Readonly<{ dynamic: ListenDynamic; random?: RandomSource }>;

export function ListenActivity({
  assets,
  audio,
  dynamic,
  feedbackOutcome,
  generationId,
  onAudioFailed,
  onComplete,
  onCorrect,
  onFeedbackFinished,
  onIncorrect,
  onPromptFinished,
  phase,
  random,
}: ListenActivityProps) {
  const [targets] = useState(() =>
    dynamic.random
      ? shuffle(dynamic.selectableElements, random)
      : [...dynamic.selectableElements],
  );
  const [choices] = useState(() => {
    const values = [...dynamic.selectableElements, ...dynamic.fuzzyElements];
    return dynamic.random ? shuffle(values, random) : values;
  });
  const [targetIndex, setTargetIndex] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const feedbackStarted = useRef(false);
  const target = targets[targetIndex]!;

  useEffect(() => {
    if (phase !== "prompt") return;
    let active = true;
    void audio
      .playPrompt(
        assetUrls(assets, dynamic.initialSound),
        assetUrls(assets, target.initialSound),
      )
      .then(() => active && onPromptFinished())
      .catch((error: unknown) => {
        if (
          active &&
          !(error instanceof GameAudioError && error.code === "cancelled")
        ) {
          onAudioFailed();
        }
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
    target.initialSound,
  ]);

  useEffect(() => {
    if (phase !== "feedback") {
      feedbackStarted.current = false;
      return;
    }
    if (!feedbackOutcome || feedbackStarted.current) return;
    feedbackStarted.current = true;
    const correct = feedbackOutcome !== "incorrect";
    const final = feedbackOutcome === "complete";
    const paths = correct
      ? [
          ...target.okSound,
          ...dynamic.okSound,
          ...(final ? dynamic.finalSound : []),
        ]
      : [...target.errorSound, ...dynamic.errorSound];
    let active = true;
    void audio
      .play(assetUrls(assets, paths))
      .then(() => {
        if (!active) return;
        if (feedbackOutcome === "continue")
          setTargetIndex((value) => value + 1);
        onFeedbackFinished();
      })
      .catch((error: unknown) => {
        if (
          active &&
          !(error instanceof GameAudioError && error.code === "cancelled")
        ) {
          onAudioFailed();
        }
      });
    return () => {
      active = false;
      audio.cancel();
    };
  }, [
    assets,
    audio,
    dynamic.errorSound,
    dynamic.finalSound,
    dynamic.okSound,
    feedbackOutcome,
    generationId,
    onAudioFailed,
    onFeedbackFinished,
    phase,
    target.errorSound,
    target.okSound,
  ]);

  useEffect(() => {
    if (phase === "accepting-input") firstChoice.current?.focus();
  }, [phase, targetIndex]);

  return (
    <section aria-labelledby="listen-heading" className="grid gap-5">
      <div>
        <h2
          className="m-0 font-['Fraunces_Variable',serif] text-2xl"
          id="listen-heading"
        >
          Listen and choose
        </h2>
        <p className="m-0 mt-1 text-sm">
          Question {targetIndex + 1} of {targets.length}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {choices.map((choice, index) => (
          <button
            aria-label={choice.label}
            className="min-h-24 rounded-2xl border-2 border-[#16324f] bg-white p-3 shadow-[3px_3px_0_#16324f] disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
            disabled={phase !== "accepting-input" || replaying}
            key={choice.id}
            onClick={() => {
              if (choice.id !== target.id) {
                onIncorrect();
                return;
              }
              if (targetIndex + 1 === targets.length) onComplete();
              else onCorrect(true);
            }}
            ref={index === 0 ? firstChoice : undefined}
            type="button"
          >
            <img
              alt=""
              className="mx-auto h-24 w-full object-contain sm:h-32"
              src={assets.getUrl(choice.image)}
            />
          </button>
        ))}
      </div>
      <button
        className="game-secondary-action justify-self-start"
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
        Replay prompt
      </button>
    </section>
  );
}
