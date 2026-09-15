import { NextResponse } from "next/server";

import { getServerConfig } from "@/lib/config/server";
import {
  fetchGamePackage,
  GamePackageError,
  type GamePackageErrorCategory,
} from "@/lib/mylocker/game-client";
import { GameRateLimiter } from "@/lib/security/game-rate-limit";
import { hasValidMutationOrigin } from "@/lib/security/origin";
import { selectVideoGame } from "@/lib/session/selectors";
import { getSessionStore } from "@/lib/session/server";
import { SESSION_COOKIE_NAME } from "@/lib/session/store";

export const runtime = "nodejs";

declare global {
  var __okapiLearnGameLimiter: GameRateLimiter | undefined;
}

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;

function errorResponse(error: GamePackageErrorCategory, status: number) {
  return NextResponse.json({ error }, { headers: PRIVATE_HEADERS, status });
}

function statusFor(error: GamePackageErrorCategory): number {
  if (error === "not_found") return 404;
  if (error === "try_later") return 429;
  if (error === "unsupported") return 422;
  return 503;
}

function sessionCookie(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
}

async function hasEmptyBody(request: Request): Promise<boolean> {
  if (
    request.headers.has("content-type") ||
    request.headers.has("transfer-encoding")
  ) {
    return false;
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && contentLength !== "0") return false;
  if (!request.body) return true;
  const reader = request.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value?.byteLength) {
        await reader.cancel();
        return false;
      }
      if (done) return true;
    }
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/learn/[learnerAlias]/media/[mediaAlias]/games/[gameAlias]/package">,
) {
  if (!hasValidMutationOrigin(request)) {
    return errorResponse("not_available", 403);
  }
  if (!(await hasEmptyBody(request))) {
    return errorResponse("unsupported", 400);
  }

  const cookieValue = sessionCookie(request);
  let session;
  try {
    session = await getSessionStore().read(cookieValue);
  } catch {
    return errorResponse("service_unavailable", 503);
  }
  if (!cookieValue || !session) return errorResponse("not_found", 404);

  const config = getServerConfig();
  if (!config.gamePlaybackEnabled) {
    return errorResponse("not_available", 503);
  }

  const { learnerAlias, mediaAlias, gameAlias } = await context.params;
  const selection = selectVideoGame(
    session,
    learnerAlias,
    mediaAlias,
    gameAlias,
  );
  if (!selection) return errorResponse("not_found", 404);

  globalThis.__okapiLearnGameLimiter ??= new GameRateLimiter({
    secret: config.sessionSecret,
  });
  const release = globalThis.__okapiLearnGameLimiter.acquire(cookieValue);
  if (!release) return errorResponse("try_later", 429);

  try {
    const bytes = await fetchGamePackage(selection.game.id);
    return new Response(bytes.buffer, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": "application/zip",
      },
      status: 200,
    });
  } catch (error) {
    const category =
      error instanceof GamePackageError
        ? error.category
        : "service_unavailable";
    return errorResponse(category, statusFor(category));
  } finally {
    release();
  }
}
