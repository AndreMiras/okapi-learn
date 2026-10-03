import { packageFailure } from "./errors";
import {
  array,
  audioReferences,
  boundedString,
  integer,
  optionalElementLabel,
  optionalImageReference,
  parseCommon,
  parseElement,
  parseFrames,
  record,
  uniqueElements,
  validateFramesWithinBackground,
  type ParseContext,
} from "./parse-common";
import type { PaintColour, PaintDynamic, PaintTarget } from "./types";

const MAX_NUMERIC_COLOUR_ID = 1_000_000;

function colourId(value: unknown): string {
  if (typeof value === "number")
    return String(integer(value, 0, MAX_NUMERIC_COLOUR_ID));
  return boundedString(value, 256);
}

function parseColour(context: ParseContext, value: unknown): PaintColour {
  const source = record(value);
  return Object.freeze({
    errorSound: audioReferences(context, source.errorSound),
    frames: parseFrames(source.frames, true),
    id: colourId(source.id ?? source.Id),
    image: optionalImageReference(context, source.image),
    initialSound: audioReferences(context, source.initialSound),
    label: optionalElementLabel(source.Name),
    okSound: audioReferences(context, source.okSound),
  });
}

export function parsePaint(
  context: ParseContext,
  value: unknown,
): PaintDynamic {
  const source = record(value);
  const common = parseCommon(context, source);
  if (!common.backgroundImage) packageFailure();
  const dimensions = context.imageDimensions.get(common.backgroundImage);
  if (!dimensions) packageFailure();

  const colours = Object.freeze(
    array(source.colours, 2, 16).map((item) => parseColour(context, item)),
  );
  const elements = Object.freeze(
    array(source.elements, 1, 32).map((item): PaintTarget => {
      const target = record(item);
      return Object.freeze({
        ...parseElement(context, target, true),
        colourId: colourId(target.colour),
      });
    }),
  );
  uniqueElements(colours);
  uniqueElements(elements);
  validateFramesWithinBackground([...colours, ...elements], dimensions);

  const ids = new Set<string>();
  for (const colour of colours) {
    const id = colour.id.toLowerCase();
    if (ids.has(id)) packageFailure();
    ids.add(id);
  }
  for (const target of elements) {
    if (!ids.has(target.colourId.toLowerCase())) packageFailure();
  }

  return Object.freeze({
    ...common,
    backgroundHeight: dimensions.height,
    backgroundImage: common.backgroundImage,
    backgroundWidth: dimensions.width,
    colours,
    elements,
    type: "PAINT",
  });
}
