export type PackageLimits = Readonly<{
  maximumCompressionRatio: number;
  maximumDescriptorBytes: number;
  maximumEntries: number;
  maximumEntryBytes: number;
  maximumExpandedBytes: number;
  maximumPathBytes: number;
  maximumPathDepth: number;
  maximumResponseBytes: number;
}>;

export const MAX_GAME_PACKAGE_BYTES = 25 * 1024 * 1024;

export const PACKAGE_LIMITS: PackageLimits = Object.freeze({
  maximumCompressionRatio: 100,
  maximumDescriptorBytes: 1024 * 1024,
  maximumEntries: 500,
  maximumEntryBytes: 5 * 1024 * 1024,
  maximumExpandedBytes: 50 * 1024 * 1024,
  maximumPathBytes: 240,
  maximumPathDepth: 4,
  maximumResponseBytes: MAX_GAME_PACKAGE_BYTES,
});

export const MAX_DYNAMICS = 64;
export const MAX_ELEMENTS = 32;
export const MAX_FRAMES = 32;
export const MAX_AUDIO_REFERENCES = 16;
