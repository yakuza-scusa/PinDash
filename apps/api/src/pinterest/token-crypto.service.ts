import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

@Injectable()
export class TokenCryptoService {
  private getKey(): Buffer {
    const encoded = process.env.TOKEN_ENCRYPTION_KEY;
    const key = encoded ? Buffer.from(encoded, "base64") : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        "TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
      );
    }
    return key;
  }

  encrypt(value: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.getKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  }

  decrypt(payload: Buffer): string {
    const iv = payload.subarray(0, 12);
    const authTag = payload.subarray(12, 28);
    const decipher = createDecipheriv("aes-256-gcm", this.getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(payload.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  }
}
