"use client";

/* eslint-disable @next/next/no-img-element -- validated Blob URLs cannot use the Next image optimizer. */

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
} from "react";

import type { DynamicElement, ExploreDynamic } from "@/lib/games/package/types";
import { shuffle, type RandomSource } from "@/lib/games/runtime/shuffle";

import { assetUrls, type ActivityProps } from "./activity-types";
import { GameAudioError } from "./game-audio";

type ExploreActivityProps = ActivityProps &
  Readonly<{ dynamic: ExploreDynamic; random?: RandomSource }>;

export function ExploreActivity(props: ExploreActivityProps) {
  const {
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
  } = props;
  const [order] = useState(() =>
    dynamic.listen ? shuffle(dynamic.elements, random) : [...dynamic.elements],
  );
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const feedbackStarted = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const nextHotspot = useRef<HTMLButtonElement>(null);
  const target = order.find((element) => !touched.has(element.id));

  const selectForActivation = (
    element: DynamicElement,
    event: ReactMouseEvent<HTMLButtonElement>,
  ): DynamicElement => {
    if (
      !dynamic.listen ||
      element.id === target?.id ||
      event.detail === 0 ||
      !target
    ) {
      return element;
    }
    const bounds = stage.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return element;
    const x =
      ((event.clientX - bounds.left) / bounds.width) * dynamic.backgroundWidth;
    const y =
      ((event.clientY - bounds.top) / bounds.height) * dynamic.backgroundHeight;
    return target.frames.some(
      (frame) =>
        x >= frame.x1 && x <= frame.x2 && y >= frame.y1 && y <= frame.y2,
    )
      ? target
      : element;
  };

  useEffect(() => {
    if (phase !== "prompt") return;
    let active = true;
    void audio
      .playPrompt(
        assetUrls(assets, dynamic.initialSound),
        dynamic.listen && target ? assetUrls(assets, target.initialSound) : [],
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
    dynamic.listen,
    generationId,
    onAudioFailed,
    onPromptFinished,
    phase,
    target,
  ]);

  useEffect(() => {
    if (phase === "accepting-input") nextHotspot.current?.focus();
  }, [phase, touched]);

  useEffect(() => {
    if (phase !== "feedback") {
      feedbackStarted.current = false;
      return;
    }
    if (!feedbackOutcome || feedbackStarted.current) return;
    feedbackStarted.current = true;
    const selected =
      dynamic.elements.find(({ id }) => id === pending) ?? target;
    const correct = feedbackOutcome !== "incorrect";
    const paths =
      correct && selected
        ? [
            ...selected.okSound,
            ...dynamic.okSound,
            ...(feedbackOutcome === "complete" ? dynamic.finalSound : []),
          ]
        : selected
          ? [...selected.errorSound, ...dynamic.errorSound]
          : dynamic.errorSound;
    let active = true;
    void audio
      .play(assetUrls(assets, paths))
      .then(() => {
        if (!active) return;
        if (correct && selected)
          setTouched((current) => new Set(current).add(selected.id));
        setPending(null);
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
    dynamic.elements,
    dynamic.errorSound,
    dynamic.finalSound,
    dynamic.okSound,
    feedbackOutcome,
    generationId,
    onAudioFailed,
    onFeedbackFinished,
    pending,
    phase,
    target,
  ]);

  return (
    <section aria-labelledby="explore-heading" className="grid gap-4">
      <div>
        <h2
          className="m-0 font-['Fraunces_Variable',serif] text-2xl"
          id="explore-heading"
        >
          Explore the picture
        </h2>
        <p aria-live="polite" className="m-0 mt-1 text-sm">
          {touched.size} of {dynamic.elements.length} found
        </p>
      </div>
      <div
        className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl bg-[#16324f]"
        style={
          {
            "--game-aspect": `${dynamic.backgroundWidth} / ${dynamic.backgroundHeight}`,
          } as CSSProperties
        }
        ref={stage}
      >
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          src={assets.getUrl(dynamic.backgroundImage)}
        />
        {order.map((element) => (
          <div key={element.id}>
            {touched.has(element.id) && (
              <img
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                src={assets.getUrl(element.image)}
              />
            )}
            {!touched.has(element.id) &&
              element.frames.map((frame, frameIndex) => (
                <button
                  aria-label={
                    element.frames.length === 1
                      ? element.label
                      : `${element.label}, area ${frameIndex + 1}`
                  }
                  className="game-hotspot absolute min-h-11 min-w-11 border-2 border-transparent bg-transparent focus-visible:border-white focus-visible:outline-3 focus-visible:outline-[#dd796f]"
                  disabled={phase !== "accepting-input" || replaying}
                  key={`${element.id}-${frameIndex}`}
                  onClick={(event) => {
                    const selected = selectForActivation(element, event);
                    setPending(selected.id);
                    if (dynamic.listen && selected.id !== target?.id)
                      onIncorrect();
                    else if (touched.size + 1 === dynamic.elements.length)
                      onComplete();
                    else onCorrect(dynamic.listen);
                  }}
                  style={
                    {
                      "--game-hotspot-height": `${((frame.y2 - frame.y1) / dynamic.backgroundHeight) * 100}%`,
                      "--game-hotspot-left": `${(frame.x1 / dynamic.backgroundWidth) * 100}%`,
                      "--game-hotspot-top": `${(frame.y1 / dynamic.backgroundHeight) * 100}%`,
                      "--game-hotspot-width": `${((frame.x2 - frame.x1) / dynamic.backgroundWidth) * 100}%`,
                    } as CSSProperties
                  }
                  ref={
                    element.id === target?.id && frameIndex === 0
                      ? nextHotspot
                      : undefined
                  }
                  type="button"
                />
              ))}
          </div>
        ))}
      </div>
      {dynamic.listen && (
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
      )}
    </section>
  );
}
