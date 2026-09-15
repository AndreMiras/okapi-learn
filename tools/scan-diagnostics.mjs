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
  "learner-lyra",
  "course-orbit",
  "course-garden",
  "video-moonlight",
  "video-comet",
  "game-starlight",
  "game-comet",
  "game-constellation",
  "audio-rain",
  "Fictional-Surname",
  "2017-01-01",
  "private-learner-id-that-must-be-dropped",
  "media.example.test",
  "images.example.test",
  "games.example.test",
  "127.0.0.1:4300",
  "/api/Alumnes/GetGame/",
  "/objects/mixed.zip",
  "/objects/unsupported.zip",
  "/objects/retry-malformed.zip",
  "blob:http://",
  "blob:https://",
  "dynamics/listen-all.json",
  "images/amber.png",
  "audio/prompt.mp3",
  '"selectableElements"',
  '"waitSeconds"',
];
const prohibitedBytes = [Buffer.from([0x50, 0x4b, 0x03, 0x04])];
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
  if (prohibitedBytes.some((bytes) => value.includes(bytes))) {
    findings.push(`${path}: package byte signature`);
  }
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
