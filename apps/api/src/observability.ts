import { randomUUID } from "node:crypto";

const SENSITIVE_QUERY = /([?&](?:code|state|token|signature|secret)=)[^&]*/gi;

export function correlationId(value: unknown): string {
  return typeof value === "string" && /^[a-zA-Z0-9._-]{8,128}$/.test(value)
    ? value
    : randomUUID();
}

export function safeRequestPath(url: string): string {
  return url.replace(SENSITIVE_QUERY, "$1[REDACTED]");
}
