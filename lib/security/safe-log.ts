type SafeOperation =
  "configuration" | "health" | "login" | "logout" | "session" | "upstream";
type SafeStatus = "failure" | "success";

export type SafeLogEvent = Readonly<{
  category?: string;
  correlationId: string;
  durationMs: number;
  operation: SafeOperation;
  status: SafeStatus;
}>;

export function serializeSafeLog(event: SafeLogEvent): string {
  return JSON.stringify({
    category: event.category,
    correlationId: event.correlationId,
    durationMs: Math.max(0, Math.round(event.durationMs)),
    operation: event.operation,
    status: event.status,
  });
}
