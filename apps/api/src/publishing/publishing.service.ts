import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApprovedPinSnapshotSchema } from "@pindash/contracts";
import { database, JobStatus, PinStatus } from "@pindash/database";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { MediaService } from "../media/media.service";
import {
  PinterestApiClient,
  PinterestApiError,
} from "../pinterest/pinterest-api.client";
import { TokenCryptoService } from "../pinterest/token-crypto.service";
import { PublishQueueService } from "./publish-queue.service";

@Injectable()
export class PublishingService {
  constructor(
    private readonly queue: PublishQueueService,
    private readonly pinterest: PinterestApiClient,
    private readonly tokens: TokenCryptoService,
    private readonly media: MediaService,
  ) {}

  private executionToken(jobId: string): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret)
      throw new ServiceUnavailableException("SESSION_SECRET is missing");
    return createHmac("sha256", secret)
      .update(`publication:${jobId}`)
      .digest("hex");
  }

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
    if (queued.status === JobStatus.SUCCEEDED) return this.toResult(queued);
    try {
      await this.queue.enqueue(job.id, this.executionToken(job.id));
    } catch {
      throw new ServiceUnavailableException(
        "Publishing queue is temporarily unavailable. The request can be retried safely.",
      );
    }
    return this.toResult(queued);
  }

  async status(userId: string, pinDraftId: string) {
    const draft = await database.pinDraft.findFirst({
      where: { id: pinDraftId, workspace: { members: { some: { userId } } } },
      select: {
        id: true,
        title: true,
        status: true,
        publicationJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            attemptCount: true,
            lastErrorCode: true,
            lastErrorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        publishedPin: {
          select: {
            pinterestPinId: true,
            pinterestUrl: true,
            publishedAt: true,
          },
        },
      },
    });
    if (!draft) throw new NotFoundException("Draft not found");
    return { ...draft, publication: draft.publicationJobs[0] ?? null };
  }

  async execute(publicationJobId: string, suppliedToken: string) {
    const expected = this.executionToken(publicationJobId);
    const valid =
      suppliedToken.length === expected.length &&
      timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(expected));
    if (!valid)
      throw new ForbiddenException("Invalid publication execution token");

    const job = await database.publicationJob.findFirst({
      where: { id: publicationJobId, status: JobStatus.RUNNING },
      include: {
        pinDraft: {
          include: {
            connection: true,
            mediaAsset: true,
            approvals: { orderBy: { approvedAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!job) throw new BadRequestException("Publication job is not running");
    const approval = job.pinDraft.approvals[0];
    const parsed = ApprovedPinSnapshotSchema.safeParse(
      approval?.contentSnapshot,
    );
    if (
      !approval ||
      !parsed.success ||
      approval.draftVersion !== job.pinDraft.version
    )
      throw new BadRequestException("Approval snapshot is invalid");
    const snapshot = parsed.data;
    if (
      snapshot.draftId !== job.pinDraft.id ||
      snapshot.connectionId !== job.pinDraft.connectionId ||
      snapshot.mediaAssetId !== job.pinDraft.mediaAssetId ||
      snapshot.mediaStorageKey !== job.pinDraft.mediaAsset?.storageKey ||
      job.pinDraft.connection?.status !== "CONNECTED" ||
      job.pinDraft.mediaAsset?.status !== "READY"
    )
      throw new BadRequestException("Approved resources are no longer valid");

    try {
      const accessToken = this.tokens.decrypt(
        Buffer.from(job.pinDraft.connection.encryptedAccessToken),
      );
      const mediaUrl = await this.media.createRetrievalUrl(
        snapshot.mediaStorageKey,
      );
      const created = await this.pinterest.createImagePin(accessToken, {
        boardId: snapshot.boardId,
        ...(snapshot.boardSectionId
          ? { boardSectionId: snapshot.boardSectionId }
          : {}),
        title: snapshot.title,
        description: snapshot.description,
        altText: snapshot.altText,
        ...(snapshot.destinationUrl
          ? { destinationUrl: snapshot.destinationUrl }
          : {}),
        mediaUrl,
      });
      const confirmed = await this.pinterest.getPin(accessToken, created.id);
      const publishedAt = new Date();
      const pinterestUrl = `https://www.pinterest.com/pin/${encodeURIComponent(confirmed.id)}/`;
      await database.$transaction(async (tx) => {
        await tx.publishedPin.upsert({
          where: { pinDraftId: job.pinDraftId },
          update: { pinterestPinId: confirmed.id, pinterestUrl, publishedAt },
          create: {
            pinDraftId: job.pinDraftId,
            connectionId: snapshot.connectionId,
            pinterestPinId: confirmed.id,
            pinterestUrl,
            publishedAt,
          },
        });
        await tx.publicationJob.update({
          where: { id: job.id },
          data: { status: JobStatus.SUCCEEDED, lockedAt: null, lockedBy: null },
        });
        await tx.publicationAttempt.updateMany({
          where: { publicationJobId: job.id, attemptNumber: job.attemptCount },
          data: { finishedAt: publishedAt, outcome: "SUCCEEDED" },
        });
        await tx.pinDraft.update({
          where: { id: job.pinDraftId },
          data: { status: PinStatus.PUBLISHED },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId: snapshot.workspaceId,
            action: "pin.published",
            entityType: "PublishedPin",
            entityId: confirmed.id,
            metadata: { publicationJobId: job.id, pinDraftId: job.pinDraftId },
          },
        });
      });
      return { pinterestPinId: confirmed.id, pinterestUrl, publishedAt };
    } catch (error) {
      const code = error instanceof PinterestApiError ? error.kind : "unknown";
      await database.$transaction(async (tx) => {
        await tx.publicationJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            lockedAt: null,
            lockedBy: null,
            lastErrorCode: code,
            lastErrorMessage: "Pinterest could not publish this Pin",
          },
        });
        await tx.publicationAttempt.updateMany({
          where: { publicationJobId: job.id, attemptNumber: job.attemptCount },
          data: {
            finishedAt: new Date(),
            outcome: "FAILED",
            errorCode: code,
            errorMessage: "Pinterest could not publish this Pin",
          },
        });
        await tx.pinDraft.update({
          where: { id: job.pinDraftId },
          data: { status: PinStatus.FAILED },
        });
      });
      throw new BadGatewayException("Pinterest could not publish this Pin");
    }
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
