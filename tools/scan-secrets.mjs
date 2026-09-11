import { repositoryFiles, readableText } from "./repository-files.mjs";

const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[oprs]_[A-Za-z0-9]{30,}\b/,
  /\b(?:password|secret|token)\s*[:=]\s*["']?(?!a-secret|a-fictional|a-different-|fictional|replace-|must-|process\.|graph\.|event\.|options\.|config\.)[A-Za-z0-9_+\-/=]{20,}/i,
];
const findings = [];
for (const path of repositoryFiles()) {
  const text = readableText(path);
  if (text === null) continue;
  text.split("\n").forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      findings.push(`${path}:${index + 1}`);
    }
  });
}
if (findings.length) {
  console.error(`Potential secrets found:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log("Secret scan passed for repository files.");
