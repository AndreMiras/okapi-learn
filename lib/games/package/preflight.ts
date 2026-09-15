import { extractValidatedArchive } from "./archive";
import { GameAssetRegistry, inspectPackageAssets } from "./assets";
import { PackageError, packageFailure, throwIfAborted } from "./errors";
import { parseGamePackage } from "./parse-game";
import type { PreparedGame } from "./types";

export async function prepareGamePackage(
  bytes: ArrayBuffer,
  signal: AbortSignal,
): Promise<PreparedGame> {
  let assets: GameAssetRegistry | undefined;
  try {
    const files = await extractValidatedArchive(bytes, signal);
    throwIfAborted(signal);
    if (
      [...files.keys()].filter(
        (path) => path === "game.json" || path.endsWith("/game.json"),
      ).length !== 1
    ) {
      packageFailure();
    }
    const imageDimensions = await inspectPackageAssets(files, signal);
    const parsed = parseGamePackage(files, imageDimensions);
    const used = new Set([
      "game.json",
      ...parsed.descriptorReferences,
      ...parsed.assetReferences,
    ]);
    if ([...files.keys()].some((path) => !used.has(path))) packageFailure();
    assets = new GameAssetRegistry(files, parsed.assetReferences);
    throwIfAborted(signal);
    return Object.freeze({ assets, game: parsed.game });
  } catch (error) {
    assets?.dispose();
    if (error instanceof PackageError) throw error;
    packageFailure();
  }
}
