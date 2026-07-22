/**
 * Cấu hình module Shopee Video Upload (tách khỏi affiliate-scene).
 *
 * - SHOPEE_SIGNER_BASE_URL / SHOPEE_SIGNER_API_KEY → credit server ngoài
 *   (mặc định https://credit.toolshopee.vn)
 * - Pipeline gọi adapter trực tiếp (native → credit), không nhầm URL nội bộ.
 */
export type ShopeeSignerAdapterName = "stub" | "native";

function env(name: string, fallback = ""): string {
  return String(process.env[name] ?? fallback).trim();
}

function envBool(name: string, fallback = false): boolean {
  const raw = env(name).toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Port server chính — dùng khi base URL nội bộ không set */
function guessLocalPort(): string {
  return env("PORT", "4444") || "4444";
}

const DEFAULT_CREDIT_URL = "http://178.105.110.35:47832";

export const shopeeUploadConfig = {
  /**
   * URL signer/credit server (base, hoặc dán cả .../sign cũng được).
   * Env: SHOPEE_SIGNER_BASE_URL — ví dụ http://178.105.110.35:47832
   */
  get creditBaseUrl(): string {
    const fromEnv = env("SHOPEE_SIGNER_BASE_URL");
    return (fromEnv || DEFAULT_CREDIT_URL).replace(/\/+$/, "");
  },

  /** Alias hiển thị UI / backward-compat */
  get signerBaseUrl(): string {
    return this.creditBaseUrl;
  },

  /** API key credit server — Env: SHOPEE_SIGNER_API_KEY */
  get creditApiKey(): string {
    return env("SHOPEE_SIGNER_API_KEY");
  },

  /** Alias backward-compat */
  get signerApiKey(): string {
    return this.creditApiKey || "local-dev-key";
  },

  /**
   * URL signer nội bộ (route debug / tách process).
   * Không dùng cho native credit.
   */
  get internalSignerUrl(): string {
    const fromEnv = env("SHOPEE_INTERNAL_SIGNER_URL");
    if (fromEnv) return fromEnv.replace(/\/+$/, "");
    return `http://127.0.0.1:${guessLocalPort()}/api/internal/shopee-signer`;
  },

  get internalApiKey(): string {
    return env("SHOPEE_INTERNAL_SIGNER_KEY", "local-dev-key");
  },

  get signerAdapter(): ShopeeSignerAdapterName {
    const raw = env("SHOPEE_SIGNER_ADAPTER", "stub").toLowerCase();
    return raw === "native" ? "native" : "stub";
  },

  /**
   * true = không gọi Shopee thật; pipeline giả lập thành công để test queue/UI.
   * Mặc định true khi signer = stub để tránh spam Shopee với header giả.
   */
  get dryRun(): boolean {
    if (env("SHOPEE_UPLOAD_DRY_RUN")) return envBool("SHOPEE_UPLOAD_DRY_RUN", true);
    return this.signerAdapter === "stub";
  },
};
