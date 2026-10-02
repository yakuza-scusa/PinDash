export class PublicationExecutionError extends Error {
  readonly retryAfterMs: number | undefined;

  constructor(
    readonly status: number,
    retryAfterSeconds?: number,
  ) {
    super(`Publication execution failed (${status})`);
    this.name = "PublicationExecutionError";
    this.retryAfterMs =
      retryAfterSeconds === undefined
        ? undefined
        : Math.max(0, retryAfterSeconds * 1_000);
  }
}

/** Exponential delay with 0-25% jitter, while honoring Pinterest's minimum. */
export function publicationRetryDelay(
  attemptsMade: number,
  retryAfterMs?: number,
  random = Math.random,
): number {
  const exponential = Math.min(
    5_000 * 2 ** Math.max(0, attemptsMade - 1),
    300_000,
  );
  const jittered = Math.round(exponential * (1 + random() * 0.25));
  return Math.max(jittered, retryAfterMs ?? 0);
}
