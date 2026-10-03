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
  "map-orbit",
  "section-one-front.png",
  "section-three-front.png",
  "/maps/section-1.png",
  "/maps/section-3.png",
  "game-starlight",
  "game-comet",
  "game-constellation",
  "game-aurora",
  "game-nebula",
  "audio-rain",
  "Fictional-Surname",
  "2017-01-01",
  "private-learner-id-that-must-be-dropped",
  "media.example.test",
  "images.example.test",
  "games.example.test",
  "127.0.0.1:4300",
  "127.0.0.1:4400",
  "/api/learn/learner-nova/game-map/",
  "/api/Alumnes/GetGame/",
  "/objects/mixed.zip",
  "/objects/paint-mixed.zip",
  "/objects/unsupported.zip",
  "/objects/retry-malformed.zip",
  "blob:http://",
  "blob:https://",
  "dynamics/listen-all.json",
  "dynamics/paint.json",
  "images/paint-background.png",
  "images/paint-overlay-a.png",
  "palette-a",
  "spot-a",
  "Fictional colour puzzle",
  "images/amber.png",
  "audio/prompt.mp3",
  '"selectableElements"',
  '"waitSeconds"',
];
const prohibitedBytes = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
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
    // Only reviewed fictional visual comparisons may contain PNG bytes.
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
