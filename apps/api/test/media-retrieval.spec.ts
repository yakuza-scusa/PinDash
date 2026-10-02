import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@pindash/database", () => ({
  database: { mediaAsset: { findFirst } },
  MediaStatus: { READY: "READY", UPLOADING: "UPLOADING", REJECTED: "REJECTED" },
}));

import { MediaService } from "../src/media/media.service";

describe("Pinterest media retrieval links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters";
    process.env.PUBLIC_API_URL = "https://media.example.com";
  });

  afterEach(() => {
    delete process.env.PUBLIC_API_URL;
  });

  it("creates a signed, short-lived public HTTPS URL for ready media", async () => {
    findFirst.mockResolvedValue({ id: "asset-1" });
    const url = new URL(
      await new MediaService().createRetrievalUrl("workspace/image.jpg"),
    );
    expect(url.origin).toBe("https://media.example.com");
    expect(url.pathname).toBe("/api/v1/media/retrieve/asset-1");
    expect(url.searchParams.get("signature")).toMatch(/^[a-f0-9]{64}$/);
    const lifetime =
      Number(url.searchParams.get("expires")) - Math.floor(Date.now() / 1000);
    expect(lifetime).toBeGreaterThanOrEqual(595);
    expect(lifetime).toBeLessThanOrEqual(600);
  });

  it("rejects a tampered retrieval signature before loading media", async () => {
    await expect(
      new MediaService().retrieveForPinterest(
        "asset-1",
        String(Math.floor(Date.now() / 1000) + 300),
        "0".repeat(64),
      ),
    ).rejects.toThrow("invalid or expired");
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("requires a public HTTPS API origin", async () => {
    process.env.PUBLIC_API_URL = "http://localhost:4000";
    await expect(
      new MediaService().createRetrievalUrl("workspace/image.jpg"),
    ).rejects.toThrow("public HTTPS address");
  });
});
