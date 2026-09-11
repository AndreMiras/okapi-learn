import { describe, expect, it } from "vitest";

import { isUpstreamError, UpstreamError } from "@/lib/mylocker/errors";
import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import { normalizeServerHeldMediaUrl } from "@/lib/mylocker/url-policy";
import { syntheticAuthenticationResponse } from "@/tests/fixtures/upstream";

function response() {
  return structuredClone(syntheticAuthenticationResponse());
}

describe("normalizeAuthenticationResponse", () => {
  it("projects only the minimum observed graph and preserves Unicode", () => {
    const input = response();
    input.Students[0].Name = "Nóva 星";
    input.Courses[0].Name = "Òrbita";
    input.Courses[0].Videos[0].Title = "Lluna 🌙";
    const normalized = normalizeAuthenticationResponse(input);

    expect(normalized.learners[0]?.name).toBe("Nóva 星");
    expect(normalized.courses[0]?.name).toBe("Òrbita");
    expect(normalized.courses[0]?.videos[0]?.title).toBe("Lluna 🌙");
    const retained = JSON.stringify(normalized);
    for (const excluded of [
      "Surname",
      "Fictional-Surname",
      "DateOfBirth",
      "UrlPhoto",
      "GameMap",
      "ViewedBy",
      "ZipUrl",
      "nivellId",
      "unknownRoot",
    ]) {
      expect(retained).not.toContain(excluded);
    }
  });

  it("accepts omitted Games, nullable unknown fields, and missing media collections", () => {
    const input = response() as Record<string, any>;
    delete input.Courses[0].Audios;
    input.Courses[0].Videos[0].Description = null;
    input.Courses[0].Videos[0].Duration = undefined;
    expect(normalizeAuthenticationResponse(input).courses[0]).toMatchObject({
      audios: [],
    });
  });

  it("accepts empty learner, course, and media collections", () => {
    const input = response();
    input.Students = [];
    input.Courses = [];
    expect(normalizeAuthenticationResponse(input)).toMatchObject({
      learners: [],
      courses: [],
    });
  });

  it.each([
    (input: any) => input.Students.push({ ...input.Students[0] }),
    (input: any) => input.Courses.push({ ...input.Courses[0] }),
    (input: any) =>
      input.Courses.push({ ...input.Courses[0], CourseId: "another-course" }),
    (input: any) => (input.Students[0].CourseId = "missing-course"),
  ])("rejects duplicate or mismatched relationships", (mutate) => {
    const input = response();
    mutate(input);
    expect(() => normalizeAuthenticationResponse(input)).toThrow(UpstreamError);
  });

  it("rejects duplicate media IDs across courses", () => {
    const input = response();
    input.Courses.push({
      ...structuredClone(input.Courses[0]),
      CourseId: "course-two",
    });
    expect(() => normalizeAuthenticationResponse(input)).toThrow(UpstreamError);
  });

  it.each([
    (input: any) => (input.authToken = ""),
    (input: any) => (input.TermsPending = "false"),
    (input: any) => (input.Students = null),
    (input: any) => (input.Courses[0].Videos[0].Orden = -1),
    (input: any) => (input.Courses[0].Videos[0].Title = "bad\u0000title"),
    (input: any) =>
      (input.Courses[0].Videos[0].UrlVideo = "http://media.example.test/x"),
  ])("rejects malformed required data", (mutate) => {
    const input = response();
    mutate(input);
    expect(() => normalizeAuthenticationResponse(input)).toThrowError(
      expect.objectContaining({ category: "invalid_response" }),
    );
  });

  it("rejects excessive arrays and nesting", () => {
    const tooManyLearners = response();
    tooManyLearners.Students = Array.from({ length: 17 }, (_, index) => ({
      ...tooManyLearners.Students[0],
      StudentId: `learner-${index}`,
    }));
    expect(() => normalizeAuthenticationResponse(tooManyLearners)).toThrow();

    const tooDeep: any = response();
    let cursor: any = (tooDeep.unknown = {});
    for (let index = 0; index < 14; index += 1) cursor = cursor.next = {};
    expect(() => normalizeAuthenticationResponse(tooDeep)).toThrow();
  });

  it("rejects excessive object keys and media collections", () => {
    const tooManyKeys: any = response();
    tooManyKeys.unknown = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [`key-${index}`, index]),
    );
    expect(() => normalizeAuthenticationResponse(tooManyKeys)).toThrow();

    const tooMuchMedia = response();
    tooMuchMedia.Courses[0].Videos = Array.from(
      { length: 257 },
      (_, index) => ({
        ...tooMuchMedia.Courses[0].Videos[0],
        VideoId: `video-${index}`,
      }),
    );
    expect(() => normalizeAuthenticationResponse(tooMuchMedia)).toThrow();
  });

  it.each([
    null,
    "response",
    { ...response(), GameTester: null },
    { ...response(), GameMapTester: null },
  ])("rejects malformed roots and tester gates", (input) => {
    expect(() => normalizeAuthenticationResponse(input)).toThrow();
  });
});

describe("normalizeServerHeldMediaUrl", () => {
  it("retains an HTTPS URL with a query only on the server model", () => {
    expect(
      normalizeServerHeldMediaUrl(
        "https://media.example.test/file.mp4?grant=fake",
      ),
    ).toBe("https://media.example.test/file.mp4?grant=fake");
    expect(normalizeServerHeldMediaUrl(null)).toBeNull();
    expect(normalizeServerHeldMediaUrl(undefined)).toBeNull();
    expect(normalizeServerHeldMediaUrl("")).toBeNull();
  });

  it.each([
    "http://media.example.test/file.mp4",
    "https://user:pass@media.example.test/file.mp4",
    "https://media.example.test:8443/file.mp4",
    "https://media.example.test/file.mp4#fragment",
    "not-a-url",
    42,
    "x".repeat(2_049),
  ])("rejects unsupported URL %s", (url) => {
    expect(() => normalizeServerHeldMediaUrl(url)).toThrow(UpstreamError);
  });
});

describe("isUpstreamError", () => {
  it("recognizes only the safe upstream error type", () => {
    expect(isUpstreamError(new UpstreamError("unavailable"))).toBe(true);
    expect(isUpstreamError(new Error("unavailable"))).toBe(false);
  });
});
