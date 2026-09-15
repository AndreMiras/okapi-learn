import "server-only";

import { getServerConfig } from "@/lib/config/server";
import { MAX_GAME_PACKAGE_BYTES } from "@/lib/games/package/limits";

export const GAME_TIMEOUT_MS = 30_000;
const GAME_PATH_PREFIX = "/api/Alumnes/GetGame/";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const PACKAGE_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "application/zip",
]);

export type GamePackageErrorCategory =
  | "not_available"
  | "not_found"
  | "try_later"
  | "unsupported"
  | "service_unavailable";

export class GamePackageError extends Error {
  readonly category: GamePackageErrorCategory;

  constructor(category: GamePackageErrorCategory) {
    super(category);
    this.name = "GamePackageError";
    this.category = category;
  }
}

export type GamePackageClientOptions = Readonly<{
  allowedGameOrigins: readonly string[];
  apiBaseUrl: string;
  maximumBytes?: number;
  production?: boolean;
  timeoutMs?: number;
}>;

function fail(category: GamePackageErrorCategory): never {
  throw new GamePackageError(category);
}

function mapStatus(status: number): never {
  if (status === 404) fail("not_found");
  if (status === 429) fail("try_later");
  if (status === 401 || status === 403) fail("not_available");
  if (status >= 400 && status < 500) fail("unsupported");
  fail("service_unavailable");
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    fail("service_unavailable");
  }
}

function redirectTarget(
  location: string | null,
  endpoint: URL,
  allowedOrigins: ReadonlySet<string>,
  production: boolean,
): URL {
  if (!location || location.length > 2_048) fail("unsupported");
  let target: URL;
  try {
    target = new URL(location, endpoint);
  } catch {
    fail("unsupported");
  }
  const loopback =
    target.hostname === "localhost" || target.hostname === "127.0.0.1";
  if (
    target.username ||
    target.password ||
    target.hash ||
    (production && target.port) ||
    (production && target.protocol !== "https:") ||
    (!production &&
      target.protocol !== "https:" &&
      !(target.protocol === "http:" && loopback)) ||
    !allowedOrigins.has(target.origin)
  ) {
    fail("unsupported");
  }
  return target;
}

function requestInit(signal: AbortSignal): RequestInit {
  return {
    cache: "no-store",
    credentials: "omit",
    headers: {
      Accept: "application/octet-stream, application/zip",
      "Cache-Control": "no-store",
    },
    method: "GET",
    redirect: "manual",
    referrerPolicy: "no-referrer",
    signal,
  };
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
      fail("unsupported");
    }
    declaredLength = Number(contentLengthText);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength > maximumBytes
    ) {
      await cancelBody(response);
      fail("unsupported");
    }
  }
  if (!response.body) fail("unsupported");

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
        fail("unsupported");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof GamePackageError) throw error;
    fail("service_unavailable");
  }
  if (declaredLength !== null && byteCount !== declaredLength) {
    fail("unsupported");
  }
  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function createGamePackageClient(options: GamePackageClientOptions) {
  const maximumBytes = Math.min(
    options.maximumBytes ?? MAX_GAME_PACKAGE_BYTES,
    MAX_GAME_PACKAGE_BYTES,
  );
  const timeoutMs = Math.min(
    options.timeoutMs ?? GAME_TIMEOUT_MS,
    GAME_TIMEOUT_MS,
  );
  const allowedOrigins = new Set(options.allowedGameOrigins);
  const production =
    options.production ?? process.env.NODE_ENV === "production";

  return Object.freeze({
    async fetchPackage(gameId: string): Promise<Uint8Array<ArrayBuffer>> {
      const expectedPath = `${GAME_PATH_PREFIX}${encodeURIComponent(gameId)}`;
      const endpoint = new URL(expectedPath, `${options.apiBaseUrl}/`);
      if (endpoint.pathname !== expectedPath) fail("unsupported");
      const signal = AbortSignal.timeout(timeoutMs);
      try {
        const redirect = await fetch(endpoint, requestInit(signal));
        if (!REDIRECT_STATUSES.has(redirect.status)) {
          await cancelBody(redirect);
          mapStatus(redirect.status);
        }
        await cancelBody(redirect);
        const target = redirectTarget(
          redirect.headers.get("location"),
          endpoint,
          allowedOrigins,
          production,
        );
        const response = await fetch(target, requestInit(signal));
        if (REDIRECT_STATUSES.has(response.status)) {
          await cancelBody(response);
          fail("unsupported");
        }
        if (response.status !== 200) {
          await cancelBody(response);
          mapStatus(response.status);
        }
        const contentType = response.headers
          .get("content-type")
          ?.split(";", 1)[0]
          ?.trim()
          .toLowerCase();
        if (!contentType || !PACKAGE_CONTENT_TYPES.has(contentType)) {
          await cancelBody(response);
          fail("unsupported");
        }
        return await boundedBytes(response, maximumBytes);
      } catch (error) {
        if (error instanceof GamePackageError) throw error;
        fail("service_unavailable");
      }
    },
  });
}

export function fetchGamePackage(
  gameId: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const config = getServerConfig();
  return createGamePackageClient({
    allowedGameOrigins: config.allowedGameOrigins,
    apiBaseUrl: config.apiBaseUrl,
    production: config.production,
  }).fetchPackage(gameId);
}
