import { decrypt, encrypt } from "./cipher";

const SUB_MASK = "mmsk.";

export function encryptProviderSecret(text: string): string {
  const encrypted = encrypt(text);

  return SUB_MASK + encrypted;
}

export function decryptProviderSecret(text: string): string {
  let encryptedSecret = text;

  if (isEncryptedText(text)) {
    encryptedSecret = text.slice(SUB_MASK.length);
  }

  return decrypt(encryptedSecret);
}

function isEncryptedText(text: string): boolean {
  return text.startsWith(SUB_MASK);
}
