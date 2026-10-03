import { NextResponse } from "next/server";

import { getServerConfig } from "@/lib/config/server";
import { fetchGameArtwork } from "@/lib/mylocker/artwork-client";
import { GameRateLimiter } from "@/lib/security/game-rate-limit";
import { readRequestSession } from "@/lib/session/request";
import { selectMapSection } from "@/lib/session/selectors";

export const runtime = "nodejs";

declare global {
  var __okapiLearnArtworkLimiter: GameRateLimiter | undefined;
}

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;

function errorResponse(
  error: "not_available" | "not_found" | "try_later",
  status: number,
) {
  return NextResponse.json({ error }, { headers: PRIVATE_HEADERS, status });
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/learn/[learnerAlias]/game-map/sections/[sectionAlias]/artwork">,
) {
  let requestSession;
  try {
    requestSession = await readRequestSession(request);
  } catch {
    return errorResponse("not_available", 503);
  }
  if (!requestSession) return errorResponse("not_found", 404);

  const config = getServerConfig();
  if (!config.gamePlaybackEnabled) {
    return errorResponse("not_available", 503);
  }
  const { learnerAlias, sectionAlias } = await context.params;
  const selection = selectMapSection(
    requestSession.session,
    learnerAlias,
    sectionAlias,
  );
  if (!selection) return errorResponse("not_found", 404);

  globalThis.__okapiLearnArtworkLimiter ??= new GameRateLimiter({
    maximumConcurrent: 8,
    maximumStarts: 128,
    secret: config.sessionSecret,
  });
  const release = globalThis.__okapiLearnArtworkLimiter.acquire(
    requestSession.cookieValue,
  );
  if (!release) return errorResponse("try_later", 429);

  try {
    const bytes = await fetchGameArtwork(selection.section.frontImageUrl);
    return new Response(bytes.buffer, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": "image/png",
      },
      status: 200,
    });
  } catch {
    return errorResponse("not_available", 503);
  } finally {
    release();
  }
}
