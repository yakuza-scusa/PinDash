import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@pindash/database", () => ({
  database: { $transaction: transaction },
  PinStatus: {
    DRAFT: "DRAFT",
    APPROVED: "APPROVED",
    SCHEDULED: "SCHEDULED",
    PUBLISHED: "PUBLISHED",
    CANCELLED: "CANCELLED",
  },
}));

import { PinsService } from "../src/pins/pins.service";

const completeDraft = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  version: 3,
  title: "A complete Pin",
  description: "Useful description",
  altText: "Accessible image description",
  destinationUrl: "https://example.com",
  connectionId: "33333333-3333-4333-8333-333333333333",
  mediaAssetId: "44444444-4444-4444-8444-444444444444",
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
    const result = await new PinsService().approve("user-1", completeDraft.id, {
      confirmed: true,
      draftVersion: 3,
    });
    expect(result.status).toBe("APPROVED");
    expect(tx.pinApproval.upsert).toHaveBeenCalledOnce();
    expect(tx.pinDraft.update).toHaveBeenCalledWith({
      where: { id: completeDraft.id },
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
      new PinsService().approve("user-1", completeDraft.id, {
        confirmed: true,
        draftVersion: 2,
      }),
    ).rejects.toThrow("Draft changed after review");
  });
});
