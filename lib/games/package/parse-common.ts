import type { ArchiveFiles } from "./archive";
import { packageFailure } from "./errors";
import { MAX_AUDIO_REFERENCES, MAX_ELEMENTS, MAX_FRAMES } from "./limits";
import type { DynamicCommon, DynamicElement, Frame } from "./types";
import type { ImageDimensions } from "./assets";

const CONTROLS = /[\u0000-\u001f\u007f]/u;
const MAX_JSON_DEPTH = 16;
const MAX_JSON_NODES = 20_000;

export type ParseContext = {
  assets: Set<string>;
  files: ArchiveFiles;
  imageDimensions: ReadonlyMap<string, ImageDimensions>;
};

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    packageFailure();
  }
  return value as Record<string, unknown>;
}

export function boundedString(value: unknown, maximumLength: number): string {
  if (
    typeof value !== "string" ||
    value.length > maximumLength ||
    CONTROLS.test(value)
  ) {
    packageFailure();
  }
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) packageFailure();
  return normalized;
}

function optionalElementLabel(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 200 || CONTROLS.test(value)) {
    return null;
  }
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized || null;
}

export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") packageFailure();
  return value;
}

export function integer(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    packageFailure();
  }
  return value as number;
}

export function array(
  value: unknown,
  minimum: number,
  maximum: number,
): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > maximum
  ) {
    packageFailure();
  }
  return value;
}

function assertStructure(value: unknown): void {
  const pending = [{ depth: 0, value }];
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    nodes += 1;
    if (nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH)
      packageFailure();
    if (Array.isArray(current.value)) {
      if (current.value.length > 128) packageFailure();
      for (const child of current.value)
        pending.push({ depth: current.depth + 1, value: child });
    } else if (typeof current.value === "object" && current.value !== null) {
      const values = Object.values(current.value);
      if (values.length > 128) packageFailure();
      for (const child of values)
        pending.push({ depth: current.depth + 1, value: child });
    }
  }
}

export function parseJson(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    packageFailure();
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    packageFailure();
  }
  assertStructure(value);
  return value;
}

function reference(
  context: ParseContext,
  value: unknown,
  extensions: ReadonlySet<string>,
): string {
  const path = boundedString(value, 240);
  const dot = path.lastIndexOf(".");
  if (
    path.includes("\\") ||
    path.startsWith("/") ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    !extensions.has(path.slice(dot).toLowerCase()) ||
    !context.files.has(path)
  ) {
    packageFailure();
  }
  context.assets.add(path);
  return path;
}

export function imageReference(context: ParseContext, value: unknown): string {
  return reference(context, value, new Set([".png"]));
}

export function optionalImageReference(
  context: ParseContext,
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  return imageReference(context, value);
}

export function audioReferences(
  context: ParseContext,
  value: unknown,
): readonly string[] {
  if (value === null || value === undefined) return Object.freeze([]);
  return Object.freeze(
    array(value, 0, MAX_AUDIO_REFERENCES).map((item) =>
      reference(context, item, new Set([".mp3", ".m4a"])),
    ),
  );
}

export function parseCommon(
  context: ParseContext,
  value: Record<string, unknown>,
): DynamicCommon {
  const rgb = value.rgb;
  if (
    rgb !== null &&
    rgb !== undefined &&
    rgb !== "" &&
    (typeof rgb !== "string" || !/^#?[0-9a-f]{6}$/iu.test(rgb))
  )
    packageFailure();
  return Object.freeze({
    backgroundImage: optionalImageReference(context, value.backgroundImage),
    errorSound: audioReferences(context, value.errorSound),
    finalSound: audioReferences(context, value.finalSound),
    id: boundedString(value.id, 256),
    initialSound: audioReferences(context, value.initialSound),
    name: boundedString(value.name, 500),
    okSound: audioReferences(context, value.okSound),
    rgb:
      typeof rgb === "string" && rgb
        ? `#${rgb.replace(/^#/u, "").toUpperCase()}`
        : null,
    textureImage: optionalImageReference(context, value.textureImage),
  });
}

export function parseElement(
  context: ParseContext,
  value: unknown,
  framesRequired: boolean,
): DynamicElement {
  const source = record(value);
  const framesValue = source.frames;
  const frames =
    framesValue === null || framesValue === undefined
      ? []
      : array(framesValue, framesRequired ? 1 : 0, MAX_FRAMES).map(
          (item): Frame => {
            const frame = record(item);
            return Object.freeze({
              x1: integer(frame.x1, 0, Number.MAX_SAFE_INTEGER),
              x2: integer(frame.x2, 0, Number.MAX_SAFE_INTEGER),
              y1: integer(frame.y1, 0, Number.MAX_SAFE_INTEGER),
              y2: integer(frame.y2, 0, Number.MAX_SAFE_INTEGER),
            });
          },
        );
  if (framesRequired && !frames.length) packageFailure();
  return Object.freeze({
    errorSound: audioReferences(context, source.errorSound),
    frames: Object.freeze(frames),
    id: boundedString(source.Id, 256),
    image: imageReference(context, source.image),
    initialSound: audioReferences(context, source.initialSound),
    label: optionalElementLabel(source.Name),
    okSound: audioReferences(context, source.okSound),
  });
}

export function uniqueElements(elements: readonly DynamicElement[]): void {
  if (elements.length > MAX_ELEMENTS) packageFailure();
  const ids = new Set<string>();
  for (const element of elements) {
    if (ids.has(element.id)) packageFailure();
    ids.add(element.id);
  }
}
