import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { database, PinStatus, type Prisma } from "@pindash/database";
import { createHash } from "node:crypto";
import {
  ApprovedPinSnapshotSchema,
  type ApprovePin,
  type SavePinDraft,
  type UpdatePinDraft,
} from "@pindash/contracts";

@Injectable()
export class PinsService {
  private validateSchedule(
    scheduledForUtc?: string | null,
    scheduleTimezone?: string | null,
  ): void {
    if (!scheduledForUtc && !scheduleTimezone) return;
    if (!scheduledForUtc || !scheduleTimezone)
      throw new BadRequestException(
        "A scheduled Pin requires both a date and timezone",
      );
    try {
      new Intl.DateTimeFormat("en", { timeZone: scheduleTimezone }).format();
    } catch {
      throw new BadRequestException("Invalid IANA schedule timezone");
    }
    if (new Date(scheduledForUtc).getTime() <= Date.now() + 60_000)
      throw new BadRequestException(
        "Scheduled publication must be at least one minute in the future",
      );
  }
  private async requireWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const membership = await database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException("Workspace access denied");
  }

  private async requireResources(
    workspaceId: string,
    connectionId?: string | null,
    mediaAssetId?: string | null,
  ): Promise<void> {
    if (connectionId) {
      const count = await database.pinterestConnection.count({
        where: { id: connectionId, workspaceId },
      });
      if (count !== 1)
        throw new ForbiddenException(
          "Pinterest connection is outside this workspace",
        );
    }
    if (mediaAssetId) {
      const count = await database.mediaAsset.count({
        where: { id: mediaAssetId, workspaceId, deletedAt: null },
      });
      if (count !== 1)
        throw new ForbiddenException("Media asset is outside this workspace");
    }
  }

  async create(userId: string, input: SavePinDraft) {
    this.validateSchedule(input.scheduledForUtc, input.scheduleTimezone);
    await this.requireWorkspace(userId, input.workspaceId);
    await this.requireResources(
      input.workspaceId,
      input.connectionId,
      input.mediaAssetId,
    );
    return database.pinDraft.create({
      data: {
        workspaceId: input.workspaceId,
        createdByUserId: userId,
        connectionId: input.connectionId ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        boardId: input.boardId ?? null,
        title: input.title,
        description: input.description,
        altText: input.altText ?? null,
        destinationUrl: input.destinationUrl ?? null,
        scheduledForUtc: input.scheduledForUtc
          ? new Date(input.scheduledForUtc)
          : null,
        scheduleTimezone: input.scheduleTimezone ?? null,
      },
    });
  }

  async list(userId: string) {
    return database.pinDraft.findMany({
      where: { workspace: { members: { some: { userId } } } },
      select: {
        id: true,
        workspaceId: true,
        connectionId: true,
        mediaAssetId: true,
        boardId: true,
        title: true,
        description: true,
        altText: true,
        destinationUrl: true,
        status: true,
        scheduledForUtc: true,
        scheduleTimezone: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        publishedPin: {
          select: {
            pinterestPinId: true,
            pinterestUrl: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async get(userId: string, id: string) {
    const draft = await database.pinDraft.findFirst({
      where: { id, workspace: { members: { some: { userId } } } },
      select: {
        id: true,
        workspaceId: true,
        connectionId: true,
        mediaAssetId: true,
        boardId: true,
        title: true,
        description: true,
        altText: true,
        destinationUrl: true,
        status: true,
        scheduledForUtc: true,
        scheduleTimezone: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!draft) throw new NotFoundException("Draft not found");
    return draft;
  }

  async review(userId: string, id: string) {
    const draft = await database.pinDraft.findFirst({
      where: { id, workspace: { members: { some: { userId } } } },
      include: {
        connection: {
          select: {
            id: true,
            displayName: true,
            pinterestUserId: true,
            status: true,
          },
        },
        mediaAsset: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            width: true,
            height: true,
            status: true,
          },
        },
      },
    });
    if (!draft) throw new NotFoundException("Draft not found");
    return draft;
  }

  async approve(userId: string, id: string, input: ApprovePin) {
    return database.$transaction(async (tx) => {
      const draft = await tx.pinDraft.findFirst({
        where: { id, workspace: { members: { some: { userId } } } },
        include: { connection: true, mediaAsset: true },
      });
      if (!draft) throw new NotFoundException("Draft not found");
      if (draft.version !== input.draftVersion)
        throw new BadRequestException(
          "Draft changed after review. Review the latest version.",
        );
      if (
        !draft.title.trim() ||
        !draft.description.trim() ||
        !draft.altText?.trim() ||
        !draft.connectionId ||
        !draft.boardId ||
        !draft.mediaAssetId
      )
        throw new BadRequestException(
          "Complete the title, description, alt text, account, board, and media before approval",
        );
      if (draft.connection?.status !== "CONNECTED")
        throw new BadRequestException("Pinterest connection is not active");
      if (draft.mediaAsset?.status !== "READY")
        throw new BadRequestException("Media is not ready");
      const snapshot = ApprovedPinSnapshotSchema.parse({
        draftId: draft.id,
        draftVersion: draft.version,
        workspaceId: draft.workspaceId,
        connectionId: draft.connectionId,
        mediaAssetId: draft.mediaAssetId,
        mediaStorageKey: draft.mediaAsset.storageKey,
        boardId: draft.boardId,
        boardSectionId: draft.boardSectionId,
        title: draft.title,
        description: draft.description,
        altText: draft.altText,
        destinationUrl: draft.destinationUrl,
        scheduledForUtc: draft.scheduledForUtc?.toISOString() ?? null,
        scheduleTimezone: draft.scheduleTimezone,
      });
      const approval = await tx.pinApproval.upsert({
        where: {
          pinDraftId_draftVersion: {
            pinDraftId: id,
            draftVersion: draft.version,
          },
        },
        update: {},
        create: {
          pinDraftId: id,
          approvedByUserId: userId,
          draftVersion: draft.version,
          contentSnapshot: snapshot,
        },
      });
      const scheduled = Boolean(
        draft.scheduledForUtc && draft.scheduledForUtc > new Date(),
      );
      await tx.pinDraft.update({
        where: { id },
        data: { status: scheduled ? PinStatus.SCHEDULED : PinStatus.APPROVED },
      });
      if (scheduled && draft.scheduledForUtc) {
        const idempotencyKey = createHash("sha256")
          .update(`pin-approval:${approval.id}`)
          .digest("hex");
        await tx.publicationJob.upsert({
          where: { idempotencyKey },
          update: { runAt: draft.scheduledForUtc, status: "PENDING" },
          create: {
            pinDraftId: id,
            idempotencyKey,
            runAt: draft.scheduledForUtc,
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          workspaceId: draft.workspaceId,
          actorUserId: userId,
          action: "pin.approved",
          entityType: "PinDraft",
          entityId: id,
          metadata: { draftVersion: draft.version, approvalId: approval.id },
        },
      });
      return {
        approvalId: approval.id,
        draftId: id,
        draftVersion: draft.version,
        status: scheduled ? "SCHEDULED" : "APPROVED",
        approvedAt: approval.approvedAt,
      };
    });
  }

  async update(userId: string, id: string, input: UpdatePinDraft) {
    const draft = await database.pinDraft.findFirst({
      where: { id, workspace: { members: { some: { userId } } } },
    });
    if (!draft) throw new NotFoundException("Draft not found");
    if ("scheduledForUtc" in input || "scheduleTimezone" in input)
      this.validateSchedule(
        "scheduledForUtc" in input
          ? (input.scheduledForUtc ?? null)
          : draft.scheduledForUtc?.toISOString(),
        "scheduleTimezone" in input
          ? (input.scheduleTimezone ?? null)
          : draft.scheduleTimezone,
      );
    await this.requireResources(
      draft.workspaceId,
      input.connectionId,
      input.mediaAssetId,
    );
    const data: Prisma.PinDraftUpdateInput = {
      version: { increment: 1 },
      status: PinStatus.DRAFT,
    };
    if ("connectionId" in input)
      data.connection = input.connectionId
        ? { connect: { id: input.connectionId } }
        : { disconnect: true };
    if ("mediaAssetId" in input)
      data.mediaAsset = input.mediaAssetId
        ? { connect: { id: input.mediaAssetId } }
        : { disconnect: true };
    if ("boardId" in input) data.boardId = input.boardId ?? null;
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if ("altText" in input) data.altText = input.altText ?? null;
    if ("destinationUrl" in input)
      data.destinationUrl = input.destinationUrl ?? null;
    if ("scheduledForUtc" in input)
      data.scheduledForUtc = input.scheduledForUtc
        ? new Date(input.scheduledForUtc)
        : null;
    if ("scheduleTimezone" in input)
      data.scheduleTimezone = input.scheduleTimezone ?? null;
    return database.$transaction(async (tx) => {
      await tx.pinApproval.deleteMany({ where: { pinDraftId: id } });
      return tx.pinDraft.update({ where: { id }, data });
    });
  }

  async duplicate(userId: string, id: string) {
    const source = await database.pinDraft.findFirst({
      where: { id, workspace: { members: { some: { userId } } } },
    });
    if (!source) throw new NotFoundException("Draft not found");
    return database.pinDraft.create({
      data: {
        workspaceId: source.workspaceId,
        createdByUserId: userId,
        connectionId: source.connectionId,
        mediaAssetId: source.mediaAssetId,
        boardId: source.boardId,
        boardSectionId: source.boardSectionId,
        title: source.title ? `${source.title} (copy)`.slice(0, 100) : "",
        description: source.description,
        altText: source.altText,
        destinationUrl: source.destinationUrl,
      },
    });
  }

  async remove(userId: string, id: string) {
    const draft = await database.pinDraft.findFirst({
      where: { id, workspace: { members: { some: { userId } } } },
    });
    if (!draft) throw new NotFoundException("Draft not found");
    if (draft.status === PinStatus.PUBLISHED)
      throw new BadRequestException("Published Pins cannot be deleted");
    await database.pinDraft.delete({ where: { id } });
    return { deleted: true };
  }

  async cancelSchedule(userId: string, id: string) {
    const draft = await database.pinDraft.findFirst({
      where: { id, workspace: { members: { some: { userId } } } },
    });
    if (!draft) throw new NotFoundException("Draft not found");
    if (draft.status !== PinStatus.SCHEDULED)
      throw new BadRequestException("Only a scheduled Pin can be cancelled");
    return database.$transaction(async (tx) => {
      await tx.publicationJob.updateMany({
        where: { pinDraftId: id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: draft.workspaceId,
          actorUserId: userId,
          action: "pin.schedule_cancelled",
          entityType: "PinDraft",
          entityId: id,
        },
      });
      return tx.pinDraft.update({
        where: { id },
        data: { status: PinStatus.CANCELLED },
      });
    });
  }
}
