import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

export function repositoryFiles() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean)
    .filter((path) => statSync(path).isFile());
}

export function readableText(path) {
  const value = readFileSync(path);
  if (value.includes(0)) return null;
  return value.toString("utf8");
}
