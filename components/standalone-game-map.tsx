"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

import { useLearnerActivityState } from "@/components/learner-activity-state";
import { englishMessages } from "@/lib/i18n/messages/en";
import type { LearnerGameMap } from "@/lib/session/selectors";

type GameStatus = "available" | "completed" | "locked" | "replayable";

export function StandaloneGameMap({
  enabled,
  learnerAlias,
  map,
}: Readonly<{
  enabled: boolean;
  learnerAlias: string;
  map: LearnerGameMap;
}>) {
  const { completedStandaloneGames } = useLearnerActivityState();
  const [failedSections, setFailedSections] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const positions = map.sections.flatMap((section, sectionIndex) =>
    section.positions.map((position, positionIndex) => ({
      ordinal: 0,
      position,
      positionIndex,
      sectionIndex,
    })),
  );
  positions.forEach((entry, index) => {
    entry.ordinal = index + 1;
  });
  const latestFinished = positions.findLastIndex(
    ({ position }) =>
      position.initiallyFinished ||
      completedStandaloneGames.has(position.gameAlias),
  );
  const playableThrough = Math.min(latestFinished + 1, positions.length - 1);
  const allFinished = positions.every(
    ({ position }) =>
      position.initiallyFinished ||
      completedStandaloneGames.has(position.gameAlias),
  );

  const statusFor = (
    position: LearnerGameMap["sections"][number]["positions"][number],
    ordinal: number,
  ): GameStatus => {
    if (
      position.initiallyFinished ||
      completedStandaloneGames.has(position.gameAlias)
    ) {
      return "completed";
    }
    if (ordinal - 1 > playableThrough) return "locked";
    return position.initiallyViewed ? "replayable" : "available";
  };

  if (!enabled) {
    return (
      <section className="game-map-gate" aria-labelledby="game-map-heading">
        <h1 id="game-map-heading">
          {map.title ?? englishMessages.gameMap.title}
        </h1>
        <p>{englishMessages.gameMap.disabled}</p>
      </section>
    );
  }

  return (
    <div className="game-map-shell">
      <header className="game-map-header">
        <p className="game-map-eyebrow">{englishMessages.gameMap.eyebrow}</p>
        <h1 id="game-map-heading">
          {map.title ?? englishMessages.gameMap.title}
        </h1>
        <p>{englishMessages.gameMap.introduction}</p>
        {allFinished && (
          <p className="game-map-complete">
            {englishMessages.gameMap.complete}
          </p>
        )}
      </header>

      <section aria-labelledby="game-map-heading" className="game-map-sections">
        {map.sections.map((section, sectionIndex) => {
          const sectionPositions = positions.filter(
            (entry) => entry.sectionIndex === sectionIndex,
          );
          const aspect = `${section.width} / ${section.height}`;
          const artworkHref = `/api/learn/${learnerAlias}/game-map/sections/${section.alias}/artwork`;
          const imageFailed = failedSections.has(section.alias);
          return (
            <div
              className="game-map-section"
              key={section.alias}
              style={{ "--game-map-aspect": aspect } as CSSProperties}
            >
              <div className="game-map-artwork">
                {!imageFailed && (
                  // This authenticated same-origin image must bypass Next image caching.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`Map section ${sectionIndex + 1}`}
                    loading={sectionIndex === 0 ? "eager" : "lazy"}
                    onError={() =>
                      setFailedSections((current) => {
                        const next = new Set(current);
                        next.add(section.alias);
                        return next;
                      })
                    }
                    src={artworkHref}
                  />
                )}
                {imageFailed && (
                  <p className="game-map-image-fallback" role="status">
                    {englishMessages.gameMap.imageUnavailable}
                  </p>
                )}
              </div>
              <div className="game-map-markers">
                {sectionPositions.map(({ ordinal, position }) => {
                  const status = statusFor(position, ordinal);
                  const label = `Game ${ordinal}, ${status}`;
                  const style = {
                    "--game-map-marker-left": `${(((position.xStart + position.xEnd) / 2 / section.width) * 100).toFixed(4)}%`,
                    "--game-map-marker-top": `${(((position.yStart + position.yEnd) / 2 / section.height) * 100).toFixed(4)}%`,
                  } as CSSProperties;
                  return status === "locked" ? (
                    <span
                      aria-label={label}
                      className="game-map-marker game-map-marker-locked"
                      key={position.gameAlias}
                      role="img"
                      style={style}
                    >
                      <span aria-hidden="true">{ordinal}</span>
                    </span>
                  ) : (
                    <Link
                      aria-label={label}
                      className={`game-map-marker game-map-marker-${status}`}
                      href={`/learn/${learnerAlias}/games/${position.gameAlias}`}
                      key={position.gameAlias}
                      prefetch={false}
                      style={style}
                    >
                      <span aria-hidden="true">{ordinal}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <aside className="game-map-key" aria-labelledby="game-map-key-heading">
        <h2 id="game-map-key-heading">{englishMessages.gameMap.progress}</h2>
        <ol>
          {positions.map(({ ordinal, position }) => {
            const status = statusFor(position, ordinal);
            return (
              <li key={position.gameAlias}>
                <strong>Game {ordinal}</strong>: {status}
              </li>
            );
          })}
        </ol>
        <p>{englishMessages.gameMap.progressNote}</p>
      </aside>
    </div>
  );
}
