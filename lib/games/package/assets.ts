import { packageFailure, throwIfAborted } from "./errors";
import type { ArchiveFiles } from "./archive";

export type ImageDimensions = Readonly<{ height: number; width: number }>;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_IMAGE_DIMENSION = 8_192;
const MAX_IMAGE_PIXELS = 32 * 1024 * 1024;

function extension(path: string): string {
  return path.slice(path.lastIndexOf(".")).toLowerCase();
}

function hasBytes(
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[],
) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function pngDimensions(bytes: Uint8Array): ImageDimensions {
  if (bytes.byteLength < 45 || !hasBytes(bytes, 0, PNG_SIGNATURE)) {
    packageFailure();
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawIdat = false;
  let sawIend = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.byteLength) packageFailure();
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (offset === 8) {
      if (type !== "IHDR" || length !== 13) packageFailure();
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      if (
        !(
          (bitDepth === 8 && [0, 2, 3, 4, 6].includes(colorType!)) ||
          (bitDepth === 1 && colorType === 3)
        ) ||
        bytes[offset + 18] !== 0 ||
        bytes[offset + 19] !== 0 ||
        bytes[offset + 20] !== 0
      ) {
        packageFailure();
      }
    } else if (type === "IHDR") {
      packageFailure();
    }
    if (type === "IDAT") sawIdat = true;
    if (type === "IEND") {
      if (length !== 0 || end !== bytes.byteLength) packageFailure();
      sawIend = true;
      break;
    }
    offset = end;
  }
  if (
    !sawIdat ||
    !sawIend ||
    !width ||
    !height ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    packageFailure();
  }
  return Object.freeze({ height, width });
}

async function decodePng(
  bytes: Uint8Array<ArrayBuffer>,
  signal: AbortSignal,
): Promise<ImageDimensions> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      const dimensions = { height: bitmap.height, width: bitmap.width };
      bitmap.close();
      return dimensions;
    } catch {
      // Safari support and headless decoder behavior vary; use the image element path.
    }
  }
  if (typeof Image === "undefined") packageFailure();
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  try {
    return await new Promise<ImageDimensions>((resolve, reject) => {
      const image = new Image();
      const cleanup = () => signal.removeEventListener("abort", abort);
      const abort = () => {
        image.src = "";
        cleanup();
        reject(new Error("aborted"));
      };
      image.onload = () => {
        cleanup();
        resolve({ height: image.naturalHeight, width: image.naturalWidth });
      };
      image.onerror = () => {
        cleanup();
        reject(new Error("decode"));
      };
      signal.addEventListener("abort", abort, { once: true });
      image.src = url;
    });
  } catch {
    throwIfAborted(signal);
    packageFailure();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function inspectPackageAssets(
  files: ArchiveFiles,
  signal: AbortSignal,
): Promise<ReadonlyMap<string, ImageDimensions>> {
  const dimensions = new Map<string, ImageDimensions>();
  for (const [path, bytes] of files) {
    throwIfAborted(signal);
    const kind = extension(path);
    if (kind === ".json") continue;
    if (kind === ".png") {
      const size = pngDimensions(bytes);
      const decoded = await decodePng(bytes, signal);
      if (decoded.width !== size.width || decoded.height !== size.height) {
        packageFailure();
      }
      dimensions.set(path, size);
      continue;
    }
    if (kind === ".mp3") {
      const id3 =
        bytes.byteLength >= 10 && hasBytes(bytes, 0, [0x49, 0x44, 0x33]);
      const frame =
        bytes.byteLength >= 4 &&
        bytes[0] === 0xff &&
        (bytes[1]! & 0xe0) === 0xe0 &&
        (bytes[1]! & 0x06) !== 0;
      if (!id3 && !frame) packageFailure();
      continue;
    }
    if (kind === ".m4a") {
      if (
        bytes.byteLength < 16 ||
        !hasBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70])
      ) {
        packageFailure();
      }
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      const boxSize = view.getUint32(0);
      if (boxSize < 16 || boxSize > bytes.byteLength) packageFailure();
      for (let index = 8; index < 12; index += 1) {
        const value = bytes[index]!;
        if (value < 0x20 || value > 0x7e) packageFailure();
      }
      continue;
    }
    packageFailure();
  }
  return dimensions;
}

const MIME_TYPES = Object.freeze({
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
} as const);

export class GameAssetRegistry {
  readonly #bytes = new Map<string, Uint8Array<ArrayBuffer>>();
  readonly #urls = new Map<string, string>();
  #disposed = false;

  constructor(files: ArchiveFiles, references: ReadonlySet<string>) {
    for (const path of references) {
      const bytes = files.get(path);
      if (!bytes || extension(path) === ".json") packageFailure();
      this.#bytes.set(path, bytes);
    }
  }

  getUrl(path: string): string {
    if (this.#disposed) packageFailure();
    const current = this.#urls.get(path);
    if (current) return current;
    const bytes = this.#bytes.get(path);
    const mime = MIME_TYPES[extension(path) as keyof typeof MIME_TYPES];
    if (!bytes || !mime) packageFailure();
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    this.#urls.set(path, url);
    return url;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const url of this.#urls.values()) URL.revokeObjectURL(url);
    this.#urls.clear();
    this.#bytes.clear();
  }
}
