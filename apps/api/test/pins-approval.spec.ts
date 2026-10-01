import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@pindash/database", () => ({
  database: { $transaction: transaction },
  PinStatus: { DRAFT: "DRAFT" },
}));

import { PinsService } from "../src/pins/pins.service";

const completeDraft = {
  id: "draft-1",
  workspaceId: "workspace-1",
  version: 3,
  title: "A complete Pin",
  description: "Useful description",
  altText: "Accessible image description",
  destinationUrl: "https://example.com",
  connectionId: "connection-1",
  mediaAssetId: "media-1",
  boardId: "board-1",
  boardSectionId: null,
  scheduledForUtc: null,
  scheduleTimezone: null,
  connection: { status: "CONNECTED" },
  mediaAsset: { status: "READY", storageKey: "workspace/media.png" },
};

describe("PinsService approval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a snapshot, transitions to APPROVED, and writes an audit event", async () => {
    const tx = {
      pinDraft: {
        findFirst: vi.fn().mockResolvedValue(completeDraft),
        update: vi.fn().mockResolvedValue({}),
      },
      pinApproval: {
        upsert: vi.fn().mockResolvedValue({
          id: "approval-1",
          approvedAt: new Date("2026-10-01T00:00:00Z"),
        }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    const result = await new PinsService().approve("user-1", "draft-1", {
      confirmed: true,
      draftVersion: 3,
    });
    expect(result.status).toBe("APPROVED");
    expect(tx.pinApproval.upsert).toHaveBeenCalledOnce();
    expect(tx.pinDraft.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: { status: "APPROVED" },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
  });

  it("rejects approval when the reviewed version is stale", async () => {
    const tx = {
      pinDraft: { findFirst: vi.fn().mockResolvedValue(completeDraft) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    await expect(
      new PinsService().approve("user-1", "draft-1", {
        confirmed: true,
        draftVersion: 2,
      }),
    ).rejects.toThrow("Draft changed after review");
  });
});
