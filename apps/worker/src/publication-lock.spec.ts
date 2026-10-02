import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@pindash/database", () => ({
  database: { $transaction: transaction },
  JobStatus: { QUEUED: "QUEUED", RUNNING: "RUNNING" },
}));

import { claimPublicationJob } from "./publication-lock";

describe("claimPublicationJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomically claims a queued job and records its attempt", async () => {
    const tx = {
      publicationJob: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "job-1",
          pinDraftId: "draft-1",
          attemptCount: 2,
        }),
      },
      publicationAttempt: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );

    const result = await claimPublicationJob("job-1", "worker-a");

    expect(result).toMatchObject({
      id: "job-1",
      attemptNumber: 2,
      lockedBy: "worker-a",
    });
    expect(tx.publicationJob.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", status: "QUEUED", lockedAt: null },
      data: expect.objectContaining({
        status: "RUNNING",
        lockedBy: "worker-a",
        attemptCount: { increment: 1 },
      }),
    });
    expect(tx.publicationAttempt.create).toHaveBeenCalledWith({
      data: { publicationJobId: "job-1", attemptNumber: 2 },
    });
  });

  it("returns null when another worker already owns the job", async () => {
    const tx = {
      publicationJob: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      publicationAttempt: { create: vi.fn() },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(claimPublicationJob("job-1", "worker-b")).resolves.toBeNull();
    expect(tx.publicationAttempt.create).not.toHaveBeenCalled();
  });
});
