/**
 * Cấu hình module Shopee Video Upload (tách khỏi affiliate-scene).
 * Đọc từ process.env — không dùng credit.toolshopee.vn.
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

export const shopeeUploadConfig = {
  /** Base URL signer nội bộ (tương thích credit API) */
  get signerBaseUrl(): string {
    const fromEnv = env("SHOPEE_SIGNER_BASE_URL");
    if (fromEnv) return fromEnv.replace(/\/+$/, "");
    return `http://127.0.0.1:${guessLocalPort()}/api/internal/shopee-signer`;
  },

  get signerApiKey(): string {
    return env("SHOPEE_SIGNER_API_KEY", "local-dev-key");
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
