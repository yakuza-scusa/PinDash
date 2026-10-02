import { Worker, type Job } from "bullmq";
import { hostname } from "node:os";
import { loadValidatedApprovalSnapshot } from "./approval-snapshot";
import { claimPublicationJob } from "./publication-lock";

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
      if (!response.ok)
        throw new Error(`Publication execution failed (${response.status})`);
      return response.json();
    },
    { connection: connection(redisUrl), concurrency: 4 },
  );
}

if (process.env.NODE_ENV !== "test") {
  const worker = createPublicationWorker(
    process.env.REDIS_URL ?? "redis://localhost:6379",
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
}
