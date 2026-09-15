import { createServer } from "node:http";

import {
  createFictionalDescriptors,
  createFictionalGameEntries,
  createFictionalGameZip,
  createGameZip,
} from "./games.ts";
import { startSyntheticMediaServers } from "./media.ts";
import { startSyntheticUpstream } from "./upstream.ts";

const packageOrigin = "http://127.0.0.1:4300";
const unsupportedDescriptors = structuredClone(createFictionalDescriptors());
(
  unsupportedDescriptors["game.json"] as { dynamics: Array<{ type: string }> }
).dynamics[0]!.type = "BOARD";
const packages = new Map<string, Buffer>([
  ["/objects/mixed.zip", Buffer.from(await createFictionalGameZip())],
  [
    "/objects/unsupported.zip",
    Buffer.from(
      await createGameZip(createFictionalGameEntries(unsupportedDescriptors)),
    ),
  ],
  ["/objects/retry-malformed.zip", Buffer.from([0x50, 0x4b, 0x03, 0x04])],
]);
const packageLedger: Array<{
  accepted: boolean;
  headerNames: string[];
  method: string;
  path: string;
}> = [];
let retryAdvanced = false;
const packageServer = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/__fixture__/ledger") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(packageLedger));
    return;
  }
  if (request.method === "POST" && request.url === "/__fixture__/reset") {
    packageLedger.length = 0;
    retryAdvanced = false;
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === "POST" && request.url === "/__fixture__/advance") {
    retryAdvanced = true;
    response.writeHead(204);
    response.end();
    return;
  }
  const bytes = request.url ? packages.get(request.url) : undefined;
  const accepted =
    request.method === "GET" &&
    bytes !== undefined &&
    request.headers.accept === "application/octet-stream, application/zip" &&
    request.headers["cache-control"] === "no-store" &&
    request.headers.authorization === undefined &&
    request.headers.cookie === undefined &&
    request.headers.forwarded === undefined &&
    request.headers["x-forwarded-for"] === undefined &&
    request.headers.referer === undefined;
  packageLedger.push({
    accepted,
    headerNames: Object.keys(request.headers).sort(),
    method: request.method ?? "",
    path: request.url ?? "",
  });
  if (!accepted || !bytes) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "invalid_fixture_request" }));
    return;
  }
  if (request.url === "/objects/retry-malformed.zip" && !retryAdvanced) {
    response.writeHead(503, { "Cache-Control": "no-store" });
    response.end();
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": bytes.byteLength,
    "Content-Type": "application/zip",
  });
  response.end(bytes);
});
await new Promise<void>((resolve, reject) => {
  packageServer.once("error", reject);
  packageServer.listen(4300, "127.0.0.1", resolve);
});

const fixture = await startSyntheticUpstream(
  "by-username",
  4100,
  packageOrigin,
);
const media = await startSyntheticMediaServers();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await fixture.close();
    await media.close();
    await new Promise<void>((resolve) => packageServer.close(() => resolve()));
    process.exit(0);
  });
}
