import "server-only";

import { parseServerConfig } from "./environment";

let cachedConfig: ReturnType<typeof parseServerConfig> | undefined;

export function getServerConfig() {
  cachedConfig ??= parseServerConfig(process.env);
  return cachedConfig;
}
