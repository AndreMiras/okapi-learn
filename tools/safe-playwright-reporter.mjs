import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const failureStatuses = new Set(["failed", "interrupted", "timedOut"]);

function safeErrorLocation(result) {
  if (!failureStatuses.has(result.status)) return undefined;
  const error = [...(result.errors ?? []), result.error].find(
    (candidate) => candidate?.location,
  );
  const location = error?.location;
  if (
    !location?.file ||
    !Number.isInteger(location.line) ||
    location.line <= 0 ||
    !Number.isInteger(location.column) ||
    location.column <= 0
  ) {
    return undefined;
  }
  const root = process.cwd();
  const file = relative(root, resolve(root, location.file));
  if (
    !file ||
    file === ".." ||
    file.startsWith(`..${sep}`) ||
    isAbsolute(file)
  ) {
    return undefined;
  }
  return {
    column: location.column,
    file: file.split(sep).join("/"),
    line: location.line,
  };
}

export default class SafePlaywrightReporter {
  results = [];

  onTestEnd(test, result) {
    const location = safeErrorLocation(result);
    this.results.push({
      durationMs: Math.max(0, Math.round(result.duration)),
      ...(location ? { location } : {}),
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
