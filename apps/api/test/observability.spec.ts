import { describe, expect, it } from "vitest";
import { correlationId, safeRequestPath } from "../src/observability";

describe("request observability", () => {
  it("keeps valid correlation IDs and creates safe replacements", () => {
    expect(correlationId("request-1234")).toBe("request-1234");
    expect(correlationId("bad id")).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("redacts OAuth codes, state, tokens, signatures, and secrets", () => {
    const safe = safeRequestPath(
      "/callback?code=private&state=private&token=private&signature=private&secret=private",
    );
    expect(safe).not.toContain("private");
    expect(safe.match(/\[REDACTED\]/g)).toHaveLength(5);
  });
});
