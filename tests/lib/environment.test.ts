import { describe, expect, it } from "vitest";

import {
  DEFAULT_API_ORIGIN,
  MAX_SESSION_TTL_SECONDS,
  parseServerConfig,
} from "@/lib/config/environment";

const validEnvironment = {
  ALLOWED_AUDIO_ORIGINS: "",
  ALLOWED_GAME_ORIGINS: "",
  ALLOWED_VIDEO_ORIGINS: "",
  ENABLE_AUDIO_PLAYBACK: "false",
  ENABLE_GAME_PLAYBACK: "false",
  ENABLE_VIDEO_PLAYBACK: "false",
  MYLOCKER_API_BASE_URL: "https://api.kidsandus.es",
  NODE_ENV: "production",
  PUBLIC_APP_ORIGIN: "https://learn.okapi.example",
  SESSION_SECRET: "a-fictional-secret-that-is-long-enough",
  SESSION_TTL_SECONDS: String(MAX_SESSION_TTL_SECONDS),
};

describe("parseServerConfig", () => {
  it("accepts the secure media-disabled production configuration", () => {
    expect(parseServerConfig(validEnvironment)).toMatchObject({
      audioPlaybackEnabled: false,
      gamePlaybackEnabled: false,
      production: true,
      sessionTtlSeconds: MAX_SESSION_TTL_SECONDS,
      videoPlaybackEnabled: false,
    });
  });

  it.each(["SESSION_SECRET", "PUBLIC_APP_ORIGIN"])(
    "rejects missing %s",
    (name) => {
      expect(() =>
        parseServerConfig({ ...validEnvironment, [name]: undefined }),
      ).toThrow();
    },
  );

  it("defaults the optional API origin to the approved Kids&Us API", () => {
    expect(
      parseServerConfig({
        ...validEnvironment,
        MYLOCKER_API_BASE_URL: undefined,
      }).apiBaseUrl,
    ).toBe(DEFAULT_API_ORIGIN);
  });

  it("rejects a short secret", () => {
    expect(() =>
      parseServerConfig({ ...validEnvironment, SESSION_SECRET: "too-short" }),
    ).toThrow(/32 bytes/);
  });

  it.each([
    "not-a-url",
    "https://user:pass@learn.okapi.example",
    "https://learn.okapi.example/path",
    "https://learn.okapi.example?query=yes",
    "https://learn.okapi.example#fragment",
    "http://learn.okapi.example",
  ])("rejects unsafe production origin %s", (PUBLIC_APP_ORIGIN) => {
    expect(() =>
      parseServerConfig({ ...validEnvironment, PUBLIC_APP_ORIGIN }),
    ).toThrow();
  });

  it("rejects an unapproved production API origin", () => {
    expect(() =>
      parseServerConfig({
        ...validEnvironment,
        MYLOCKER_API_BASE_URL: "https://example.com",
      }),
    ).toThrow(/approved production origin/);
  });

  it.each(["0", "28801", "1.5", "words"])("rejects invalid TTL %s", (ttl) => {
    expect(() =>
      parseServerConfig({ ...validEnvironment, SESSION_TTL_SECONDS: ttl }),
    ).toThrow(/SESSION_TTL_SECONDS/);
  });

  it.each([
    ["ENABLE_VIDEO_PLAYBACK", "Video"],
    ["ENABLE_AUDIO_PLAYBACK", "Audio"],
    ["ENABLE_GAME_PLAYBACK", "Game"],
  ])("rejects enabled playback without an allowlist", (flag, mediaType) => {
    expect(() =>
      parseServerConfig({ ...validEnvironment, [flag]: "true" }),
    ).toThrow(mediaType);
  });

  it("keeps game approval independent and deduplicates exact origins", () => {
    const config = parseServerConfig({
      ...validEnvironment,
      ALLOWED_GAME_ORIGINS:
        "https://packages.example, https://packages.example",
      ENABLE_GAME_PLAYBACK: "true",
    });
    expect(config.allowedGameOrigins).toEqual(["https://packages.example"]);
    expect(config.allowedAudioOrigins).toEqual([]);
    expect(config.allowedVideoOrigins).toEqual([]);
  });

  it("accepts only HTTPS media origins and removes duplicates", () => {
    const config = parseServerConfig({
      ...validEnvironment,
      ALLOWED_VIDEO_ORIGINS: "https://media.example, https://media.example",
      ENABLE_VIDEO_PLAYBACK: "true",
    });
    expect(config.allowedVideoOrigins).toEqual(["https://media.example"]);
    expect(() =>
      parseServerConfig({
        ...validEnvironment,
        ALLOWED_AUDIO_ORIGINS: "http://media.example",
      }),
    ).toThrow();
  });

  it("allows HTTP loopback origins only outside production", () => {
    const config = parseServerConfig({
      ...validEnvironment,
      ALLOWED_VIDEO_ORIGINS: "http://127.0.0.1:4200",
      ENABLE_VIDEO_PLAYBACK: "true",
      MYLOCKER_API_BASE_URL: "http://127.0.0.1:4100",
      NODE_ENV: "test",
      PUBLIC_APP_ORIGIN: "http://localhost:3000",
    });
    expect(config.apiBaseUrl).toBe("http://127.0.0.1:4100");
    expect(config.allowedVideoOrigins).toEqual(["http://127.0.0.1:4200"]);
  });

  it("rejects media origins that could receive the application cookie", () => {
    expect(() =>
      parseServerConfig({
        ...validEnvironment,
        ALLOWED_VIDEO_ORIGINS: "https://learn.okapi.example:444",
      }),
    ).toThrow(/cookie hostname|default HTTPS port/);
  });

  it("rejects game origins that could receive the application cookie", () => {
    expect(() =>
      parseServerConfig({
        ...validEnvironment,
        ALLOWED_GAME_ORIGINS: "https://learn.okapi.example",
      }),
    ).toThrow(/cookie hostname/);
  });

  it.each([
    "https://user:pass@media.example",
    "https://media.example/path",
    "https://media.example?grant=value",
    "https://media.example#fragment",
    "https://media.example:444",
  ])("rejects unsafe production media origin %s", (origin) => {
    expect(() =>
      parseServerConfig({
        ...validEnvironment,
        ALLOWED_VIDEO_ORIGINS: origin,
      }),
    ).toThrow();
  });

  it.each([
    "http://packages.example",
    "https://user:pass@packages.example",
    "https://packages.example/path",
    "https://packages.example?grant=value",
    "https://packages.example#fragment",
    "https://packages.example:444",
  ])("rejects unsafe production game origin %s", (origin) => {
    expect(() =>
      parseServerConfig({
        ...validEnvironment,
        ALLOWED_GAME_ORIGINS: origin,
      }),
    ).toThrow();
  });
});
