import { Injectable } from "@nestjs/common";
import {
  PinterestPinResultSchema,
  type PinterestImagePinRequest,
  type PinterestPinResult,
} from "@pindash/contracts";

export type PinterestErrorKind =
  | "authentication"
  | "permission"
  | "rate_limit"
  | "validation"
  | "temporary"
  | "unknown";

export class PinterestApiError extends Error {
  constructor(
    message: string,
    readonly kind: PinterestErrorKind,
    readonly status: number,
    readonly requestId?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "PinterestApiError";
  }

  get retryable(): boolean {
    return this.kind === "rate_limit" || this.kind === "temporary";
  }
}

function errorKind(status: number): PinterestErrorKind {
  if (status === 401) return "authentication";
  if (status === 403) return "permission";
  if (status === 429) return "rate_limit";
  if (status >= 400 && status < 500) return "validation";
  if (status >= 500) return "temporary";
  return "unknown";
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1_000));
}

@Injectable()
export class PinterestApiClient {
  private readonly baseUrl = (
    process.env.PINTEREST_API_BASE_URL ?? "https://api-sandbox.pinterest.com/v5"
  ).replace(/\/$/, "");

  async createImagePin(
    accessToken: string,
    input: PinterestImagePinRequest,
  ): Promise<PinterestPinResult> {
    return this.request(accessToken, "/pins", {
      method: "POST",
      body: JSON.stringify({
        board_id: input.boardId,
        board_section_id: input.boardSectionId,
        title: input.title,
        description: input.description,
        alt_text: input.altText,
        link: input.destinationUrl,
        media_source: {
          source_type: "image_url",
          url: input.mediaUrl,
        },
      }),
    });
  }

  async getPin(
    accessToken: string,
    pinterestPinId: string,
  ): Promise<PinterestPinResult> {
    return this.request(
      accessToken,
      `/pins/${encodeURIComponent(pinterestPinId)}`,
      { method: "GET" },
    );
  }

  private async request(
    accessToken: string,
    path: string,
    init: RequestInit,
  ): Promise<PinterestPinResult> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const requestId =
      response.headers.get("x-pinterest-request-id") ?? undefined;
    if (!response.ok) {
      throw new PinterestApiError(
        `Pinterest request failed with status ${response.status}`,
        errorKind(response.status),
        response.status,
        requestId,
        parseRetryAfter(response.headers.get("retry-after")),
      );
    }
    const parsed = PinterestPinResultSchema.safeParse(await response.json());
    if (!parsed.success)
      throw new PinterestApiError(
        "Pinterest returned an invalid response",
        "unknown",
        response.status,
        requestId,
      );
    return parsed.data;
  }
}
