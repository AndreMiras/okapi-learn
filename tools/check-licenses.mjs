import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const accepted = [
  /^(?:0BSD|Apache-2\.0|BSD-[23]-Clause|BlueOak-1\.0\.0|CC-BY-4\.0|CC0-1\.0|ISC|LGPL-3\.0-or-later|MIT|MPL-2\.0|OFL-1\.1|Python-2\.0|Unlicense)$/,
  /^(?:Apache-2\.0|LGPL-3\.0-or-later|MIT)(?: AND (?:Apache-2\.0|LGPL-3\.0-or-later|MIT))+$/,
  /^\((?:MIT|Apache-2\.0|BSD-[23]-Clause|LGPL-3\.0-or-later)(?: OR (?:MIT|Apache-2\.0|BSD-[23]-Clause|LGPL-3\.0-or-later))+\)$/,
  /^(?:MIT|Apache-2\.0|BSD-[23]-Clause|LGPL-3\.0-or-later)(?: OR (?:MIT|Apache-2\.0|BSD-[23]-Clause|LGPL-3\.0-or-later))+$/,
];
const rejected = [];
for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (!path || metadata.link) continue;
  const license = metadata.license;
  if (
    typeof license !== "string" ||
    !accepted.some((pattern) => pattern.test(license))
  ) {
    rejected.push(`${path}: ${license ?? "missing"}`);
  }
}
if (rejected.length) {
  console.error(`Unreviewed package licenses:\n${rejected.join("\n")}`);
  process.exit(1);
}
console.log("Dependency licenses match the reviewed policy.");
