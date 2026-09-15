import { packageFailure } from "./errors";
import {
  array,
  boolean,
  integer,
  parseCommon,
  parseElement,
  record,
  uniqueElements,
  type ParseContext,
} from "./parse-common";
import type { ListenDynamic } from "./types";

export function parseListen(
  context: ParseContext,
  value: unknown,
): ListenDynamic {
  const source = record(value);
  const common = parseCommon(context, source);
  const selectableElements = Object.freeze(
    array(source.selectableElements, 1, 8).map((element) =>
      parseElement(context, element, false),
    ),
  );
  const fuzzyElements = Object.freeze(
    array(source.fuzzyElements, 0, 7).map((element) =>
      parseElement(context, element, false),
    ),
  );
  if (
    integer(source.selectableElementsCount, 0, 8) !==
      selectableElements.length ||
    integer(source.fuzzyElementsCount, 0, 7) !== fuzzyElements.length ||
    selectableElements.length + fuzzyElements.length < 2 ||
    selectableElements.length + fuzzyElements.length > 8 ||
    selectableElements.some(({ initialSound }) => initialSound.length === 0)
  ) {
    packageFailure();
  }
  uniqueElements([...selectableElements, ...fuzzyElements]);
  return Object.freeze({
    ...common,
    fuzzyElements,
    random: boolean(source.random),
    selectableElements,
    type: "LISTEN",
  });
}
