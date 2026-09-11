import { extname } from "node:path";

import { repositoryFiles, readableText } from "./repository-files.mjs";

const prohibitedExtensions = new Set([
  ".apk",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".png",
  ".webm",
]);
const findings = [];
for (const path of repositoryFiles()) {
  if (prohibitedExtensions.has(extname(path).toLowerCase())) {
    if (!(
      path.startsWith("tests/e2e/visual.spec.ts-snapshots/") &&
      extname(path).toLowerCase() === ".png"
    )) {
      findings.push(`${path}: prohibited binary or licensed-media extension`);
    }
    continue;
  }
  const text = readableText(path);
  if (text === null || path.startsWith("tools/")) continue;
  text.split("\n").forEach((line, index) => {
    if (
      /https?:\/\/[^\s"')]+\?(?:[^\s]*)(?:sig|signature|token|grant|key|expires)=/i.test(
        line,
      ) &&
      !/(?:fictional|\.example(?:\.test)?)/i.test(line)
    ) {
      findings.push(`${path}:${index + 1}`);
    }
    const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    for (const email of emails) {
      if (
        !line.includes(".example") &&
        email.toLowerCase() !== "apps-support@kidsandus.com" &&
        !email.toLowerCase().endsWith("@example.test")
      ) {
        findings.push(`${path}:${index + 1}`);
      }
    }
  });
}
if (findings.length) {
  console.error(
    `Potential personal or licensed data found:\n${findings.join("\n")}`,
  );
  process.exit(1);
}
console.log("Personal-data scan passed for repository files.");
