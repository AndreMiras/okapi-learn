import Link from "next/link";
import { notFound } from "next/navigation";

import { ProtectedTools } from "@/components/protected-tools";
import { StandaloneGameMap } from "@/components/standalone-game-map";
import { getServerConfig } from "@/lib/config/server";
import { requireSession } from "@/lib/session/dal";
import { projectGameMapForLearner } from "@/lib/session/selectors";

export default async function GameMapPage({
  params,
}: PageProps<"/learn/[learnerAlias]/games">) {
  const { learnerAlias } = await params;
  const map = projectGameMapForLearner(await requireSession(), learnerAlias);
  if (!map || !map.sections.some(({ positions }) => positions.length)) {
    notFound();
  }

  return (
    <div className="grid w-full gap-[clamp(2rem,6vw,5rem)]">
      <div>
        <Link
          className="mb-5 inline-flex min-h-11 items-center font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
          href={`/learn/${learnerAlias}`}
        >
          ← Back to catalog
        </Link>
        <StandaloneGameMap
          enabled={getServerConfig().gamePlaybackEnabled}
          learnerAlias={learnerAlias}
          map={map}
        />
      </div>
      <ProtectedTools />
    </div>
  );
}
