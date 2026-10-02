import { database, JobStatus, PinStatus } from "@pindash/database";
import type { Queue } from "bullmq";
import { createHmac } from "node:crypto";

export function publicationExecutionToken(
  jobId: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`publication:${jobId}`)
    .digest("hex");
}

export async function releaseDuePublications(
  queue: Queue,
  secret: string,
  now = new Date(),
): Promise<number> {
  const due = await database.publicationJob.findMany({
    where: { status: JobStatus.PENDING, runAt: { lte: now } },
    select: { id: true, pinDraftId: true },
    orderBy: { runAt: "asc" },
    take: 50,
  });
  let released = 0;
  for (const job of due) {
    const claimed = await database.$transaction(async (tx) => {
      const transition = await tx.publicationJob.updateMany({
        where: { id: job.id, status: JobStatus.PENDING, runAt: { lte: now } },
        data: { status: JobStatus.QUEUED },
      });
      if (transition.count !== 1) return false;
      await tx.pinDraft.updateMany({
        where: { id: job.pinDraftId, status: PinStatus.SCHEDULED },
        data: { status: PinStatus.QUEUED },
      });
      return true;
    });
    if (!claimed) continue;
    try {
      await queue.add(
        "publish-pin",
        {
          publicationJobId: job.id,
          executionToken: publicationExecutionToken(job.id, secret),
        },
        { jobId: job.id },
      );
      released += 1;
    } catch (error) {
      await database.$transaction([
        database.publicationJob.update({
          where: { id: job.id },
          data: { status: JobStatus.PENDING },
        }),
        database.pinDraft.update({
          where: { id: job.pinDraftId },
          data: { status: PinStatus.SCHEDULED },
        }),
      ]);
      throw error;
    }
  }
  return released;
}
