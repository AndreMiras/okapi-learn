import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

export const FICTIONAL_USERNAME = "family@example.test";
export const FICTIONAL_PASSWORD = "fictional-passphrase";
export const FICTIONAL_TOKEN = "fictional-upstream-token";
export const E2E_FORBIDDEN_BROWSER_VALUES = Object.freeze([
  FICTIONAL_PASSWORD,
  FICTIONAL_TOKEN,
  "learner-nova",
  "learner-milo",
  "course-orbit",
  "course-garden",
  "video-moonlight",
  "audio-rain",
  "Fictional-Surname",
  "2017-01-01",
  "private-learner-id-that-must-be-dropped",
  "media.example.test",
  "images.example.test",
  "games.example.test",
]);

export const E2E_USERS = Object.freeze({
  emptyCatalog: "empty-catalog@example.test",
  longCatalog: "long-catalog@example.test",
  malformedCatalog: "malformed-catalog@example.test",
  media: "media-fixture@example.test",
  mismatchedCourse: "mismatched-course@example.test",
  multipleLearners: "multiple-learners@example.test",
  noLearners: "no-learners@example.test",
  rejected: "rejected@example.test",
  serviceError: "service-error@example.test",
  success: FICTIONAL_USERNAME,
});

function isE2EUsername(value: string): boolean {
  return (
    (Object.values(E2E_USERS) as readonly string[]).includes(value) ||
    /^flow-[a-z0-9-]+@example\.test$/.test(value)
  );
}

export type FixtureScenario =
  | "disconnect"
  | "forbidden"
  | "malformed-json"
  | "oversized"
  | "rate-limited"
  | "rejected"
  | "server-error"
  | "success"
  | "by-username"
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

function responseForUsername(username: string): unknown {
  const base = syntheticAuthenticationResponse();
  if (username === E2E_USERS.media || username.startsWith("flow-media-")) {
    return {
      ...base,
      Courses: [
        {
          ...base.Courses[0],
          Audios: [
            {
              AudioId: "audio-synthetic",
              Description: "A generated tone for browser testing.",
              Duration: "00:01",
              Orden: 1,
              Title: "Synthetic Tone",
              UrlAudio: "http://127.0.0.1:4200/media/ok.wav",
            },
            ...[
              ["Expired fixture", "expired"],
              ["Octet stream fixture", "octet-stream"],
              ["Truncated fixture", "truncated"],
              ["Unsupported fixture", "unsupported"],
              ["Allowed redirect fixture", "redirect-allowed"],
              ["Disallowed redirect fixture", "redirect-disallowed"],
              ["No range fixture", "no-ranges"],
            ].map(([Title, path], index) => ({
              AudioId: `audio-fixture-${index}`,
              Description: null,
              Duration: null,
              Orden: index + 2,
              Title,
              UrlAudio: `http://127.0.0.1:4200/media/${path}`,
            })),
          ],
          Videos: [
            {
              ...base.Courses[0]!.Videos[0],
              Title: "Synthetic Theatre",
              UrlVideo: "http://127.0.0.1:4200/media/ok.wav",
            },
          ],
        },
      ],
    };
  }
  if (username === E2E_USERS.noLearners) {
    return { ...base, Courses: [], Students: [] };
  }
  if (username === E2E_USERS.emptyCatalog) {
    return {
      ...base,
      Courses: [{ ...base.Courses[0], Audios: [], Videos: [] }],
    };
  }
  if (username === E2E_USERS.multipleLearners) {
    return {
      ...base,
      Courses: [
        base.Courses[0],
        {
          Audios: [
            {
              AudioId: "audio-rain",
              Description: null,
              Duration: "01:05",
              Orden: 1,
              Title: "Rain Rhythm",
              UrlAudio: null,
            },
          ],
          CourseId: "course-garden",
          Name: "Garden English",
          Videos: [],
        },
      ],
      Students: [
        base.Students[0],
        {
          CourseId: "course-garden",
          Name: "Milo",
          StudentId: "learner-milo",
        },
      ],
    };
  }
  if (username === E2E_USERS.longCatalog) {
    return {
      ...base,
      Courses: [
        {
          ...base.Courses[0],
          Name: `Course ${"constellation ".repeat(10)}`.trim(),
          Videos: [
            {
              ...base.Courses[0]!.Videos[0],
              Description:
                `A fictional description ${"with generous detail ".repeat(20)}`.trim(),
              Title:
                `Story ${"beyond the brightest horizon ".repeat(8)}`.trim(),
            },
          ],
        },
      ],
      Students: [
        {
          ...base.Students[0],
          Name: `Nova ${"Starfinder ".repeat(8)}`.trim(),
        },
      ],
    };
  }
  if (username === E2E_USERS.mismatchedCourse) {
    return {
      ...base,
      Students: [{ ...base.Students[0], CourseId: "course-missing" }],
    };
  }
  if (username === E2E_USERS.malformedCatalog) {
    return {
      ...base,
      Courses: [{ ...base.Courses[0], Videos: "not-an-array" }],
    };
  }
  return base;
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
  requestedPort = 0,
) {
  const ledger: LedgerEntry[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/__fixture__/ledger") {
      return respond(response, 200, JSON.stringify(ledger));
    }
    const body = await readJson(request);
    const fieldNames =
      body && typeof body === "object" ? Object.keys(body).sort() : [];
    const headerNames = Object.keys(request.headers).sort();
    const expectedBody =
      body !== null &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.keys(body).length === 3 &&
      typeof (body as Record<string, unknown>).Username === "string" &&
      (scenario === "by-username"
        ? isE2EUsername((body as Record<string, unknown>).Username as string)
        : (body as Record<string, unknown>).Username === FICTIONAL_USERNAME) &&
      (body as Record<string, unknown>).PasswordHash === FICTIONAL_PASSWORD &&
      (body as Record<string, unknown>).isTablet === false;
    const acceptedLogout =
      request.method === "POST" &&
      request.url === "/api/Alumnes/LogOut" &&
      request.headers.accept === "application/json" &&
      request.headers["cache-control"] === "no-store" &&
      request.headers.authorization === `Basic ${FICTIONAL_TOKEN}` &&
      body === null;
    const acceptedAuthentication =
      request.method === "POST" &&
      request.url === "/api/Alumnes/AutenticateUser" &&
      request.headers.accept === "application/json" &&
      request.headers["cache-control"] === "no-store" &&
      request.headers["content-type"] === "application/json" &&
      request.headers.authorization === undefined &&
      expectedBody;
    const accepted = acceptedLogout || acceptedAuthentication;

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
    if (acceptedLogout) return respond(response, 200, "{}");

    const username = (body as Record<string, string>).Username;
    if (scenario === "by-username") {
      if (username === E2E_USERS.rejected) return respond(response, 401, "{}");
      if (username === E2E_USERS.serviceError)
        return respond(response, 500, "{}");
      return respond(
        response,
        200,
        JSON.stringify(responseForUsername(username)),
      );
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
    server.listen(requestedPort, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;

  return Object.freeze({
    baseUrl: `http://127.0.0.1:${port}`,
    ledger,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
}
