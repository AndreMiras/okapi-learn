"use client";

/* eslint-disable @next/next/no-img-element -- validated Blob URLs cannot use the Next image optimizer. */

import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { PaintDynamic } from "@/lib/games/package/types";
import { shuffle, type RandomSource } from "@/lib/games/runtime/shuffle";
import { englishMessages } from "@/lib/i18n/messages/en";

import { assetUrls, type ActivityProps } from "./activity-types";
import { GameAudioError } from "./game-audio";

type PaintActivityProps = ActivityProps &
  Readonly<{ dynamic: PaintDynamic; random?: RandomSource }>;

function stepFeedbackSounds(
  step: "colour" | "target",
  dynamicSounds: readonly string[],
  targetSounds: readonly string[],
): readonly string[] {
  // Each tap receives one level's feedback. The other level is a fallback,
  // not another song to queue for the same selection.
  const preferred = step === "colour" ? dynamicSounds : targetSounds;
  return preferred.length
    ? preferred
    : step === "colour"
      ? targetSounds
      : dynamicSounds;
}

export function PaintActivity({
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
}: PaintActivityProps) {
  const [targets] = useState(() => shuffle(dynamic.elements, random));
  const [targetIndex, setTargetIndex] = useState(0);
  const [step, setStep] = useState<"colour" | "target">("colour");
  const [solved, setSolved] = useState<ReadonlySet<string>>(() => new Set());
  const [replaying, setReplaying] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const feedbackStarted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const target = targets[targetIndex]!;
  const labels = englishMessages.games.paint;

  useEffect(() => {
    if (phase !== "prompt") return;
    let active = true;
    void audio
      .playPrompt(
        targetIndex === 0 ? assetUrls(assets, dynamic.initialSound) : [],
        assetUrls(assets, target.initialSound),
      )
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
    target,
    targetIndex,
  ]);

  useEffect(() => {
    if (phase === "accepting-input") heading.current?.focus();
  }, [phase, step]);

  useEffect(() => {
    if (phase !== "feedback") {
      feedbackStarted.current = false;
      return;
    }
    if (!feedbackOutcome || feedbackStarted.current) return;
    feedbackStarted.current = true;
    const correct = feedbackOutcome !== "incorrect";
    const finishedTarget = correct && step === "target";
    const successSounds = stepFeedbackSounds(
      step,
      dynamic.okSound,
      target.okSound,
    );
    const paths = correct
      ? [
          ...successSounds,
          ...(feedbackOutcome === "complete"
            ? dynamic.finalSound.filter((path) => !successSounds.includes(path))
            : []),
        ]
      : stepFeedbackSounds(step, dynamic.errorSound, target.errorSound);
    let active = true;
    void audio
      .play(assetUrls(assets, paths))
      .then(() => {
        if (!active) return;
        if (correct) {
          if (finishedTarget) {
            setSolved((current) => new Set(current).add(target.id));
            if (feedbackOutcome !== "complete")
              setTargetIndex((index) => index + 1);
            setStep("colour");
            setFeedback(
              feedbackOutcome === "complete" ? labels.complete : labels.next,
            );
          } else {
            setStep("target");
            setFeedback(labels.correctColour);
          }
        } else {
          setFeedback(labels.incorrect);
        }
        onFeedbackFinished();
      })
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
    dynamic.errorSound,
    dynamic.finalSound,
    dynamic.okSound,
    feedbackOutcome,
    generationId,
    labels,
    onAudioFailed,
    onFeedbackFinished,
    phase,
    step,
    target,
  ]);

  const choices =
    step === "colour"
      ? dynamic.colours
      : dynamic.elements.filter(({ id }) => !solved.has(id));

  return (
    <section aria-labelledby="paint-heading" className="grid gap-4">
      <div>
        <h2
          className="m-0 font-['Fraunces_Variable',serif] text-2xl"
          id="paint-heading"
          ref={heading}
          tabIndex={-1}
        >
          {labels.heading}
        </h2>
        <p className="m-0 mt-1">
          {step === "colour" ? labels.chooseColour : labels.chooseTarget}
        </p>
        <p className="m-0 text-sm">
          {solved.size} of {targets.length} complete
        </p>
        <p aria-live="polite" className="m-0 text-sm" role="status">
          {feedback}
        </p>
        <p className="m-0 text-sm">{labels.visualNotice}</p>
      </div>
      <div
        className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl bg-[#16324f]"
        style={
          {
            "--game-aspect": `${dynamic.backgroundWidth} / ${dynamic.backgroundHeight}`,
          } as CSSProperties
        }
        onClick={() => {
          if (phase === "accepting-input" && !replaying) onIncorrect();
        }}
      >
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          src={assets.getUrl(dynamic.backgroundImage)}
        />
        {dynamic.elements
          .filter(({ id }) => solved.has(id))
          .map((element) => (
            <img
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              key={element.id}
              src={assets.getUrl(element.image)}
            />
          ))}
        {choices.flatMap((choice, index) =>
          choice.frames.map((frame, frameIndex) => (
            <button
              aria-label={`${step === "colour" ? labels.colour : labels.target} ${index + 1}${choice.frames.length > 1 ? `, ${labels.area} ${frameIndex + 1}` : ""}`}
              className="game-hotspot absolute min-h-11 min-w-11 border-2 border-white/70 bg-transparent focus-visible:z-10 focus-visible:border-white focus-visible:outline-3 focus-visible:outline-[#dd796f]"
              disabled={phase !== "accepting-input" || replaying}
              key={`${choice.id}-${frameIndex}`}
              onClick={(event) => {
                event.stopPropagation();
                if (
                  step === "colour"
                    ? choice.id.toLowerCase() !== target.colourId.toLowerCase()
                    : choice.id !== target.id
                ) {
                  onIncorrect();
                } else if (step === "colour") {
                  onCorrect(false);
                } else if (targetIndex + 1 === targets.length) {
                  onComplete();
                } else {
                  onCorrect(true);
                }
              }}
              style={
                {
                  "--game-hotspot-height": `${((frame.y2 - frame.y1) / dynamic.backgroundHeight) * 100}%`,
                  "--game-hotspot-left": `${(frame.x1 / dynamic.backgroundWidth) * 100}%`,
                  "--game-hotspot-top": `${(frame.y1 / dynamic.backgroundHeight) * 100}%`,
                  "--game-hotspot-width": `${((frame.x2 - frame.x1) / dynamic.backgroundWidth) * 100}%`,
                } as CSSProperties
              }
              type="button"
            />
          )),
        )}
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
        {labels.replay}
      </button>
    </section>
  );
}
