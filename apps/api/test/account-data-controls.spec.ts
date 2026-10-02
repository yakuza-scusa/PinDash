import { beforeEach, describe, expect, it, vi } from "vitest";

const { userFindUnique, transaction } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@pindash/database", () => ({
  database: { user: { findUnique: userFindUnique }, $transaction: transaction },
  MembershipRole: { OWNER: "OWNER" },
}));

import { SessionService } from "../src/auth/session.service";

describe("account data controls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports customer data without credentials", async () => {
    userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      memberships: [
        {
          role: "OWNER",
          workspace: {
            id: "workspace-1",
            mediaAssets: [{ id: "media-1", byteSize: 42n }],
          },
        },
      ],
    });
    const result = await new SessionService().exportUserData("user-1");
    expect(result.memberships[0]?.workspace.mediaAssets[0]?.byteSize).toBe(
      "42",
    );
    expect(JSON.stringify(result)).not.toMatch(
      /accessToken|refreshToken|storageKey|tokenHash/,
    );
  });

  it("requires an exact phrase then deletes owned workspaces and user", async () => {
    const service = new SessionService();
    await expect(service.deleteAccount("user-1", "delete")).rejects.toThrow(
      "DELETE MY ACCOUNT",
    );
    const tx = {
      workspace: { deleteMany: vi.fn() },
      user: { delete: vi.fn() },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    await service.deleteAccount("user-1", "DELETE MY ACCOUNT");
    expect(tx.workspace.deleteMany).toHaveBeenCalledWith({
      where: { ownerUserId: "user-1" },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });
});
