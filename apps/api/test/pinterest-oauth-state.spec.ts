import { beforeEach, describe, expect, it, vi } from "vitest";

const { oauthFind, oauthUpdateMany, transaction } = vi.hoisted(() => ({
  oauthFind: vi.fn(),
  oauthUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@pindash/database", () => ({
  database: {
    oAuthTransaction: { findUnique: oauthFind, updateMany: oauthUpdateMany },
    $transaction: transaction,
  },
  ConnectionStatus: { CONNECTED: "CONNECTED" },
  PinStatus: {},
}));

import { PinterestOAuthService } from "../src/pinterest/pinterest-oauth.service";
import { PinterestController } from "../src/pinterest/pinterest.controller";

const validTransaction = {
  id: "oauth-1",
  workspaceId: "workspace-1",
  createdByUserId: "user-1",
  redirectUri: "http://localhost/callback",
  consumedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
};

describe("Pinterest OAuth state lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PINTEREST_CLIENT_ID = "client";
    process.env.PINTEREST_CLIENT_SECRET = "secret";
    process.env.PINTEREST_REDIRECT_URI = "http://localhost/callback";
  });

  it("rejects an invalid state", async () => {
    oauthFind.mockResolvedValue(null);
    await expect(
      new PinterestOAuthService({} as never).complete("code", "bad"),
    ).rejects.toThrow("invalid or expired");
  });

  it("rejects expired and previously consumed states", async () => {
    const service = new PinterestOAuthService({} as never);
    oauthFind.mockResolvedValueOnce({
      ...validTransaction,
      expiresAt: new Date(0),
    });
    await expect(service.complete("code", "expired")).rejects.toThrow(
      "invalid or expired",
    );
    oauthFind.mockResolvedValueOnce({
      ...validTransaction,
      consumedAt: new Date(),
    });
    await expect(service.complete("code", "reused")).rejects.toThrow(
      "invalid or expired",
    );
  });

  it("consumes state and completes a successful connection", async () => {
    oauthFind.mockResolvedValue(validTransaction);
    oauthUpdateMany.mockResolvedValue({ count: 1 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: "access",
              refresh_token: "refresh",
              expires_in: 3600,
              scope: "boards:read,pins:read,pins:write",
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ username: "brand-account" }), {
            status: 200,
          }),
        ),
    );
    const tx = {
      pinterestConnection: {
        upsert: vi.fn().mockResolvedValue({ id: "connection-1" }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    const crypto = { encrypt: vi.fn((value: string) => Buffer.from(value)) };
    await expect(
      new PinterestOAuthService(crypto as never).complete("code", "state"),
    ).resolves.toBeUndefined();
    expect(oauthUpdateMany).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it("redirects a Pinterest denial without consuming state", async () => {
    const oauth = { complete: vi.fn() };
    const reply = {
      status: vi.fn().mockReturnThis(),
      redirect: vi.fn((url: string) => url),
    };
    await new PinterestController(oauth as never).callback(
      "",
      "",
      "access_denied",
      reply as never,
    );
    expect(reply.status).toHaveBeenCalledWith(302);
    expect(reply.redirect).toHaveBeenCalledWith(
      expect.stringContaining("status=denied"),
    );
    expect(oauth.complete).not.toHaveBeenCalled();
  });
});
