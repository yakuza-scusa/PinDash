import { afterEach, describe, expect, it } from "vitest";
import { TokenCryptoService } from "../src/pinterest/token-crypto.service";

const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

afterEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("TokenCryptoService", () => {
  it("encrypts with a random nonce and decrypts without exposing plaintext", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const service = new TokenCryptoService();
    const first = service.encrypt("pina_secret_token");
    const second = service.encrypt("pina_secret_token");

    expect(first.equals(second)).toBe(false);
    expect(first.toString()).not.toContain("pina_secret_token");
    expect(service.decrypt(first)).toBe("pina_secret_token");
  });
});
