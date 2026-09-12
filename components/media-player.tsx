"use client";

import { useEffect, useRef, useState } from "react";

import { subscribeToLogout } from "@/lib/session/client-events";

type MediaPlayerProps = Readonly<{
  expiresAt: number;
  kind: "audio" | "video";
  source: string;
  title: string;
}>;

export function MediaPlayer({
  expiresAt,
  kind,
  source,
  title,
}: MediaPlayerProps) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = mediaRef.current;
    if (element) element.src = source;
    const clear = () => {
      if (!element) return;
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
    const timeout = window.setTimeout(
      () => {
        clear();
        window.location.replace("/login?reason=expired");
      },
      Math.max(0, expiresAt - Date.now()),
    );
    const unsubscribe = subscribeToLogout(clear);
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
      clear();
    };
  }, [attempt, expiresAt, source]);

  const common = {
    "aria-label": `${kind === "audio" ? "Audio" : "Video"} player for ${title}`,
    controls: true,
    controlsList: "nodownload noremoteplayback",
    onCanPlay: () => setFailed(false),
    onError: () => setFailed(true),
    preload: "none" as const,
    ref: (element: HTMLMediaElement | null) => {
      mediaRef.current = element;
    },
    src: source,
  };

  return (
    <div className="mt-8 grid max-w-3xl gap-4">
      {kind === "video" ? (
        <video
          key={attempt}
          {...common}
          className="aspect-video w-full rounded-2xl bg-[#16324f]"
          disablePictureInPicture
          playsInline
        >
          Your browser does not support video playback.
        </video>
      ) : (
        <audio key={attempt} {...common} className="w-full">
          Your browser does not support audio playback.
        </audio>
      )}
      <p className="m-0 text-sm">
        No captions or transcript were supplied for this item.
      </p>
      {failed && (
        <div className="grid justify-items-start gap-2" role="alert">
          <p className="m-0">
            Playback could not continue. The item may have expired or may not be
            supported by this browser.
          </p>
          <button
            className="min-h-11 rounded-xl border-2 border-[#16324f] bg-[#fffdf7] px-4 py-2 font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
            type="button"
          >
            Try playback again
          </button>
        </div>
      )}
    </div>
  );
}
