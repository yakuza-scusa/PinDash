import { Queue } from "bullmq";

export const PUBLISH_QUEUE = "pinterest-publication";

export function createPublishQueue(redisUrl: string): Queue {
  const url = new URL(redisUrl);
  return new Queue(PUBLISH_QUEUE, {
    connection: {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
    },
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
}

if (process.env.NODE_ENV !== "test") {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const queue = createPublishQueue(redisUrl);
  console.info(
    JSON.stringify({
      level: "info",
      service: "worker",
      queue: queue.name,
      event: "ready",
    }),
  );
}
