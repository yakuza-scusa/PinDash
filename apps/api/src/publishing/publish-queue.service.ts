import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

export const PUBLISH_QUEUE = "pinterest-publication";

@Injectable()
export class PublishQueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor() {
    const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
    this.queue = new Queue(PUBLISH_QUEUE, {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        username: url.username || undefined,
        password: url.password || undefined,
        tls: url.protocol === "rediss:" ? {} : undefined,
      },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "pindash", delay: 5_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
  }

  async enqueue(
    publicationJobId: string,
    executionToken: string,
  ): Promise<void> {
    await this.queue.add(
      "publish-pin",
      { publicationJobId, executionToken },
      { jobId: publicationJobId },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
