import { beforeEach, describe, expect, it, vi } from "vitest";

const connectionFindFirst = vi.hoisted(() => vi.fn());
vi.mock("@pindash/database", () => ({
  database: { pinterestConnection: { findFirst: connectionFindFirst } },
  ConnectionStatus: {},
  PinStatus: {},
}));

import { PinterestOAuthService } from "../src/pinterest/pinterest-oauth.service";

describe("Pinterest boards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PINTEREST_CLIENT_ID = "client";
    process.env.PINTEREST_CLIENT_SECRET = "secret";
    process.env.PINTEREST_REDIRECT_URI = "http://localhost/callback";
    connectionFindFirst.mockResolvedValue({ id: "connection-1" });
  });

  it.each([[401], [403], [429], [500]])(
    "maps Pinterest %s board responses",
    async (status) => {
      const service = new PinterestOAuthService({} as never);
      vi.spyOn(service, "validAccessToken").mockResolvedValue("token");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("{}", { status })),
      );
      await expect(
        service.listBoards("user-1", "connection-1"),
      ).rejects.toMatchObject({ status: status === 500 ? 502 : status });
    },
  );

  it("forwards bookmarks and caches the short-lived page", async () => {
    const service = new PinterestOAuthService({} as never);
    vi.spyOn(service, "validAccessToken").mockResolvedValue("token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id: "board-1", name: "Campaign", privacy: "PUBLIC" }],
          bookmark: "next",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await service.listBoards("user-1", "connection-1", "page-2");
    await service.listBoards("user-1", "connection-1", "page-2");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("bookmark=page-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
