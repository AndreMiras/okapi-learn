import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = process.argv.slice(2);
const prohibited = [
  "api.kidsandus.es",
  "AutenticateUser",
  "merriloop_session=",
  "authorization: basic",
];
const findings = [];
function scan(path) {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) scan(join(path, entry));
    return;
  }
  const value = readFileSync(path);
  for (const marker of prohibited) {
    if (value.toString("utf8").toLowerCase().includes(marker.toLowerCase())) {
      findings.push(`${path}: ${marker}`);
    }
  }
}
roots.forEach(scan);
if (findings.length) {
  console.error(`Unsafe diagnostics found:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log("Diagnostic redaction scan passed.");
