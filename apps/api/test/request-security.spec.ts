import { describe, expect, it } from "vitest";
import { csrfAllowed, RequestRateLimiter } from "../src/request-security";

describe("request security", () => {
  it("rejects cross-origin cookie-authenticated mutations", () => {
    expect(
      csrfAllowed({
        method: "POST",
        url: "/api/v1/pins",
        origin: "https://evil.example",
        cookie: "pindash_session=secret",
        webUrl: "https://app.example",
        cookieName: undefined,
      }),
    ).toBe(false);
    expect(
      csrfAllowed({
        method: "POST",
        url: "/api/v1/pins",
        origin: "https://app.example",
        cookie: "pindash_session=secret",
        webUrl: "https://app.example",
        cookieName: undefined,
      }),
    ).toBe(true);
    expect(
      csrfAllowed({
        method: "DELETE",
        url: "/api/v1/auth/account",
        origin: "https://app.example",
        cookie: "pindash_session=secret",
        webUrl: "https://app.example/",
        cookieName: undefined,
      }),
    ).toBe(true);
  });

  it("limits repeated requests per key and resets its window", () => {
    const limiter = new RequestRateLimiter(2, 1000);
    expect(limiter.allow("ip", 0)).toBe(true);
    expect(limiter.allow("ip", 1)).toBe(true);
    expect(limiter.allow("ip", 2)).toBe(false);
    expect(limiter.allow("ip", 1001)).toBe(true);
  });
});
