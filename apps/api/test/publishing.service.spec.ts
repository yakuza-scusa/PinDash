import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@pindash/database", () => ({
  database: { $transaction: transaction },
  JobStatus: {
    PENDING: "PENDING",
    QUEUED: "QUEUED",
    SUCCEEDED: "SUCCEEDED",
  },
  PinStatus: { APPROVED: "APPROVED", QUEUED: "QUEUED" },
}));

import { PublishingService } from "../src/publishing/publishing.service";

describe("PublishingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters";
  });

  it("creates one deterministic publication job and queues it", async () => {
    const job = {
      id: "job-1",
      pinDraftId: "draft-1",
      idempotencyKey: "generated",
      status: "PENDING",
      runAt: new Date("2026-10-01T00:00:00Z"),
    };
    const tx = {
      pinDraft: {
        findFirst: vi.fn().mockResolvedValue({
          id: "draft-1",
          version: 4,
          status: "APPROVED",
          approvals: [{ id: "approval-1", draftVersion: 4 }],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      publicationJob: {
        upsert: vi.fn().mockResolvedValue(job),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...job,
          status: "QUEUED",
          pinDraft: { workspaceId: "workspace-1" },
        }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const result = await new PublishingService(
      queue as never,
      {} as never,
      {} as never,
      {} as never,
    ).publishNow("user-1", "draft-1");
    expect(result).toMatchObject({
      publicationJobId: "job-1",
      status: "QUEUED",
    });
    expect(queue.enqueue).toHaveBeenCalledWith(
      "job-1",
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    const create = tx.publicationJob.upsert.mock.calls[0]![0].create;
    expect(create.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
  });

  it("rejects a draft whose current version is not approved", async () => {
    const tx = {
      pinDraft: {
        findFirst: vi.fn().mockResolvedValue({
          id: "draft-1",
          version: 5,
          status: "APPROVED",
          approvals: [{ id: "approval-1", draftVersion: 4 }],
        }),
      },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    const service = new PublishingService(
      { enqueue: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.publishNow("user-1", "draft-1")).rejects.toThrow(
      "latest draft version",
    );
  });
});
