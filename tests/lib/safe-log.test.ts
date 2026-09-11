import { describe, expect, it } from "vitest";

import { serializeSafeLog } from "@/lib/security/safe-log";

describe("serializeSafeLog", () => {
  it("emits only approved operational fields", () => {
    const output = serializeSafeLog({
      category: "timeout",
      correlationId: "local-correlation",
      durationMs: 12.6,
      operation: "upstream",
      status: "failure",
    });
    expect(JSON.parse(output)).toEqual({
      category: "timeout",
      correlationId: "local-correlation",
      durationMs: 13,
      operation: "upstream",
      status: "failure",
    });
    expect(output).not.toContain("password");
    expect(output).not.toContain("token");
  });
});
