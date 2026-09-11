import { describe, expect, it } from "vitest";

import {
  DEFAULT_API_ORIGIN,
  MAX_SESSION_TTL_SECONDS,
  parseServerConfig,
} from "@/lib/config/environment";

const validEnvironment = {
  ALLOWED_AUDIO_ORIGINS: "",
  ALLOWED_VIDEO_ORIGINS: "",
  ENABLE_AUDIO_PLAYBACK: "false",
  ENABLE_VIDEO_PLAYBACK: "false",
  MYLOCKER_API_BASE_URL: "https://api.kidsandus.es",
  NODE_ENV: "production",
  PUBLIC_APP_ORIGIN: "https://merriloop.example",
  SESSION_SECRET: "a-fictional-secret-that-is-long-enough",
  SESSION_TTL_SECONDS: String(MAX_SESSION_TTL_SECONDS),
};

describe("parseServerConfig", () => {
  it("accepts the secure media-disabled production configuration", () => {
    expect(parseServerConfig(validEnvironment)).toMatchObject({
      audioPlaybackEnabled: false,
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
    "https://user:pass@merriloop.example",
    "https://merriloop.example/path",
    "https://merriloop.example?query=yes",
    "https://merriloop.example#fragment",
    "http://merriloop.example",
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
  ])("rejects enabled playback without an allowlist", (flag, mediaType) => {
    expect(() =>
      parseServerConfig({ ...validEnvironment, [flag]: "true" }),
    ).toThrow(mediaType);
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
    expect(
      parseServerConfig({
        ...validEnvironment,
        MYLOCKER_API_BASE_URL: "http://127.0.0.1:4100",
        NODE_ENV: "test",
        PUBLIC_APP_ORIGIN: "http://localhost:3000",
      }).apiBaseUrl,
    ).toBe("http://127.0.0.1:4100");
  });
});
