import { startSyntheticUpstream } from "./upstream.ts";
import { startSyntheticMediaServers } from "./media.ts";

const fixture = await startSyntheticUpstream("by-username", 4100);
const media = await startSyntheticMediaServers();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await fixture.close();
    await media.close();
    process.exit(0);
  });
}
