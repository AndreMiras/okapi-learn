import { describe, expect, it } from "vitest";

import { normalizeAuthenticationResponse } from "@/lib/mylocker/normalize";
import { selectLearner, selectMedia } from "@/lib/session/selectors";
import { MemorySessionStore } from "@/lib/session/store";
import { syntheticAuthenticationResponse } from "@/tests/fixtures/upstream";

function createSession(seed = 0) {
  let randomValue = seed;
  const store = new MemorySessionStore({
    now: () => 1_000,
    random: (size) => Buffer.alloc(size, ++randomValue),
    secret: "a-secret-long-enough-for-selector-tests",
    ttlSeconds: 60,
  });
  const input = syntheticAuthenticationResponse();
  input.Courses[0]!.Videos.push(
    {
      ...input.Courses[0]!.Videos[0]!,
      Orden: 1,
      Title: "First by order",
      VideoId: "video-first",
    },
    {
      ...input.Courses[0]!.Videos[0]!,
      Orden: 2,
      Title: "Second stable item",
      VideoId: "video-second",
    },
  );
  const issued = store.issue(normalizeAuthenticationResponse(input));
  return store.read(issued.cookieValue)!;
}

describe("session selectors", () => {
  it("selects only current aliases and preserves stable order", () => {
    const session = createSession();
    const learner = session.learners[0]!;
    const selected = selectLearner(session, learner.alias);
    expect(selected?.course.videos.map(({ title }) => title)).toEqual([
      "First by order",
      "Moonlight Story",
      "Second stable item",
    ]);
    const media = selected!.course.videos[0]!;
    expect(selectMedia(session, learner.alias, media.alias)?.media.title).toBe(
      "First by order",
    );
  });

  it.each(["learner-nova", "missing", "", "../course-orbit"])(
    "rejects raw, arbitrary, or missing learner alias %s",
    (alias) => expect(selectLearner(createSession(), alias)).toBeNull(),
  );

  it("rejects stale media aliases and aliases from another session", () => {
    const first = createSession();
    const second = createSession(20);
    expect(
      selectMedia(
        first,
        first.learners[0]!.alias,
        second.courses[0]!.videos[0]!.alias,
      ),
    ).toBeNull();
    expect(
      selectMedia(first, first.learners[0]!.alias, "video-moonlight"),
    ).toBeNull();
  });

  it("fails closed for a malformed learner-course relationship", () => {
    const session = createSession();
    const malformed = { ...session, courses: [] };
    expect(selectLearner(malformed, session.learners[0]!.alias)).toBeNull();
  });
});
