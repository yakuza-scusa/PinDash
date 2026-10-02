import {
  ApprovedPinSnapshotSchema,
  type ApprovedPinSnapshot,
} from "@pindash/contracts";
import { database, JobStatus } from "@pindash/database";

export class PublicationApprovalError extends Error {
  readonly code = "APPROVAL_SNAPSHOT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PublicationApprovalError";
  }
}

export async function loadValidatedApprovalSnapshot(
  publicationJobId: string,
  workerId: string,
): Promise<ApprovedPinSnapshot> {
  const job = await database.publicationJob.findFirst({
    where: {
      id: publicationJobId,
      status: JobStatus.RUNNING,
      lockedBy: workerId,
    },
    include: {
      pinDraft: {
        include: {
          connection: { select: { status: true } },
          mediaAsset: { select: { status: true, storageKey: true } },
          approvals: { orderBy: { approvedAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!job)
    throw new PublicationApprovalError(
      "Publication job is not owned by this worker",
    );

  const draft = job.pinDraft;
  const approval = draft.approvals[0];
  const parsed = ApprovedPinSnapshotSchema.safeParse(approval?.contentSnapshot);
  if (!approval || !parsed.success)
    throw new PublicationApprovalError(
      "Approval snapshot is missing or invalid",
    );

  const snapshot = parsed.data;
  if (
    approval.draftVersion !== draft.version ||
    snapshot.draftVersion !== draft.version ||
    snapshot.draftId !== draft.id ||
    snapshot.workspaceId !== draft.workspaceId ||
    snapshot.connectionId !== draft.connectionId ||
    snapshot.mediaAssetId !== draft.mediaAssetId ||
    snapshot.mediaStorageKey !== draft.mediaAsset?.storageKey
  )
    throw new PublicationApprovalError(
      "Approval snapshot no longer matches the queued draft",
    );
  if (draft.connection?.status !== "CONNECTED")
    throw new PublicationApprovalError("Pinterest connection is not active");
  if (draft.mediaAsset?.status !== "READY")
    throw new PublicationApprovalError("Approved media is not ready");

  return snapshot;
}
