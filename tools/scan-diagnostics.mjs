import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const roots = process.argv.slice(2);
const textualVisualExtensions = new Set([".json", ".md", ".txt"]);
const prohibited = [
  "api.kidsandus.es",
  "AutenticateUser",
  "merriloop_session=",
  "authorization: basic",
  "fictional-passphrase",
  "fictional-upstream-token",
  "learner-nova",
  "learner-milo",
  "course-orbit",
  "course-garden",
  "video-moonlight",
  "audio-rain",
  "Fictional-Surname",
  "2017-01-01",
  "private-learner-id-that-must-be-dropped",
  "media.example.test",
  "images.example.test",
  "games.example.test",
];
const findings = [];
function scan(path, visual) {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) scan(join(path, entry), visual);
    return;
  }
  if (visual) {
    const extension = extname(path).toLowerCase();
    if (extension === ".png") return;
    if (!textualVisualExtensions.has(extension)) {
      findings.push(`${path}: unsupported visual artifact extension`);
      return;
    }
  }
  const value = readFileSync(path);
  for (const marker of prohibited) {
    if (value.toString("utf8").toLowerCase().includes(marker.toLowerCase())) {
      findings.push(`${path}: ${marker}`);
    }
  }
}
roots.forEach((root) => scan(root, normalize(root) === "test-results-visual"));
if (findings.length) {
  console.error(`Unsafe diagnostics found:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log("Diagnostic redaction scan passed.");
