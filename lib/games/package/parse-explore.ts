import { packageFailure } from "./errors";
import {
  array,
  boolean,
  parseCommon,
  parseElement,
  record,
  uniqueElements,
  type ParseContext,
} from "./parse-common";
import type { ExploreDynamic } from "./types";

function inactiveCounter(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

export function parseExplore(
  context: ParseContext,
  value: unknown,
): ExploreDynamic {
  const source = record(value);
  const common = parseCommon(context, source);
  if (!common.backgroundImage) packageFailure();
  const dimensions = context.imageDimensions.get(common.backgroundImage);
  if (!dimensions) packageFailure();
  if (!inactiveCounter(source.counter) || !inactiveCounter(source.newCounter)) {
    packageFailure();
  }
  const elements = Object.freeze(
    array(source.elements, 1, 32).map((element) =>
      parseElement(context, element, true),
    ),
  );
  uniqueElements(elements);
  for (const element of elements) {
    for (const frame of element.frames) {
      if (
        frame.x1 >= frame.x2 ||
        frame.y1 >= frame.y2 ||
        frame.x2 > dimensions.width ||
        frame.y2 > dimensions.height
      ) {
        packageFailure();
      }
    }
  }
  return Object.freeze({
    ...common,
    backgroundHeight: dimensions.height,
    backgroundImage: common.backgroundImage,
    backgroundWidth: dimensions.width,
    elements,
    listen: boolean(source.listen),
    type: "EXPLORE",
  });
}
