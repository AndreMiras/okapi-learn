import { createServer, type IncomingMessage } from "node:http";

export type MediaLedgerEntry = Readonly<{
  cookiePresent: boolean;
  method: string;
  path: string;
  rangePresent: boolean;
  referrerPresent: boolean;
  upstreamAuthorizationPresent: boolean;
}>;

function generatedWave(): Buffer {
  const sampleRate = 8_000;
  const samples = sampleRate;
  const data = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    data.writeInt16LE(
      Math.round(Math.sin((index / sampleRate) * 440 * Math.PI * 2) * 2_000),
      index * 2,
    );
  }
  const wave = Buffer.alloc(44 + data.length);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(36 + data.length, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(sampleRate, 24);
  wave.writeUInt32LE(sampleRate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(data.length, 40);
  data.copy(wave, 44);
  return wave;
}

const MEDIA = generatedWave();

function requestPath(request: IncomingMessage): string {
  return new URL(request.url ?? "/", "http://fixture.invalid").pathname;
}

export async function startSyntheticMediaServers() {
  const ledger: MediaLedgerEntry[] = [];
  const redirectTarget = createServer((_request, response) => {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": MEDIA.length,
      "Content-Type": "audio/wav",
    });
    response.end(MEDIA);
  });
  const server = createServer((request, response) => {
    const path = requestPath(request);
    if (path === "/__fixture__/health") {
      response.writeHead(204, { "Cache-Control": "no-store" });
      return response.end();
    }
    if (path === "/__fixture__/ledger") {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      });
      return response.end(JSON.stringify(ledger));
    }
    ledger.push(
      Object.freeze({
        cookiePresent: Boolean(request.headers.cookie),
        method: request.method ?? "",
        path,
        rangePresent: Boolean(request.headers.range),
        referrerPresent: Boolean(request.headers.referer),
        upstreamAuthorizationPresent: Boolean(request.headers.authorization),
      }),
    );
    if (request.method !== "GET" || !path.startsWith("/media/")) {
      response.writeHead(400, { "Cache-Control": "no-store" });
      return response.end();
    }
    if (path === "/media/expired") {
      response.writeHead(403, { "Cache-Control": "no-store" });
      return response.end();
    }
    if (path === "/media/redirect-allowed") {
      response.writeHead(302, { Location: "/media/ok.wav" });
      return response.end();
    }
    if (path === "/media/redirect-disallowed") {
      response.writeHead(302, { Location: "http://127.0.0.1:4201/media.wav" });
      return response.end();
    }
    if (path === "/media/unsupported") {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": 16,
        "Content-Type": "application/x-fictional-media",
      });
      return response.end(Buffer.alloc(16, 255));
    }
    const body = path === "/media/truncated" ? MEDIA.subarray(0, 64) : MEDIA;
    const contentType =
      path === "/media/octet-stream" ? "application/octet-stream" : "audio/wav";
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range && path !== "/media/no-ranges") {
      const start = Number(range[1]);
      const requestedEnd = range[2] ? Number(range[2]) : body.length - 1;
      if (start >= body.length || requestedEnd < start) {
        response.writeHead(416, {
          "Cache-Control": "no-store",
          "Content-Range": `bytes */${body.length}`,
        });
        return response.end();
      }
      const end = Math.min(requestedEnd, body.length - 1);
      const part = body.subarray(start, end + 1);
      response.writeHead(206, {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Content-Length": part.length,
        "Content-Range": `bytes ${start}-${end}/${body.length}`,
        "Content-Type": contentType,
      });
      return response.end(part);
    }
    response.writeHead(200, {
      ...(path === "/media/no-ranges" ? {} : { "Accept-Ranges": "bytes" }),
      "Cache-Control": "no-store",
      "Content-Length": body.length,
      "Content-Type": contentType,
    });
    response.end(body);
  });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(4200, "127.0.0.1", resolve);
    }),
    new Promise<void>((resolve, reject) => {
      redirectTarget.once("error", reject);
      redirectTarget.listen(4201, "127.0.0.1", resolve);
    }),
  ]);
  return Object.freeze({
    close: () =>
      Promise.all([
        new Promise<void>((resolve) => server.close(() => resolve())),
        new Promise<void>((resolve) => redirectTarget.close(() => resolve())),
      ]),
    ledger,
  });
}
