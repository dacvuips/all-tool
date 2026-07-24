/**
 * Per-request / per-customer signer credentials.
 * Ưu tiên hơn env SHOPEE_SIGNER_* — mỗi customer có thể có baseUrl + apiKey riêng.
 */
import { AsyncLocalStorage } from "async_hooks";

export type SignerCreds = {
  /** Credit/sign server base URL, vd http://IP:port hoặc .../sign */
  baseUrl?: string;
  /** Host riêng cho /api/me (optional) */
  meBaseUrl?: string;
  /** API key credit */
  apiKey?: string;
};

export const signerCredsAls = new AsyncLocalStorage<SignerCreds>();

export function getSignerCreds(): SignerCreds {
  return signerCredsAls.getStore() || {};
}

export async function withSignerCreds<T>(
  creds: SignerCreds | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const cleaned: SignerCreds = {
    baseUrl: String(creds?.baseUrl || "").trim() || undefined,
    meBaseUrl: String(creds?.meBaseUrl || "").trim() || undefined,
    apiKey: String(creds?.apiKey || "").trim() || undefined,
  };
  if (!cleaned.baseUrl && !cleaned.meBaseUrl && !cleaned.apiKey) {
    return fn();
  }
  // Một số @types/node khai báo ALS.run trả void — bọc Promise để type an toàn
  return new Promise<T>((resolve, reject) => {
    signerCredsAls.run(cleaned, () => {
      Promise.resolve()
        .then(() => fn())
        .then(resolve, reject);
    });
  });
}

export function resolveSignerBaseUrl(fallback: string): string {
  const fromStore = String(getSignerCreds().baseUrl || "").trim();
  return (fromStore || fallback).replace(/\/+$/, "");
}

export function resolveSignerApiKey(fallback: string): string {
  const fromStore = String(getSignerCreds().apiKey || "").trim();
  return fromStore || fallback;
}
