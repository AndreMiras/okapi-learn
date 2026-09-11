import { mkdirSync, writeFileSync } from "node:fs";

export default class SafePlaywrightReporter {
  results = [];

  onTestEnd(test, result) {
    this.results.push({
      durationMs: Math.max(0, Math.round(result.duration)),
      project: test.parent.project()?.name ?? "unknown",
      status: result.status,
      title: test.title,
    });
  }

  onEnd(result) {
    mkdirSync("diagnostics", { recursive: true });
    const suite = process.env.PLAYWRIGHT_SUITE ?? "functional";
    writeFileSync(
      `diagnostics/${suite}.json`,
      `${JSON.stringify({ status: result.status, tests: this.results }, null, 2)}\n`,
    );
  }
}
