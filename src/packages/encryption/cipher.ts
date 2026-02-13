import config from "config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

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
  const cipher = createCipheriv(CIPHER_ALGO, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string) {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = createDecipheriv(CIPHER_ALGO, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}
