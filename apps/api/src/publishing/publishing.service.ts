import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { database, JobStatus, PinStatus } from "@pindash/database";
import { createHash } from "node:crypto";
import { PublishQueueService } from "./publish-queue.service";

@Injectable()
export class PublishingService {
  constructor(private readonly queue: PublishQueueService) {}

  async publishNow(userId: string, pinDraftId: string) {
    const job = await database.$transaction(async (tx) => {
      const draft = await tx.pinDraft.findFirst({
        where: {
          id: pinDraftId,
          workspace: { members: { some: { userId } } },
        },
        include: {
          approvals: { orderBy: { approvedAt: "desc" }, take: 1 },
        },
      });
      if (!draft) throw new NotFoundException("Draft not found");
      const approval = draft.approvals[0];
      if (!approval || approval.draftVersion !== draft.version)
        throw new BadRequestException(
          "The latest draft version must be explicitly approved before publishing",
        );
      if (
        draft.status !== PinStatus.APPROVED &&
        draft.status !== PinStatus.QUEUED
      )
        throw new BadRequestException(
          "Only an approved Pin can be queued for publishing",
        );

      const idempotencyKey = createHash("sha256")
        .update(`pin-approval:${approval.id}`)
        .digest("hex");
      return tx.publicationJob.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          pinDraftId,
          idempotencyKey,
          runAt: new Date(),
          status: JobStatus.PENDING,
        },
      });
    });

    if (job.status === JobStatus.SUCCEEDED) return this.toResult(job);
    try {
      await this.queue.enqueue(job.id);
    } catch {
      throw new ServiceUnavailableException(
        "Publishing queue is temporarily unavailable. The request can be retried safely.",
      );
    }

    const queued = await database.$transaction(async (tx) => {
      const transition = await tx.publicationJob.updateMany({
        where: { id: job.id, status: JobStatus.PENDING },
        data: { status: JobStatus.QUEUED },
      });
      const updated = await tx.publicationJob.findUniqueOrThrow({
        where: { id: job.id },
        include: { pinDraft: { select: { workspaceId: true } } },
      });
      if (transition.count === 1) {
        await tx.pinDraft.updateMany({
          where: { id: pinDraftId, status: PinStatus.APPROVED },
          data: { status: PinStatus.QUEUED },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId: updated.pinDraft.workspaceId,
            actorUserId: userId,
            action: "pin.publication_queued",
            entityType: "PublicationJob",
            entityId: job.id,
            metadata: { pinDraftId },
          },
        });
      }
      return updated;
    });
    return this.toResult(queued);
  }

  private toResult(job: {
    id: string;
    pinDraftId: string;
    status: JobStatus;
    runAt: Date;
  }) {
    return {
      publicationJobId: job.id,
      pinDraftId: job.pinDraftId,
      status: job.status,
      runAt: job.runAt,
    };
  }
}
