import type { Job } from "bullmq";
import { describe, expect, it } from "vitest";
import { deadLetterPayload, exhausted } from "./dead-letter";
import { PublicationExecutionError } from "./retry-policy";

function job(attemptsMade: number) {
  return {
    data: { publicationJobId: "publication-1", executionToken: "secret" },
    opts: { attempts: 5 },
    attemptsMade,
  } as Job<{ publicationJobId: string; executionToken: string }>;
}

describe("publication dead letters", () => {
  it("only captures jobs after all attempts are exhausted", () => {
    expect(exhausted(job(4))).toBe(false);
    expect(exhausted(job(5))).toBe(true);
  });

  it("never copies the execution token into the dead letter", () => {
    const payload = deadLetterPayload(
      job(5),
      new PublicationExecutionError(503),
      new Date("2026-10-02T12:00:00Z"),
    );
    expect(payload).toEqual({
      publicationJobId: "publication-1",
      failedAt: "2026-10-02T12:00:00.000Z",
      httpStatus: 503,
    });
    expect(JSON.stringify(payload)).not.toContain("secret");
  });
});
