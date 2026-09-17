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
  const values =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? Object.values(value)
      : null;
  return (
    value === null ||
    value === undefined ||
    values?.length === 0 ||
    (values?.length === 3 &&
      values.filter((item) => item === null).length === 2 &&
      values.filter((item) => Array.isArray(item) && item.length === 0)
        .length === 1)
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
