import Link from "next/link";
import { notFound } from "next/navigation";

import { GameRunner } from "@/components/games/game-runner";
import { getServerConfig } from "@/lib/config/server";
import { requireSession } from "@/lib/session/dal";
import { selectVideoGame } from "@/lib/session/selectors";

export default async function GamePage({
  params,
}: PageProps<"/learn/[learnerAlias]/media/[mediaAlias]/game/[gameAlias]">) {
  const { learnerAlias, mediaAlias, gameAlias } = await params;
  const session = await requireSession();
  const selection = selectVideoGame(
    session,
    learnerAlias,
    mediaAlias,
    gameAlias,
  );
  if (!selection) notFound();
  const enabled = getServerConfig().gamePlaybackEnabled;
  const label =
    selection.game.slot === 1 ? "Activity" : `Activity ${selection.game.slot}`;

  return (
    <section className="relative overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-[clamp(1.25rem,4vw,3rem)] shadow-[0_18px_50px_#16324f18]">
      <Link
        className="mb-5 inline-flex min-h-11 items-center font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
        href={`/learn/${learnerAlias}/media/${mediaAlias}`}
      >
        ← Back to video
      </Link>
      <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
        {selection.course.name}
      </p>
      <h1 className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.3rem,6vw,4.7rem)] leading-[1.05] tracking-[-0.045em]">
        {label}
      </h1>
      <p className="mt-5 max-w-2xl text-lg">
        A linked activity for <strong>{selection.media.title}</strong>. Package
        content stays in this browser&apos;s memory for the current play only.
      </p>
      <GameRunner
        activityLabel={label}
        enabled={enabled}
        expiresAt={session.expiresAt}
        gameAlias={gameAlias}
        learnerAlias={learnerAlias}
        mediaAlias={mediaAlias}
        returnHref={`/learn/${learnerAlias}/media/${mediaAlias}`}
      />
    </section>
  );
}
