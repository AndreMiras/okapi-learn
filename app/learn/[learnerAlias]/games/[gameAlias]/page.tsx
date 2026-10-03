import Link from "next/link";
import { notFound } from "next/navigation";

import { StandaloneGameRunner } from "@/components/standalone-game-runner";
import { getServerConfig } from "@/lib/config/server";
import { requireSession } from "@/lib/session/dal";
import { selectStandaloneGame } from "@/lib/session/selectors";

export default async function StandaloneGamePage({
  params,
}: PageProps<"/learn/[learnerAlias]/games/[gameAlias]">) {
  const { learnerAlias, gameAlias } = await params;
  const session = await requireSession();
  const selection = selectStandaloneGame(session, learnerAlias, gameAlias);
  if (!selection) notFound();

  const ordinal =
    selection.gameMap.sections
      .flatMap(({ positions }) => positions)
      .findIndex(({ game }) => game.alias === gameAlias) + 1;
  if (ordinal < 1) notFound();
  const label = `Game ${ordinal}`;

  return (
    <section className="relative overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-[clamp(1.25rem,4vw,3rem)] shadow-[0_18px_50px_#16324f18]">
      <Link
        className="mb-5 inline-flex min-h-11 items-center font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
        href={`/learn/${learnerAlias}/games`}
      >
        ← Back to game map
      </Link>
      <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
        {selection.course.name}
      </p>
      <h1 className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.3rem,6vw,4.7rem)] leading-[1.05] tracking-[-0.045em]">
        {label}
      </h1>
      <StandaloneGameRunner
        activityLabel={label}
        enabled={getServerConfig().gamePlaybackEnabled}
        expiresAt={session.expiresAt}
        gameAlias={gameAlias}
        learnerAlias={learnerAlias}
      />
    </section>
  );
}
