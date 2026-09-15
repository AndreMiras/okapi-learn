import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  type Entry,
} from "@zip.js/zip.js";

import { PackageError, packageFailure, throwIfAborted } from "./errors";
import { PACKAGE_LIMITS, type PackageLimits } from "./limits";

export type ArchiveFiles = ReadonlyMap<string, Uint8Array<ArrayBuffer>>;

const ALLOWED_EXTENSIONS = new Set([".json", ".m4a", ".mp3", ".png"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const DRIVE_PREFIX = /^[A-Za-z]:/u;

function extension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? "" : path.slice(dot).toLowerCase();
}

function assertClassicSingleDiskArchive(bytes: ArrayBuffer): void {
  const view = new DataView(bytes);
  const minimumOffset = Math.max(0, bytes.byteLength - 65_557);
  let endOffset = -1;
  for (
    let offset = bytes.byteLength - 22;
    offset >= minimumOffset;
    offset -= 1
  ) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === bytes.byteLength
    ) {
      endOffset = offset;
      break;
    }
  }
  if (
    endOffset < 0 ||
    view.getUint16(endOffset + 4, true) !== 0 ||
    view.getUint16(endOffset + 6, true) !== 0 ||
    view.getUint16(endOffset + 8, true) === 0xffff ||
    view.getUint16(endOffset + 10, true) === 0xffff ||
    view.getUint32(endOffset + 12, true) === 0xffffffff ||
    view.getUint32(endOffset + 16, true) === 0xffffffff ||
    (endOffset >= 20 && view.getUint32(endOffset - 20, true) === 0x07064b50)
  ) {
    packageFailure();
  }
}

function collisionKey(value: string): string {
  return value.normalize("NFC").toUpperCase().toLowerCase();
}

function validatePath(path: string, directory: boolean, limits: PackageLimits) {
  if (
    !path ||
    CONTROL_CHARACTERS.test(path) ||
    path.includes("\\") ||
    path.startsWith("/") ||
    DRIVE_PREFIX.test(path) ||
    new TextEncoder().encode(path).byteLength > limits.maximumPathBytes
  ) {
    packageFailure();
  }
  const withoutTrailingSlash =
    directory && path.endsWith("/") ? path.slice(0, -1) : path;
  const parts = withoutTrailingSlash.split("/");
  if (
    !withoutTrailingSlash ||
    parts.length > limits.maximumPathDepth ||
    parts.some((part) => !part || part === "." || part === "..") ||
    (directory && !path.endsWith("/")) ||
    (!directory && path.endsWith("/"))
  ) {
    packageFailure();
  }
  if (!directory && !ALLOWED_EXTENSIONS.has(extension(path))) packageFailure();
}

function validateEntry(entry: Entry, limits: PackageLimits): void {
  validatePath(entry.filename, entry.directory, limits);
  if (
    entry.encrypted ||
    entry.zip64 ||
    entry.diskNumberStart !== 0 ||
    entry.symlink ||
    (!entry.directory && entry.executable) ||
    (entry.directory &&
      (entry.compressionMethod !== 0 ||
        entry.compressedSize !== 0 ||
        entry.uncompressedSize !== 0)) ||
    (!entry.directory &&
      entry.compressionMethod !== 0 &&
      entry.compressionMethod !== 8) ||
    entry.compressedSize < 0 ||
    entry.uncompressedSize < 0 ||
    !Number.isSafeInteger(entry.compressedSize) ||
    !Number.isSafeInteger(entry.uncompressedSize) ||
    entry.uncompressedSize > limits.maximumEntryBytes ||
    (extension(entry.filename) === ".json" &&
      entry.uncompressedSize > limits.maximumDescriptorBytes) ||
    (entry.uncompressedSize > 0 && entry.compressedSize === 0) ||
    (entry.compressedSize > 0 &&
      entry.uncompressedSize / entry.compressedSize >
        limits.maximumCompressionRatio)
  ) {
    packageFailure();
  }
}

export async function extractValidatedArchive(
  bytes: ArrayBuffer,
  signal: AbortSignal,
  limits: PackageLimits = PACKAGE_LIMITS,
): Promise<ArchiveFiles> {
  throwIfAborted(signal);
  if (bytes.byteLength > limits.maximumResponseBytes) packageFailure();
  assertClassicSingleDiskArchive(bytes);
  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(bytes)), {
    filenameEncoding: "utf-8",
    filenameValidation: "strict",
    strictness: "strict",
    useWebWorkers: false,
  });
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  try {
    const entries: Entry[] = [];
    for await (const entry of reader.getEntriesGenerator()) {
      throwIfAborted(signal);
      entries.push(entry);
      if (entries.length > limits.maximumEntries) packageFailure();
    }
    if (!entries.length || reader.warnings?.length) packageFailure();

    const normalizedNames = new Set<string>();
    const foldedNames = new Set<string>();
    let totalCompressed = 0;
    let totalExpanded = 0;
    for (const entry of entries) {
      validateEntry(entry, limits);
      const normalized = entry.filename.normalize("NFC");
      const folded = collisionKey(normalized);
      if (normalizedNames.has(normalized) || foldedNames.has(folded)) {
        packageFailure();
      }
      normalizedNames.add(normalized);
      foldedNames.add(folded);
      if (!entry.directory) {
        totalCompressed += entry.compressedSize;
        totalExpanded += entry.uncompressedSize;
        if (
          !Number.isSafeInteger(totalCompressed) ||
          !Number.isSafeInteger(totalExpanded) ||
          totalExpanded > limits.maximumExpandedBytes
        ) {
          packageFailure();
        }
      }
    }
    if (
      totalExpanded > 0 &&
      (totalCompressed === 0 ||
        totalExpanded / totalCompressed > limits.maximumCompressionRatio)
    ) {
      packageFailure();
    }

    for (const entry of entries) {
      throwIfAborted(signal);
      if (entry.directory) continue;
      const data = await entry.getData(new Uint8ArrayWriter(), {
        checkCrc32: true,
        checkOverlappingEntry: true,
        signal,
        useWebWorkers: false,
      });
      if (entry.warnings?.length) packageFailure();
      if (data.byteLength !== entry.uncompressedSize) packageFailure();
      files.set(entry.filename, data);
    }
    return files;
  } catch (error) {
    files.clear();
    if (error instanceof PackageError) throw error;
    if (signal.aborted) throw new PackageError("aborted");
    packageFailure();
  } finally {
    await reader.close().catch(() => undefined);
  }
}
