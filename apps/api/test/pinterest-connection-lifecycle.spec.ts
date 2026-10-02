import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectionFindUnique,
  connectionFindFirst,
  connectionUpdateMany,
  connectionUpdate,
  transaction,
  memberFindMany,
  notificationCreateMany,
} = vi.hoisted(() => ({
  connectionFindUnique: vi.fn(),
  connectionFindFirst: vi.fn(),
  connectionUpdateMany: vi.fn(),
  connectionUpdate: vi.fn(),
  transaction: vi.fn(),
  memberFindMany: vi.fn().mockResolvedValue([]),
  notificationCreateMany: vi.fn(),
}));

vi.mock("@pindash/database", () => ({
  database: {
    pinterestConnection: {
      findUnique: connectionFindUnique,
      findFirst: connectionFindFirst,
      updateMany: connectionUpdateMany,
      update: connectionUpdate,
    },
    $transaction: transaction,
    workspaceMember: { findMany: memberFindMany },
    notification: { createMany: notificationCreateMany },
  },
  ConnectionStatus: {
    CONNECTED: "CONNECTED",
    EXPIRING: "EXPIRING",
    REFRESH_FAILED: "REFRESH_FAILED",
    REVOKED: "REVOKED",
    DISCONNECTED: "DISCONNECTED",
  },
  PinStatus: {
    PUBLISHED: "PUBLISHED",
    CANCELLED: "CANCELLED",
    CONNECTION_REQUIRED: "CONNECTION_REQUIRED",
  },
}));

import { PinterestOAuthService } from "../src/pinterest/pinterest-oauth.service";

const baseConnection = {
  id: "connection-1",
  workspaceId: "workspace-1",
  status: "CONNECTED",
  encryptedAccessToken: Buffer.from("old-access"),
  encryptedRefreshToken: Buffer.from("old-refresh"),
  accessTokenExpiresAt: new Date(Date.now() + 30_000),
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000),
  grantedScopes: ["pins:write"],
  updatedAt: new Date("2026-10-02T12:00:00Z"),
};

describe("Pinterest connection lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PINTEREST_CLIENT_ID = "client-id";
    process.env.PINTEREST_CLIENT_SECRET = "client-secret";
    process.env.PINTEREST_REDIRECT_URI = "http://localhost/callback";
  });

  it("atomically refreshes and continuously rotates both tokens", async () => {
    connectionFindUnique.mockResolvedValue(baseConnection);
    connectionUpdateMany.mockResolvedValue({ count: 1 });
    connectionUpdate.mockResolvedValue({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 3600,
            refresh_token_expires_in: 86400,
            scope: "pins:write,boards:read",
          }),
          { status: 200 },
        ),
      ),
    );
    const crypto = {
      decrypt: vi.fn((value: Buffer) => value.toString()),
      encrypt: vi.fn((value: string) => Buffer.from(`enc:${value}`)),
    };
    const token = await new PinterestOAuthService(
      crypto as never,
    ).validAccessToken(baseConnection.id);

    expect(token).toBe("new-access");
    expect(connectionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "CONNECTED" }),
        data: { status: "EXPIRING" },
      }),
    );
    expect(connectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encryptedAccessToken: Buffer.from("enc:new-access"),
          encryptedRefreshToken: Buffer.from("enc:new-refresh"),
          status: "CONNECTED",
        }),
      }),
    );
  });

  it("uses the winner's token when another request owns the refresh lock", async () => {
    connectionFindUnique
      .mockResolvedValueOnce(baseConnection)
      .mockResolvedValueOnce({
        ...baseConnection,
        encryptedAccessToken: Buffer.from("winner-access"),
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      });
    connectionUpdateMany.mockResolvedValue({ count: 0 });
    const crypto = {
      decrypt: vi.fn((value: Buffer) => value.toString()),
      encrypt: vi.fn(),
    };
    await expect(
      new PinterestOAuthService(crypto as never).validAccessToken(
        baseConnection.id,
      ),
    ).resolves.toBe("winner-access");
    expect(connectionUpdate).not.toHaveBeenCalled();
  });

  it("removes credentials and invalidates unfinished drafts on disconnect", async () => {
    connectionFindFirst.mockResolvedValue(baseConnection);
    const tx = {
      pinterestConnection: { update: vi.fn().mockResolvedValue({}) },
      pinDraft: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    const result = await new PinterestOAuthService({} as never).disconnect(
      "user-1",
      baseConnection.id,
    );
    expect(result).toEqual({ disconnected: true });
    expect(tx.pinterestConnection.update).toHaveBeenCalledWith({
      where: { id: baseConnection.id },
      data: {
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        status: "DISCONNECTED",
      },
    });
    expect(tx.pinDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "CONNECTION_REQUIRED" },
      }),
    );
  });
});
