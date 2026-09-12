import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type {
  AuthenticationGraph,
  NormalizedMedia,
} from "@/lib/mylocker/types";

import type { SessionCourse, SessionMedia, SessionRecord } from "./types";

export const SESSION_COOKIE_NAME = "merriloop_session";
export const MAX_ACTIVE_SESSIONS = 500;
const COOKIE_VERSION = "v1";

export type IssuedSession = Readonly<{
  cookieValue: string;
  expiresAt: number;
}>;

export type SessionStore = Readonly<{
  size?: number;
  delete: (
    cookieValue: string | undefined,
  ) => SessionRecord | null | Promise<SessionRecord | null>;
  issue: (graph: AuthenticationGraph) => IssuedSession | Promise<IssuedSession>;
  read: (
    cookieValue: string | undefined,
  ) => SessionRecord | null | Promise<SessionRecord | null>;
}>;

export class SessionCapacityError extends Error {
  constructor() {
    super("Session capacity reached");
    this.name = "SessionCapacityError";
  }
}

type StoreOptions = Readonly<{
  maximumSessions?: number;
  now?: () => number;
  random?: (bytes: number) => Buffer;
  secret: string;
  ttlSeconds: number;
}>;

function stableSortMedia(
  media: readonly NormalizedMedia[],
): readonly NormalizedMedia[] {
  return [...media]
    .map((item, index) => ({ index, item }))
    .sort(
      (left, right) =>
        left.item.order - right.item.order || left.index - right.index,
    )
    .map(({ item }) => item);
}

export class MemorySessionStore {
  readonly #records = new Map<string, SessionRecord>();
  readonly #maximumSessions: number;
  readonly #now: () => number;
  readonly #random: (bytes: number) => Buffer;
  readonly #signingKey: Buffer;
  readonly #storageKey: Buffer;
  readonly #ttlMilliseconds: number;

  constructor(options: StoreOptions) {
    this.#maximumSessions = options.maximumSessions ?? MAX_ACTIVE_SESSIONS;
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    this.#signingKey = createHmac("sha256", options.secret)
      .update("merriloop-cookie-v1")
      .digest();
    this.#storageKey = createHmac("sha256", options.secret)
      .update("merriloop-store-v1")
      .digest();
    this.#ttlMilliseconds = options.ttlSeconds * 1_000;
  }

  get size(): number {
    this.sweep();
    return this.#records.size;
  }

  issue(graph: AuthenticationGraph): IssuedSession {
    this.sweep();
    if (this.#records.size >= this.#maximumSessions)
      throw new SessionCapacityError();

    const issuedAt = this.#now();
    const expiresAt = issuedAt + this.#ttlMilliseconds;
    const sessionId = this.#random(32).toString("base64url");
    const alias = () => this.#random(18).toString("base64url");
    const projectMedia = (item: NormalizedMedia): SessionMedia =>
      Object.freeze({ ...item, alias: alias() });
    const courses: readonly SessionCourse[] = Object.freeze(
      graph.courses.map((course) =>
        Object.freeze({
          audios: Object.freeze(
            stableSortMedia(course.audios).map(projectMedia),
          ),
          id: course.id,
          name: course.name,
          videos: Object.freeze(
            stableSortMedia(course.videos).map(projectMedia),
          ),
        }),
      ),
    );
    const record: SessionRecord = Object.freeze({
      courses,
      expiresAt,
      issuedAt,
      learners: Object.freeze(
        graph.learners.map((learner) =>
          Object.freeze({ ...learner, alias: alias() }),
        ),
      ),
      locale: "en",
      token: graph.token,
    });
    this.#records.set(this.#storageHash(sessionId), record);
    return Object.freeze({
      cookieValue: this.#encode(sessionId, expiresAt),
      expiresAt,
    });
  }

  read(cookieValue: string | undefined): SessionRecord | null {
    const decoded = this.#decode(cookieValue);
    if (!decoded) return null;
    const key = this.#storageHash(decoded.sessionId);
    const record = this.#records.get(key);
    if (
      !record ||
      record.expiresAt !== decoded.expiresAt ||
      record.expiresAt <= this.#now()
    ) {
      if (record) this.#records.delete(key);
      return null;
    }
    return record;
  }

  delete(cookieValue: string | undefined): SessionRecord | null {
    const decoded = this.#decode(cookieValue);
    if (!decoded) return null;
    const key = this.#storageHash(decoded.sessionId);
    const record = this.#records.get(key) ?? null;
    this.#records.delete(key);
    return record;
  }

  sweep(): void {
    const now = this.#now();
    for (const [key, record] of this.#records) {
      if (record.expiresAt <= now) this.#records.delete(key);
    }
  }

  #storageHash(sessionId: string): string {
    return createHmac("sha256", this.#storageKey)
      .update(sessionId)
      .digest("base64url");
  }

  #encode(sessionId: string, expiresAt: number): string {
    const payload = `${COOKIE_VERSION}.${expiresAt}.${sessionId}`;
    const signature = createHmac("sha256", this.#signingKey)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }

  #decode(
    cookieValue: string | undefined,
  ): { expiresAt: number; sessionId: string } | null {
    if (!cookieValue || cookieValue.length > 512) return null;
    const parts = cookieValue.split(".");
    if (parts.length !== 4) return null;
    const [version, expiryText, sessionId, suppliedSignature] = parts;
    if (
      version !== COOKIE_VERSION ||
      !expiryText ||
      !sessionId ||
      !suppliedSignature ||
      !/^[A-Za-z0-9_-]{43}$/.test(sessionId) ||
      !/^\d{1,16}$/.test(expiryText)
    ) {
      return null;
    }
    const expiresAt = Number(expiryText);
    if (!Number.isSafeInteger(expiresAt)) return null;
    const payload = `${version}.${expiryText}.${sessionId}`;
    const expected = createHmac("sha256", this.#signingKey)
      .update(payload)
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(suppliedSignature, "base64url");
    } catch {
      return null;
    }
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return null;
    return { expiresAt, sessionId };
  }
}
