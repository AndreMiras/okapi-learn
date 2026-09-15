import "server-only";

import { createHmac } from "node:crypto";

const WINDOW_MS = 60_000;
const MAX_STARTS = 6;
const MAX_CONCURRENT = 2;
const MAX_KEYS = 2_000;

type Entry = { count: number; resetAt: number };

type GameRateLimiterOptions = Readonly<{
  maximumConcurrent?: number;
  maximumKeys?: number;
  maximumStarts?: number;
  now?: () => number;
  secret: string;
  windowMs?: number;
}>;

export class GameRateLimiter {
  readonly #entries = new Map<string, Entry>();
  readonly #key: string;
  readonly #maximumConcurrent: number;
  readonly #maximumKeys: number;
  readonly #maximumStarts: number;
  readonly #now: () => number;
  readonly #windowMs: number;
  #concurrent = 0;

  constructor(options: GameRateLimiterOptions) {
    this.#key = options.secret;
    this.#maximumConcurrent = options.maximumConcurrent ?? MAX_CONCURRENT;
    this.#maximumKeys = options.maximumKeys ?? MAX_KEYS;
    this.#maximumStarts = options.maximumStarts ?? MAX_STARTS;
    this.#now = options.now ?? Date.now;
    this.#windowMs = options.windowMs ?? WINDOW_MS;
  }

  acquire(cookieValue: string): (() => void) | null {
    this.#sweep();
    if (this.#concurrent >= this.#maximumConcurrent) return null;
    const key = createHmac("sha256", this.#key)
      .update(cookieValue)
      .digest("base64url");
    const now = this.#now();
    const current = this.#entries.get(key);
    if (current && current.resetAt > now) {
      if (current.count >= this.#maximumStarts) return null;
      current.count += 1;
    } else {
      if (!current && this.#entries.size >= this.#maximumKeys) return null;
      this.#entries.set(key, { count: 1, resetAt: now + this.#windowMs });
    }

    this.#concurrent += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#concurrent -= 1;
    };
  }

  #sweep(): void {
    const now = this.#now();
    for (const [key, entry] of this.#entries) {
      if (entry.resetAt <= now) this.#entries.delete(key);
    }
  }
}
