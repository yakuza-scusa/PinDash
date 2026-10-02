import { Queue, Worker, type Job } from "bullmq";
import { hostname } from "node:os";
import { loadValidatedApprovalSnapshot } from "./approval-snapshot";
import { deadLetterPayload, exhausted } from "./dead-letter";
import { claimPublicationJob } from "./publication-lock";
import {
  PublicationExecutionError,
  publicationRetryDelay,
} from "./retry-policy";
import { releaseDuePublications } from "./scheduler";

export const PUBLISH_QUEUE = "pinterest-publication";

type PublicationPayload = { publicationJobId: string; executionToken: string };

function connection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

export function createPublicationWorker(redisUrl: string, apiUrl: string) {
  const workerId = `${hostname()}:${process.pid}`;
  return new Worker<PublicationPayload>(
    PUBLISH_QUEUE,
    async (job: Job<PublicationPayload>) => {
      const { publicationJobId, executionToken } = job.data;
      if (!publicationJobId || !executionToken)
        throw new Error("Invalid job payload");
      const claim = await claimPublicationJob(publicationJobId, workerId);
      if (!claim) return { duplicate: true };
      await loadValidatedApprovalSnapshot(publicationJobId, workerId);
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/api/v1/internal/publications/${encodeURIComponent(publicationJobId)}/execute`,
        {
          method: "POST",
          headers: { "x-execution-token": executionToken },
          signal: AbortSignal.timeout(60_000),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          retryAfterSeconds?: unknown;
        };
        const retryAfterSeconds =
          typeof body.retryAfterSeconds === "number"
            ? body.retryAfterSeconds
            : undefined;
        throw new PublicationExecutionError(response.status, retryAfterSeconds);
      }
      return response.json();
    },
    {
      connection: connection(redisUrl),
      concurrency: 4,
      settings: {
        backoffStrategy: (attemptsMade, type, error) => {
          if (type !== "pindash") throw new Error(`Unknown backoff ${type}`);
          return publicationRetryDelay(
            attemptsMade,
            error instanceof PublicationExecutionError
              ? error.retryAfterMs
              : undefined,
          );
        },
      },
    },
  );
}

if (process.env.NODE_ENV !== "test") {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const deadLetters = new Queue("pinterest-publication-dead-letter", {
    connection: connection(redisUrl),
    defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
  });
  const publications = new Queue(PUBLISH_QUEUE, {
    connection: connection(redisUrl),
  });
  const worker = createPublicationWorker(
    redisUrl,
    process.env.API_URL ?? "http://localhost:4000",
  );
  worker.on("ready", () =>
    console.info(
      JSON.stringify({ level: "info", service: "worker", event: "ready" }),
    ),
  );
  worker.on("error", (error) =>
    console.error(
      JSON.stringify({
        level: "error",
        service: "worker",
        event: "error",
        message: error.message,
      }),
    ),
  );
  worker.on("failed", (job, error) => {
    if (!job || !exhausted(job)) return;
    const payload = deadLetterPayload(job, error);
    void deadLetters
      .add("publication-exhausted", payload, {
        jobId: `dead-${job.id ?? payload.publicationJobId}`,
      })
      .catch((deadLetterError: unknown) =>
        console.error(
          JSON.stringify({
            level: "error",
            service: "worker",
            event: "dead_letter_failed",
            message:
              deadLetterError instanceof Error
                ? deadLetterError.message
                : "Unknown dead-letter error",
          }),
        ),
      );
  });
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error("SESSION_SECRET is required by worker");
  const releaseDue = () =>
    void releaseDuePublications(publications, sessionSecret).catch((error) =>
      console.error(
        JSON.stringify({
          level: "error",
          service: "worker",
          event: "scheduler_failed",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      ),
    );
  releaseDue();
  setInterval(releaseDue, 15_000).unref();
  const heartbeat = () =>
    void publications.client.then((redis) =>
      redis.set("pindash:worker:heartbeat", new Date().toISOString(), {
        EX: 45,
      }),
    );
  heartbeat();
  setInterval(heartbeat, 15_000).unref();
}
