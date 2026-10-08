import { describe, expect, it } from "vitest";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "../src/auth/password-auth";

describe("password authentication", () => {
  it("rejects passwords shorter than twelve characters", () => {
    expect(() => validatePassword("too-short")).toThrow(
      "at least 12 characters",
    );
  });

  it("rejects excessively long passwords", () => {
    expect(() => validatePassword("x".repeat(129))).toThrow(
      "at most 128 characters",
    );
  });

  it("stores a salted scrypt hash and verifies in constant-length form", async () => {
    const password = "correct horse battery staple";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(second).not.toBe(first);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(
      verifyPassword("incorrect password value", first),
    ).resolves.toBe(false);
  });

  it("performs a safe failed verification for absent or malformed hashes", async () => {
    await expect(verifyPassword("any password value", null)).resolves.toBe(
      false,
    );
    await expect(verifyPassword("any password value", "broken")).resolves.toBe(
      false,
    );
  });
});
