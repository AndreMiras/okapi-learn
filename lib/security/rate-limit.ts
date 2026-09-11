import "server-only";

import { createHmac } from "node:crypto";

const WINDOW_MS = 5 * 60 * 1_000;
const MAX_ATTEMPTS = 10;
const MAX_KEYS = 2_000;

type Entry = { count: number; resetAt: number };

export class LoginRateLimiter {
  readonly #entries = new Map<string, Entry>();
  readonly #key: string;
  readonly #now: () => number;

  constructor(secret: string, now: () => number = Date.now) {
    this.#key = secret;
    this.#now = now;
  }

  allow(ip: string, username: string): boolean {
    this.#sweep();
    const usernameKey = createHmac("sha256", this.#key)
      .update(username.trim().toLocaleLowerCase("en"))
      .digest("base64url");
    return this.#consume(`ip:${ip}`) && this.#consume(`user:${usernameKey}`);
  }

  #consume(key: string): boolean {
    const now = this.#now();
    const current = this.#entries.get(key);
    if (!current || current.resetAt <= now) {
      if (this.#entries.size >= MAX_KEYS) return false;
      this.#entries.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }
    if (current.count >= MAX_ATTEMPTS) return false;
    current.count += 1;
    return true;
  }

  #sweep(): void {
    const now = this.#now();
    for (const [key, entry] of this.#entries) {
      if (entry.resetAt <= now) this.#entries.delete(key);
    }
  }
}
