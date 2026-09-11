import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

export const FICTIONAL_USERNAME = "family@example.test";
export const FICTIONAL_PASSWORD = "fictional-passphrase";
export const FICTIONAL_TOKEN = "fictional-upstream-token";

export type FixtureScenario =
  | "disconnect"
  | "forbidden"
  | "malformed-json"
  | "oversized"
  | "rate-limited"
  | "rejected"
  | "server-error"
  | "success"
  | "timeout"
  | "wrong-content-type";

export type LedgerEntry = Readonly<{
  accepted: boolean;
  fieldNames: readonly string[];
  headerNames: readonly string[];
  method: string;
  path: string;
}>;

export function syntheticAuthenticationResponse() {
  return {
    authToken: FICTIONAL_TOKEN,
    Courses: [
      {
        Audios: [],
        CourseId: "course-orbit",
        GameMap: { ignored: true },
        Name: "Orbit English",
        Videos: [
          {
            Description: "A fictional trip through the stars.",
            Duration: "03:15",
            Orden: 2,
            Title: "Moonlight Story",
            UrlVideo: "https://media.example.test/video.mp4?grant=fictional",
            VideoId: "video-moonlight",
            ViewedBy: ["private-learner-id-that-must-be-dropped"],
            ZipUrl: "https://games.example.test/ignored.zip",
          },
        ],
      },
    ],
    ERR_CODE: null,
    GameMapTester: false,
    GameMapsToTest: [],
    GamesToTest: [],
    GameTester: false,
    Students: [
      {
        CourseId: "course-orbit",
        DateOfBirth: "2017-01-01",
        Name: "Nova",
        nivellId: null,
        StudentId: "learner-nova",
        Surname: "Fictional-Surname",
        UrlPhoto: "https://images.example.test/private.jpg",
      },
    ],
    TermsPending: false,
    unknownRoot: "must be dropped",
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function respond(
  response: ServerResponse,
  status: number,
  body: string,
  type = "application/json",
) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": type,
  });
  response.end(body);
}

export async function startSyntheticUpstream(
  scenario: FixtureScenario = "success",
) {
  const ledger: LedgerEntry[] = [];
  const server = createServer(async (request, response) => {
    const body = await readJson(request);
    const fieldNames =
      body && typeof body === "object" ? Object.keys(body).sort() : [];
    const headerNames = Object.keys(request.headers).sort();
    const expectedBody =
      body !== null &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.keys(body).length === 3 &&
      (body as Record<string, unknown>).Username === FICTIONAL_USERNAME &&
      (body as Record<string, unknown>).PasswordHash === FICTIONAL_PASSWORD &&
      (body as Record<string, unknown>).isTablet === false;
    const accepted =
      request.method === "POST" &&
      request.url === "/api/Alumnes/AutenticateUser" &&
      request.headers.accept === "application/json" &&
      request.headers["cache-control"] === "no-store" &&
      request.headers["content-type"] === "application/json" &&
      request.headers.authorization === undefined &&
      expectedBody;

    ledger.push(
      Object.freeze({
        accepted,
        fieldNames: Object.freeze(fieldNames),
        headerNames: Object.freeze(headerNames),
        method: request.method ?? "",
        path: request.url ?? "",
      }),
    );
    if (!accepted) {
      respond(
        response,
        400,
        JSON.stringify({ category: "invalid_fixture_request" }),
      );
      return;
    }

    if (scenario === "disconnect") {
      request.socket.destroy();
      return;
    }
    if (scenario === "timeout") return;
    if (scenario === "rejected") return respond(response, 401, "{}");
    if (scenario === "forbidden") return respond(response, 403, "{}");
    if (scenario === "rate-limited") return respond(response, 429, "{}");
    if (scenario === "server-error") return respond(response, 500, "{}");
    if (scenario === "malformed-json")
      return respond(response, 200, "{not-json");
    if (scenario === "wrong-content-type") {
      return respond(response, 200, "not json", "text/plain");
    }
    if (scenario === "oversized") {
      return respond(
        response,
        200,
        JSON.stringify({ padding: "x".repeat(4_096) }),
      );
    }
    return respond(
      response,
      200,
      JSON.stringify(syntheticAuthenticationResponse()),
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;

  return Object.freeze({
    baseUrl: `http://127.0.0.1:${port}`,
    ledger,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
}
