export type UpstreamErrorCategory =
  | "authentication_rejected"
  | "forbidden"
  | "invalid_response"
  | "rate_limited"
  | "timeout"
  | "unavailable";

const SAFE_MESSAGES: Record<UpstreamErrorCategory, string> = {
  authentication_rejected: "Sign-in was not accepted.",
  forbidden: "The account cannot be used here.",
  invalid_response: "The service returned an unusable response.",
  rate_limited: "Too many requests. Please wait before trying again.",
  timeout: "The service took too long to respond.",
  unavailable: "The service is temporarily unavailable.",
};

export class UpstreamError extends Error {
  readonly category: UpstreamErrorCategory;

  constructor(category: UpstreamErrorCategory) {
    super(SAFE_MESSAGES[category]);
    this.name = "UpstreamError";
    this.category = category;
  }
}

export function isUpstreamError(value: unknown): value is UpstreamError {
  return value instanceof UpstreamError;
}
