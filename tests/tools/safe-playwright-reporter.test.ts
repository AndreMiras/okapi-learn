import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error The production Playwright reporter is intentionally plain ESM.
import SafePlaywrightReporter from "@/tools/safe-playwright-reporter.mjs";

function fakeTest(title = "safe fictional test") {
  return {
    parent: { project: () => ({ name: "mobile-webkit" }) },
    title,
  };
}

describe("SafePlaywrightReporter", () => {
  let originalDirectory: string;
  let temporaryDirectory: string;

  beforeEach(() => {
    originalDirectory = process.cwd();
    temporaryDirectory = mkdtempSync(join(tmpdir(), "safe-reporter-"));
    process.chdir(temporaryDirectory);
    vi.stubEnv("PLAYWRIGHT_SUITE", "functional");
  });

  afterEach(() => {
    process.chdir(originalDirectory);
    rmSync(temporaryDirectory, { force: true, recursive: true });
    vi.unstubAllEnvs();
  });

  it("retains only a repository-relative failure location", () => {
    const reporter = new SafePlaywrightReporter();
    reporter.onTestEnd(fakeTest(), {
      attachments: [{ body: "forbidden-attachment" }],
      duration: 6_420.6,
      error: {
        actual: "forbidden-actual",
        expected: "forbidden-expected",
        location: {
          column: 25,
          file: join(temporaryDirectory, "tests/e2e/fake.spec.ts"),
          line: 259,
        },
        message: "forbidden-message",
        stack: "forbidden-stack",
      },
      errors: [],
      status: "failed",
      stderr: ["forbidden-stderr"],
      stdout: ["forbidden-stdout"],
    });
    reporter.onEnd({ status: "failed" });

    const output = readFileSync("diagnostics/functional.json", "utf8");
    expect(JSON.parse(output)).toEqual({
      status: "failed",
      tests: [
        {
          durationMs: 6421,
          location: {
            column: 25,
            file: "tests/e2e/fake.spec.ts",
            line: 259,
          },
          project: "mobile-webkit",
          status: "failed",
          title: "safe fictional test",
        },
      ],
    });
    expect(output).not.toMatch(
      /forbidden-(?:actual|attachment|expected|message|stack|stderr|stdout)/,
    );
  });

  it("omits locations for passing results and paths outside the repository", () => {
    const reporter = new SafePlaywrightReporter();
    reporter.onTestEnd(fakeTest("passing test"), {
      duration: 1,
      error: {
        location: { column: 1, file: "/outside/fake.spec.ts", line: 1 },
      },
      status: "passed",
    });
    reporter.onTestEnd(fakeTest("outside failure"), {
      duration: 2,
      error: {
        location: { column: 1, file: "/outside/fake.spec.ts", line: 1 },
      },
      status: "timedOut",
    });
    reporter.onEnd({ status: "failed" });

    const output = JSON.parse(
      readFileSync("diagnostics/functional.json", "utf8"),
    );
    expect(output.tests[0]).not.toHaveProperty("location");
    expect(output.tests[1]).not.toHaveProperty("location");
  });
});
