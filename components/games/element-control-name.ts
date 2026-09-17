import { englishMessages } from "@/lib/i18n/messages/en";

export function pictureControlName(
  label: string | null,
  index: number,
): string {
  const base = `${englishMessages.games.picture} ${index + 1}`;
  return label === null ? base : `${base}: ${label}`;
}

export function hotspotControlName(
  label: string | null,
  elementIndex: number,
  frameIndex: number,
  frameCount: number,
): string {
  const base = `${englishMessages.games.hotspot} ${elementIndex + 1}`;
  const area =
    frameCount > 1 ? `, ${englishMessages.games.area} ${frameIndex + 1}` : "";
  return `${base}${area}${label === null ? "" : `: ${label}`}`;
}
