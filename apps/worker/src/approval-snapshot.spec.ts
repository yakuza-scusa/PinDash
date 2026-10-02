import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@pindash/database", () => ({
  database: { publicationJob: { findFirst } },
  JobStatus: { RUNNING: "RUNNING" },
}));

import { loadValidatedApprovalSnapshot } from "./approval-snapshot";

const ids = {
  draft: "11111111-1111-4111-8111-111111111111",
  workspace: "22222222-2222-4222-8222-222222222222",
  connection: "33333333-3333-4333-8333-333333333333",
  media: "44444444-4444-4444-8444-444444444444",
};

const snapshot = {
  draftId: ids.draft,
  draftVersion: 3,
  workspaceId: ids.workspace,
  connectionId: ids.connection,
  mediaAssetId: ids.media,
  mediaStorageKey: `${ids.workspace}/image.jpg`,
  boardId: "board-1",
  boardSectionId: null,
  title: "Approved Pin",
  description: "Approved description",
  altText: "Approved alternative text",
  destinationUrl: "https://example.com",
  scheduledForUtc: null,
  scheduleTimezone: null,
};

function publicationJob(contentSnapshot: unknown = snapshot) {
  return {
    id: "job-1",
    pinDraft: {
      id: ids.draft,
      workspaceId: ids.workspace,
      connectionId: ids.connection,
      mediaAssetId: ids.media,
      version: 3,
      connection: { status: "CONNECTED" },
      mediaAsset: { status: "READY", storageKey: snapshot.mediaStorageKey },
      approvals: [{ draftVersion: 3, contentSnapshot }],
    },
  };
}

describe("loadValidatedApprovalSnapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the immutable snapshot when ownership and versions match", async () => {
    findFirst.mockResolvedValue(publicationJob());
    await expect(
      loadValidatedApprovalSnapshot("job-1", "worker-a"),
    ).resolves.toEqual(snapshot);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1", status: "RUNNING", lockedBy: "worker-a" },
      }),
    );
  });

  it("rejects a stale approval version", async () => {
    const job = publicationJob();
    job.pinDraft.version = 4;
    findFirst.mockResolvedValue(job);
    await expect(
      loadValidatedApprovalSnapshot("job-1", "worker-a"),
    ).rejects.toThrow("no longer matches");
  });

  it("rejects a job not owned by the requesting worker", async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      loadValidatedApprovalSnapshot("job-1", "worker-b"),
    ).rejects.toThrow("not owned by this worker");
  });
});
