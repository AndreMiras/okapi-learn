import {
  boolean,
  integer,
  optionalImageReference,
  parseCommon,
  record,
  type ParseContext,
} from "./parse-common";
import type { WildcardDynamic } from "./types";

function position(value: unknown): number {
  const normalized =
    typeof value === "string" && /^-?(?:0|[1-9]\d*)$/u.test(value)
      ? Number(value)
      : value;
  return integer(normalized, -100, 100);
}

export function parseWildcard(
  context: ParseContext,
  value: unknown,
): WildcardDynamic {
  const source = record(value);
  return Object.freeze({
    ...parseCommon(context, source),
    automatic: boolean(source.automatic),
    nextImage: optionalImageReference(context, source.nextImage),
    position: position(source.position),
    speaker: boolean(source.speaker),
    type: "WILDCARD",
    waitSeconds: integer(source.waitSeconds, 0, 30),
  });
}
