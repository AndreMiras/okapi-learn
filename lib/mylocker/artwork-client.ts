import "server-only";

import { getServerConfig } from "@/lib/config/server";

export const MAX_GAME_ARTWORK_BYTES = 10 * 1024 * 1024;
export const GAME_ARTWORK_TIMEOUT_MS = 10_000;

const ARTWORK_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "image/png",
]);
const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export class GameArtworkError extends Error {
  constructor() {
    super("artwork_unavailable");
    this.name = "GameArtworkError";
  }
}

type GameArtworkClientOptions = Readonly<{
  allowedOrigins: readonly string[];
  maximumBytes?: number;
  production?: boolean;
  timeoutMs?: number;
}>;

function fail(): never {
  throw new GameArtworkError();
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    fail();
  }
}

function authorizedUrl(
  value: string,
  allowedOrigins: ReadonlySet<string>,
  production: boolean,
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail();
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    value.length > 2_048 ||
    url.username ||
    url.password ||
    url.hash ||
    !url.hostname ||
    (production && (url.protocol !== "https:" || Boolean(url.port))) ||
    (!production &&
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && loopback)) ||
    !allowedOrigins.has(url.origin)
  ) {
    fail();
  }
  return url;
}

async function boundedBytes(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const contentLengthText = response.headers.get("content-length");
  let declaredLength: number | null = null;
  if (contentLengthText !== null) {
    if (!/^\d+$/.test(contentLengthText)) {
      await cancelBody(response);
      fail();
    }
    declaredLength = Number(contentLengthText);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength > maximumBytes
    ) {
      await cancelBody(response);
      fail();
    }
  }
  if (!response.body) fail();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > maximumBytes) {
        await reader.cancel();
        fail();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof GameArtworkError) throw error;
    fail();
  }
  if (declaredLength !== null && byteCount !== declaredLength) fail();
  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (
    bytes.byteLength < PNG_SIGNATURE.byteLength ||
    !PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  ) {
    fail();
  }
  return bytes;
}

export function createGameArtworkClient(options: GameArtworkClientOptions) {
  const allowedOrigins = new Set(options.allowedOrigins);
  const maximumBytes = Math.min(
    options.maximumBytes ?? MAX_GAME_ARTWORK_BYTES,
    MAX_GAME_ARTWORK_BYTES,
  );
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const timeoutMs = Math.min(
    options.timeoutMs ?? GAME_ARTWORK_TIMEOUT_MS,
    GAME_ARTWORK_TIMEOUT_MS,
  );

  return Object.freeze({
    async fetchArtwork(urlValue: string): Promise<Uint8Array<ArrayBuffer>> {
      const url = authorizedUrl(urlValue, allowedOrigins, production);
      try {
        const response = await fetch(url, {
          cache: "no-store",
          credentials: "omit",
          headers: {
            Accept: "image/png, application/octet-stream",
            "Cache-Control": "no-store",
          },
          method: "GET",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status !== 200) {
          await cancelBody(response);
          fail();
        }
        const contentType = response.headers
          .get("content-type")
          ?.split(";", 1)[0]
          ?.trim()
          .toLowerCase();
        if (!contentType || !ARTWORK_CONTENT_TYPES.has(contentType)) {
          await cancelBody(response);
          fail();
        }
        return await boundedBytes(response, maximumBytes);
      } catch (error) {
        if (error instanceof GameArtworkError) throw error;
        fail();
      }
    },
  });
}

export function fetchGameArtwork(
  url: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const config = getServerConfig();
  return createGameArtworkClient({
    allowedOrigins: config.allowedGameArtworkOrigins,
    production: config.production,
  }).fetchArtwork(url);
}
