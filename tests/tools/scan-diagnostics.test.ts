import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { E2E_FORBIDDEN_BROWSER_VALUES } from "@/tests/fixtures/upstream";

const scanner = join(process.cwd(), "tools/scan-diagnostics.mjs");
const prohibited = [
  "api.kidsandus.es",
  "AutenticateUser",
  "merriloop_session=",
  "authorization: basic",
  ...E2E_FORBIDDEN_BROWSER_VALUES,
];

describe("diagnostics scanner", () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "diagnostics-scanner-"));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  });

  function scan(...roots: string[]) {
    return spawnSync(process.execPath, [scanner, ...roots], {
      cwd: temporaryDirectory,
      encoding: "utf8",
    });
  }

  it.each(prohibited)("rejects prohibited marker %s", (marker) => {
    mkdirSync(join(temporaryDirectory, "diagnostics"));
    writeFileSync(join(temporaryDirectory, "diagnostics/probe.txt"), marker);

    const result = scan("diagnostics");

    expect(result.status).toBe(1);
    expect(result.stderr.toLowerCase()).toContain(marker.toLowerCase());
  });

  it("accepts missing roots and PNG-only visual output", () => {
    expect(scan("missing", "test-results-visual").status).toBe(0);
    mkdirSync(join(temporaryDirectory, "test-results-visual"));
    writeFileSync(
      join(temporaryDirectory, "test-results-visual/diff.png"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );

    expect(scan("missing", "test-results-visual").status).toBe(0);
  });

  it("scans visual text and rejects unexpected visual extensions", () => {
    const visualDirectory = join(temporaryDirectory, "test-results-visual");
    mkdirSync(visualDirectory);
    writeFileSync(join(visualDirectory, "error-context.md"), prohibited[0]!);
    expect(scan("test-results-visual").status).toBe(1);

    rmSync(join(visualDirectory, "error-context.md"));
    writeFileSync(join(visualDirectory, "trace.zip"), "synthetic probe");
    const result = scan("test-results-visual");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unsupported visual artifact extension");
  });
});
