import config from "config";
import {
  type BinaryLike,
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const rawKey = config.get<string>("store.encryptionKey");

if (!rawKey) {
  throw new Error(
    "CRITICAL: STORE_ENCRYPTION_KEY is not set! " +
      "Set the environment variable STORE_ENCRYPTION_KEY to a secure random string. " +
      "WARNING: Changing this key will make all existing encrypted data unrecoverable!"
  );
}

// Ensure key is exactly 32 bytes for AES-256
const ENCRYPTION_KEY = createHash("sha256").update(rawKey).digest();
const IV_LENGTH = 16;
const CIPHER_ALGO = "aes-256-cbc";

export function encrypt(text: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(
    CIPHER_ALGO,
    ENCRYPTION_KEY as unknown as BinaryLike,
    iv as unknown as BinaryLike
  );
  const part1 = cipher.update(text);
  const part2 = cipher.final();
  const encrypted = Buffer.concat(
    [
      Buffer.isBuffer(part1) ? part1 : Buffer.from(part1 as Buffer),
      Buffer.isBuffer(part2) ? part2 : Buffer.from(part2 as Buffer),
    ] as unknown as readonly Uint8Array[]
  );

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string) {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift() ?? "", "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = createDecipheriv(
    CIPHER_ALGO,
    ENCRYPTION_KEY as unknown as BinaryLike,
    iv as unknown as BinaryLike
  );
  const part1 = decipher.update(encryptedText as unknown as NodeJS.ArrayBufferView);
  const part2 = decipher.final();
  const decrypted = Buffer.concat(
    [
      Buffer.isBuffer(part1) ? part1 : Buffer.from(part1 as Buffer),
      Buffer.isBuffer(part2) ? part2 : Buffer.from(part2 as Buffer),
    ] as unknown as readonly Uint8Array[]
  );

  return decrypted.toString();
}
