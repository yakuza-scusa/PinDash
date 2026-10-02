import { describe, expect, it } from "vitest";
import { publicationExecutionToken } from "./scheduler";

describe("publication scheduler", () => {
  it("creates deterministic signed execution tokens without exposing secrets", () => {
    const first = publicationExecutionToken("job-1", "a-secure-session-secret");
    const second = publicationExecutionToken(
      "job-1",
      "a-secure-session-secret",
    );
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("a-secure-session-secret");
  });
});
