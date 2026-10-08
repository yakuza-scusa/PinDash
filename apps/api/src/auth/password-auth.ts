import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const DUMMY_HASH =
  "scrypt$16fd04eaef383b6ddc88ec11e4f4be36$bdc373b0afeb18a2be3f39482285a745ad160bf458174c186b10d5e75c16726f02e3ea96674f1226801895dcbd9ee1743f3f15255eb75e4371ec39e501ec46d7";

export function validatePassword(password: string): void {
  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters");
  }
  if (password.length > 128) {
    throw new Error("Password must contain at most 128 characters");
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  const candidate = storedHash ?? DUMMY_HASH;
  const [algorithm, salt, encoded] = candidate.split("$");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(encoded, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;
  const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(actual, expected) && Boolean(storedHash);
}
