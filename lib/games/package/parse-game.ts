import type { ArchiveFiles } from "./archive";
import type { ImageDimensions } from "./assets";
import { packageFailure } from "./errors";
import { MAX_DYNAMICS } from "./limits";
import {
  array,
  boundedString,
  parseJson,
  record,
  type ParseContext,
} from "./parse-common";
import { parseExplore } from "./parse-explore";
import { parseListen } from "./parse-listen";
import { parseWildcard } from "./parse-wildcard";
import type {
  GamePackage,
  SupportedDynamic,
  SupportedDynamicType,
} from "./types";

export type ParsedPackage = Readonly<{
  assetReferences: ReadonlySet<string>;
  descriptorReferences: ReadonlySet<string>;
  game: GamePackage;
}>;

function descriptorPath(files: ArchiveFiles, value: unknown): string {
  const path = boundedString(value, 240);
  if (
    !path.toLowerCase().endsWith(".json") ||
    path.includes("\\") ||
    path.startsWith("/") ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    path === "game.json" ||
    !files.has(path)
  ) {
    packageFailure();
  }
  return path;
}

function dynamicType(value: unknown): SupportedDynamicType {
  if (value !== "LISTEN" && value !== "EXPLORE" && value !== "WILDCARD") {
    packageFailure();
  }
  return value;
}

export function parseGamePackage(
  files: ArchiveFiles,
  imageDimensions: ReadonlyMap<string, ImageDimensions>,
): ParsedPackage {
  const gameBytes = files.get("game.json");
  if (!gameBytes) packageFailure();
  const root = record(parseJson(gameBytes));
  if (root.book !== false) packageFailure();
  const references = array(root.dynamics, 1, MAX_DYNAMICS);
  const dynamicIds = new Set<string>();
  const descriptorReferences = new Set<string>();
  const assets = new Set<string>();
  const context: ParseContext = { assets, files, imageDimensions };
  const dynamics = references.map((value): SupportedDynamic => {
    const reference = record(value);
    const id = boundedString(reference.id, 256);
    const path = descriptorPath(files, reference.json);
    const type = dynamicType(reference.type);
    if (dynamicIds.has(id) || descriptorReferences.has(path)) packageFailure();
    dynamicIds.add(id);
    descriptorReferences.add(path);
    const descriptor = parseJson(files.get(path)!);
    const dynamic =
      type === "LISTEN"
        ? parseListen(context, descriptor)
        : type === "EXPLORE"
          ? parseExplore(context, descriptor)
          : parseWildcard(context, descriptor);
    if (dynamic.id !== id) packageFailure();
    return dynamic;
  });
  return Object.freeze({
    assetReferences: assets,
    descriptorReferences,
    game: Object.freeze({
      book: false,
      dynamics: Object.freeze(dynamics),
      id: boundedString(root.id, 256),
      name: boundedString(root.name, 500),
    }),
  });
}
