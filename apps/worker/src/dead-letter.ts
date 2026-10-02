import type { Job } from "bullmq";
import { PublicationExecutionError } from "./retry-policy";

type PublicationPayload = { publicationJobId: string; executionToken: string };

export type PublicationDeadLetter = {
  publicationJobId: string;
  failedAt: string;
  httpStatus?: number;
};

export function exhausted(job: Job<PublicationPayload>): boolean {
  const attempts =
    typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
  return job.attemptsMade >= attempts;
}

export function deadLetterPayload(
  job: Job<PublicationPayload>,
  error: Error,
  failedAt = new Date(),
): PublicationDeadLetter {
  return {
    publicationJobId: job.data.publicationJobId,
    failedAt: failedAt.toISOString(),
    ...(error instanceof PublicationExecutionError
      ? { httpStatus: error.status }
      : {}),
  };
}
