import { database, JobStatus } from "@pindash/database";

export type ClaimedPublicationJob = {
  id: string;
  pinDraftId: string;
  attemptNumber: number;
  lockedAt: Date;
  lockedBy: string;
};

/**
 * Atomically moves one queued publication into RUNNING.
 * A competing worker receives null and must acknowledge its duplicate queue job.
 */
export async function claimPublicationJob(
  publicationJobId: string,
  workerId: string,
): Promise<ClaimedPublicationJob | null> {
  if (!workerId.trim()) throw new Error("workerId is required");
  const lockedAt = new Date();

  return database.$transaction(async (tx) => {
    const claim = await tx.publicationJob.updateMany({
      where: {
        id: publicationJobId,
        status: JobStatus.QUEUED,
        lockedAt: null,
      },
      data: {
        status: JobStatus.RUNNING,
        lockedAt,
        lockedBy: workerId,
        attemptCount: { increment: 1 },
      },
    });
    if (claim.count !== 1) return null;

    const job = await tx.publicationJob.findUniqueOrThrow({
      where: { id: publicationJobId },
      select: { id: true, pinDraftId: true, attemptCount: true },
    });
    await tx.publicationAttempt.create({
      data: {
        publicationJobId: job.id,
        attemptNumber: job.attemptCount,
      },
    });
    return {
      id: job.id,
      pinDraftId: job.pinDraftId,
      attemptNumber: job.attemptCount,
      lockedAt,
      lockedBy: workerId,
    };
  });
}
