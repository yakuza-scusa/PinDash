import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const { transaction, publicationFindFirst, publicationUpdate } = vi.hoisted(
  () => ({
    transaction: vi.fn(),
    publicationFindFirst: vi.fn(),
    publicationUpdate: vi.fn(),
  }),
);
vi.mock("@pindash/database", () => ({
  database: {
    $transaction: transaction,
    publicationJob: {
      findFirst: publicationFindFirst,
      update: publicationUpdate,
    },
  },
  JobStatus: {
    PENDING: "PENDING",
    QUEUED: "QUEUED",
    RUNNING: "RUNNING",
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
    UNKNOWN_RESULT: "UNKNOWN_RESULT",
  },
  PinStatus: {
    APPROVED: "APPROVED",
    QUEUED: "QUEUED",
    PUBLISHED: "PUBLISHED",
    FAILED: "FAILED",
    UNKNOWN_RESULT: "UNKNOWN_RESULT",
    CONNECTION_REQUIRED: "CONNECTION_REQUIRED",
  },
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

  it("reconciles a stored Pinterest candidate without creating a duplicate", async () => {
    const snapshot = {
      draftId: "11111111-1111-4111-8111-111111111111",
      draftVersion: 2,
      workspaceId: "22222222-2222-4222-8222-222222222222",
      connectionId: "33333333-3333-4333-8333-333333333333",
      mediaAssetId: "44444444-4444-4444-8444-444444444444",
      mediaStorageKey: "workspace/image.jpg",
      boardId: "board-1",
      boardSectionId: null,
      title: "Safe retry",
      description: "Description",
      altText: "Alternative text",
      destinationUrl: null,
      scheduledForUtc: null,
      scheduleTimezone: null,
    };
    publicationFindFirst.mockResolvedValue({
      id: "job-1",
      pinDraftId: snapshot.draftId,
      status: "RUNNING",
      attemptCount: 2,
      maxAttempts: 5,
      candidatePinterestPinId: "pin-existing",
      pinDraft: {
        id: snapshot.draftId,
        version: 2,
        connectionId: snapshot.connectionId,
        mediaAssetId: snapshot.mediaAssetId,
        connection: {
          status: "CONNECTED",
          encryptedAccessToken: Buffer.from("encrypted"),
        },
        mediaAsset: {
          status: "READY",
          storageKey: snapshot.mediaStorageKey,
        },
        approvals: [{ draftVersion: 2, contentSnapshot: snapshot }],
      },
    });
    const tx = {
      publishedPin: { upsert: vi.fn().mockResolvedValue({}) },
      publicationJob: { update: vi.fn().mockResolvedValue({}) },
      publicationAttempt: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      pinDraft: { update: vi.fn().mockResolvedValue({}) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    const pinterest = {
      createImagePin: vi.fn(),
      getPin: vi.fn().mockResolvedValue({ id: "pin-existing" }),
    };
    const secret = process.env.SESSION_SECRET!;
    const executionToken = createHmac("sha256", secret)
      .update("publication:job-1")
      .digest("hex");
    const service = new PublishingService(
      {} as never,
      pinterest as never,
      { validAccessToken: vi.fn().mockResolvedValue("access-token") } as never,
      {
        createRetrievalUrl: vi.fn().mockResolvedValue("https://media.test/a"),
      } as never,
    );

    await expect(
      service.execute("job-1", executionToken),
    ).resolves.toMatchObject({
      pinterestPinId: "pin-existing",
    });
    expect(pinterest.createImagePin).not.toHaveBeenCalled();
    expect(pinterest.getPin).toHaveBeenCalledWith(
      "access-token",
      "pin-existing",
    );
    expect(publicationUpdate).not.toHaveBeenCalled();
  });
});
