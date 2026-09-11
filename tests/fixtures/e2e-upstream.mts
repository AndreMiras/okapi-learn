import { startSyntheticUpstream } from "./upstream.ts";

const fixture = await startSyntheticUpstream("by-username", 4100);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await fixture.close();
    process.exit(0);
  });
}
