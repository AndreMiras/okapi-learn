import "server-only";

import { englishMessages } from "./messages/en";

export const defaultLocale = "en" as const;

export function getMessages() {
  return englishMessages;
}
