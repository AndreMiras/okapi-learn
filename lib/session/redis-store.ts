import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { Redis } from "@upstash/redis";

import type { AuthenticationGraph } from "@/lib/mylocker/types";

import {
  MemorySessionStore,
  type IssuedSession,
  type SessionStore,
} from "./store";
import type { SessionRecord } from "./types";

const ENCRYPTION_VERSION = "v2";
const KEY_PREFIX = "merriloop:session:";

type RedisSessionStoreOptions = Readonly<{
  redis: Redis;
  secret: string;
  ttlSeconds: number;
}>;

export class RedisSessionStore implements SessionStore {
  readonly #encryptionKey: Buffer;
  readonly #redis: Redis;
  readonly #secret: string;
  readonly #ttlSeconds: number;

  constructor(options: RedisSessionStoreOptions) {
    this.#redis = options.redis;
    this.#secret = options.secret;
    this.#ttlSeconds = options.ttlSeconds;
    this.#encryptionKey = createHmac("sha256", options.secret)
      .update("merriloop-redis-encryption-v1")
      .digest();
  }

  async issue(graph: AuthenticationGraph): Promise<IssuedSession> {
    // Reuse the existing projection and opaque-cookie format, then move the
    // resulting record into shared storage before returning the cookie.
    const local = new MemorySessionStore({
      secret: this.#secret,
      ttlSeconds: this.#ttlSeconds,
    });
    const issued = local.issue(graph);
    const record = local.read(issued.cookieValue);
    if (!record) throw new Error("Failed to create session record");

    const result = await this.#redis.set(
      this.#key(issued.cookieValue),
      this.#encrypt(record),
      { nx: true, px: this.#ttlSeconds * 1_000 },
    );
    if (result !== "OK") throw new Error("Failed to reserve session key");
    return issued;
  }

  async read(cookieValue: string | undefined): Promise<SessionRecord | null> {
    if (!cookieValue || cookieValue.length > 512) return null;
    const encrypted = await this.#redis.get<string>(this.#key(cookieValue));
    if (!encrypted) return null;
    const record = this.#decrypt(encrypted);
    if (!record || record.expiresAt <= Date.now()) {
      await this.#redis.del(this.#key(cookieValue));
      return null;
    }
    return record;
  }

  async delete(cookieValue: string | undefined): Promise<SessionRecord | null> {
    if (!cookieValue || cookieValue.length > 512) return null;
    const encrypted = await this.#redis.getdel<string>(this.#key(cookieValue));
    return encrypted ? this.#decrypt(encrypted) : null;
  }

  #key(cookieValue: string): string {
    const digest = createHmac("sha256", this.#secret)
      .update("merriloop-redis-key-v1")
      .update(cookieValue)
      .digest("base64url");
    return `${KEY_PREFIX}${digest}`;
  }

  #encrypt(record: SessionRecord): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#encryptionKey, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(record), "utf8"),
      cipher.final(),
    ]);
    return [
      ENCRYPTION_VERSION,
      nonce.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  #decrypt(value: string): SessionRecord | null {
    const [version, nonceText, tagText, ciphertextText, extra] =
      value.split(".");
    if (
      version !== ENCRYPTION_VERSION ||
      !nonceText ||
      !tagText ||
      !ciphertextText ||
      extra
    ) {
      return null;
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.#encryptionKey,
        Buffer.from(nonceText, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tagText, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextText, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      return JSON.parse(plaintext) as SessionRecord;
    } catch {
      return null;
    }
  }
}
