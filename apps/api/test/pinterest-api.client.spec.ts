import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PinterestApiClient,
  PinterestApiError,
} from "../src/pinterest/pinterest-api.client";

describe("PinterestApiClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates an image Pin with the v5 payload and returns a typed result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "pin-123", title: "Launch" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new PinterestApiClient().createImagePin("secret", {
      boardId: "board-1",
      title: "Launch",
      description: "Description",
      altText: "Alt text",
      destinationUrl: "https://example.com",
      mediaUrl: "https://media.example.com/image.jpg",
    });
    expect(result.id).toBe("pin-123");
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      board_id: "board-1",
      media_source: {
        source_type: "image_url",
        url: "https://media.example.com/image.jpg",
      },
    });
  });

  it("classifies rate limits without exposing the upstream response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: "sensitive upstream details" }),
          {
            status: 429,
            headers: { "retry-after": "30", "x-pinterest-request-id": "req-1" },
          },
        ),
      ),
    );
    const error = await new PinterestApiClient()
      .getPin("secret", "pin-123")
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      kind: "rate_limit",
      retryable: true,
      retryAfterSeconds: 30,
      requestId: "req-1",
    } satisfies Partial<PinterestApiError>);
    expect((error as Error).message).not.toContain(
      "sensitive upstream details",
    );
  });

  it("parses an HTTP-date Retry-After header", async () => {
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", {
          status: 503,
          headers: { "retry-after": "Fri, 02 Oct 2026 12:00:45 GMT" },
        }),
      ),
    );
    const error = await new PinterestApiClient()
      .getPin("secret", "pin-123")
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      kind: "temporary",
      retryable: true,
      retryAfterSeconds: 45,
    });
    vi.useRealTimers();
  });
});
