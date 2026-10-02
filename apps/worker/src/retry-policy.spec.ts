import { describe, expect, it } from "vitest";
import {
  PublicationExecutionError,
  publicationRetryDelay,
} from "./retry-policy";

describe("publication retry policy", () => {
  it("uses capped exponential backoff with deterministic jitter", () => {
    expect(publicationRetryDelay(1, undefined, () => 0)).toBe(5_000);
    expect(publicationRetryDelay(3, undefined, () => 1)).toBe(25_000);
    expect(publicationRetryDelay(20, undefined, () => 0)).toBe(300_000);
  });

  it("honors a longer Retry-After delay", () => {
    expect(publicationRetryDelay(1, 60_000, () => 0)).toBe(60_000);
    expect(new PublicationExecutionError(503, 30).retryAfterMs).toBe(30_000);
  });
});
