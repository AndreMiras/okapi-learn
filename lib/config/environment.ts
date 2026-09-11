export const MAX_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const DEFAULT_API_ORIGIN = "https://api.kidsandus.es";

export type ServerConfig = Readonly<{
  allowedAudioOrigins: readonly string[];
  allowedVideoOrigins: readonly string[];
  apiBaseUrl: string;
  audioPlaybackEnabled: boolean;
  publicAppOrigin: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  videoPlaybackEnabled: boolean;
}>;

type Environment = Record<string, string | undefined>;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new ConfigurationError(`${name} is required`);
  return value;
}

function parseOrigin(value: string, name: string, production: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigurationError(`${name} must be an absolute URL`);
  }

  const isLoopback =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (production && url.protocol !== "https:") ||
    (!production &&
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && isLoopback))
  ) {
    throw new ConfigurationError(`${name} must be a safe origin`);
  }

  return url.origin;
}

function parseBoolean(environment: Environment, name: string): boolean {
  const value = environment[name]?.trim() || "false";
  if (value !== "true" && value !== "false") {
    throw new ConfigurationError(`${name} must be true or false`);
  }
  return value === "true";
}

function parseOrigins(
  value: string | undefined,
  name: string,
): readonly string[] {
  if (!value?.trim()) return [];
  const origins = value
    .split(",")
    .map((entry) => parseOrigin(entry.trim(), name, true));
  return [...new Set(origins)];
}

export function parseServerConfig(environment: Environment): ServerConfig {
  const production = environment.NODE_ENV === "production";
  const apiBaseUrl = parseOrigin(
    environment.MYLOCKER_API_BASE_URL?.trim() || DEFAULT_API_ORIGIN,
    "MYLOCKER_API_BASE_URL",
    production,
  );
  if (production && apiBaseUrl !== DEFAULT_API_ORIGIN) {
    throw new ConfigurationError(
      "MYLOCKER_API_BASE_URL is not an approved production origin",
    );
  }

  const sessionSecret = required(environment, "SESSION_SECRET");
  if (Buffer.byteLength(sessionSecret, "utf8") < 32) {
    throw new ConfigurationError(
      "SESSION_SECRET must contain at least 32 bytes",
    );
  }

  const ttlValue =
    environment.SESSION_TTL_SECONDS?.trim() || String(MAX_SESSION_TTL_SECONDS);
  const sessionTtlSeconds = Number(ttlValue);
  if (
    !Number.isSafeInteger(sessionTtlSeconds) ||
    sessionTtlSeconds < 1 ||
    sessionTtlSeconds > MAX_SESSION_TTL_SECONDS
  ) {
    throw new ConfigurationError(
      `SESSION_TTL_SECONDS must be between 1 and ${MAX_SESSION_TTL_SECONDS}`,
    );
  }

  const publicAppOrigin = parseOrigin(
    required(environment, "PUBLIC_APP_ORIGIN"),
    "PUBLIC_APP_ORIGIN",
    production,
  );
  const allowedVideoOrigins = parseOrigins(
    environment.ALLOWED_VIDEO_ORIGINS,
    "ALLOWED_VIDEO_ORIGINS",
  );
  const allowedAudioOrigins = parseOrigins(
    environment.ALLOWED_AUDIO_ORIGINS,
    "ALLOWED_AUDIO_ORIGINS",
  );
  const videoPlaybackEnabled = parseBoolean(
    environment,
    "ENABLE_VIDEO_PLAYBACK",
  );
  const audioPlaybackEnabled = parseBoolean(
    environment,
    "ENABLE_AUDIO_PLAYBACK",
  );

  if (videoPlaybackEnabled && allowedVideoOrigins.length === 0) {
    throw new ConfigurationError("Video playback requires an allowed origin");
  }
  if (audioPlaybackEnabled && allowedAudioOrigins.length === 0) {
    throw new ConfigurationError("Audio playback requires an allowed origin");
  }

  return Object.freeze({
    allowedAudioOrigins,
    allowedVideoOrigins,
    apiBaseUrl,
    audioPlaybackEnabled,
    publicAppOrigin,
    sessionSecret,
    sessionTtlSeconds,
    videoPlaybackEnabled,
  });
}
