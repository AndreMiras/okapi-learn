import { describe, expect, it } from "vitest";

import {
  normalizeServerHeldMediaUrl,
  selectPlayableMediaUrl,
} from "@/lib/mylocker/url-policy";

describe("media URL release policy", () => {
  it("permits only exact enabled origins", () => {
    const value = "https://media.example/item.mp4?fictional=grant";
    expect(selectPlayableMediaUrl(value, true, ["https://media.example"])).toBe(
      value,
    );
    expect(
      selectPlayableMediaUrl(value, false, ["https://media.example"]),
    ).toBeNull();
    expect(
      selectPlayableMediaUrl(value, true, ["https://other.example"]),
    ).toBeNull();
    expect(
      selectPlayableMediaUrl(null, true, ["https://media.example"]),
    ).toBeNull();
  });

  it("normalizes HTTP only for loopback synthetic fixtures", () => {
    expect(normalizeServerHeldMediaUrl("http://127.0.0.1:4200/media.wav")).toBe(
      "http://127.0.0.1:4200/media.wav",
    );
    expect(() =>
      normalizeServerHeldMediaUrl("http://media.example/media.wav"),
    ).toThrow();
  });
});
