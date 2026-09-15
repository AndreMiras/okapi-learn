import {
  boolean,
  integer,
  optionalImageReference,
  parseCommon,
  record,
  type ParseContext,
} from "./parse-common";
import type { WildcardDynamic } from "./types";

export function parseWildcard(
  context: ParseContext,
  value: unknown,
): WildcardDynamic {
  const source = record(value);
  return Object.freeze({
    ...parseCommon(context, source),
    automatic: boolean(source.automatic),
    nextImage: optionalImageReference(context, source.nextImage),
    position: integer(source.position, -100, 100),
    speaker: boolean(source.speaker),
    type: "WILDCARD",
    waitSeconds: integer(source.waitSeconds, 0, 30),
  });
}
