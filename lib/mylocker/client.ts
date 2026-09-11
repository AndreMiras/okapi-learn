import "server-only";

import { getServerConfig } from "@/lib/config/server";

import { UpstreamError } from "./errors";
import { normalizeAuthenticationResponse } from "./normalize";
import type { AuthenticationGraph, LoginCredentials } from "./types";

const AUTHENTICATION_PATH = "/api/Alumnes/AutenticateUser";
const LOGOUT_PATH = "/api/Alumnes/LogOut";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1_000_000;

export type UpstreamClientOptions = Readonly<{
  apiBaseUrl: string;
  maxResponseBytes?: number;
  timeoutMs?: number;
}>;

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > maximumBytes) {
    throw new UpstreamError("invalid_response");
  }
  if (!response.body) throw new UpstreamError("invalid_response");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteCount = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > maximumBytes) {
        await reader.cancel();
        throw new UpstreamError("invalid_response");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError("invalid_response");
  }
  return body;
}

function mapStatus(status: number): never {
  if (status === 401) throw new UpstreamError("authentication_rejected");
  if (status === 403) throw new UpstreamError("forbidden");
  if (status === 429) throw new UpstreamError("rate_limited");
  throw new UpstreamError("unavailable");
}

export function createUpstreamClient(options: UpstreamClientOptions) {
  const endpoint = new URL(AUTHENTICATION_PATH, `${options.apiBaseUrl}/`);
  const timeoutMs = Math.min(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  const maxResponseBytes = Math.min(
    options.maxResponseBytes ?? MAX_RESPONSE_BYTES,
    MAX_RESPONSE_BYTES,
  );

  return Object.freeze({
    async authenticate(
      credentials: LoginCredentials,
    ): Promise<AuthenticationGraph> {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          body: JSON.stringify({
            Username: credentials.username,
            PasswordHash: credentials.password,
            isTablet: false,
          }),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          },
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "AbortError" || error.name === "TimeoutError")
        ) {
          throw new UpstreamError("timeout");
        }
        throw new UpstreamError("unavailable");
      }

      if (!response.ok) mapStatus(response.status);
      const contentType = response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim();
      if (contentType !== "application/json")
        throw new UpstreamError("invalid_response");
      const body = await readBoundedBody(response, maxResponseBytes);
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new UpstreamError("invalid_response");
      }
      return normalizeAuthenticationResponse(payload);
    },
    async logout(token: string): Promise<void> {
      const logoutEndpoint = new URL(LOGOUT_PATH, `${options.apiBaseUrl}/`);
      try {
        await fetch(logoutEndpoint, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Basic ${token}`,
            "Cache-Control": "no-store",
          },
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.timeout(Math.min(timeoutMs, 5_000)),
        });
      } catch {
        // Local logout is authoritative; upstream logout is best effort.
      }
    },
  });
}

export function authenticate(
  credentials: LoginCredentials,
): Promise<AuthenticationGraph> {
  const { apiBaseUrl } = getServerConfig();
  return createUpstreamClient({ apiBaseUrl }).authenticate(credentials);
}

export function logout(token: string): Promise<void> {
  const { apiBaseUrl } = getServerConfig();
  return createUpstreamClient({ apiBaseUrl, timeoutMs: 5_000 }).logout(token);
}
