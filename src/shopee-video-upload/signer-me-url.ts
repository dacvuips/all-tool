/**
 * Resolve URL gọi /api/me (check credit) — chuẩn MLS: cùng host với credit_url/sign.
 * Chỉ thêm host khác khi admin/env cấu hình rõ (shopee-signer-me-base-url).
 */
import { SettingHelper } from "../packages/setting-helper";
import { shopeeUploadConfig } from "./config";
import { normalizeSignerBaseUrl } from "./signer/url";

export const SHOPEE_SIGNER_ME_BASE_URL_KEY = "shopee-signer-me-base-url";

function env(name: string, fallback = ""): string {
  return String(process.env[name] ?? fallback).trim();
}

/**
 * Danh sách base URL để thử /api/me (theo thứ tự).
 * Không tự ép credit.toolshopee.vn — tránh 403 khi API key chỉ dùng cho máy sign IP.
 */
export async function resolveSignerMeRoots(
  signBaseUrl?: string,
  meBaseUrlOverride?: string
): Promise<string[]> {
  let fromAdmin = "";
  try {
    const raw = await SettingHelper.load(SHOPEE_SIGNER_ME_BASE_URL_KEY, { secure: false });
    fromAdmin = String(raw ?? "").trim();
  } catch {
    /* ignore */
  }

  const fromEnv = env("SHOPEE_SIGNER_ME_BASE_URL");
  const signRoot = normalizeSignerBaseUrl(signBaseUrl || shopeeUploadConfig.creditBaseUrl || "");
  const explicit = normalizeSignerBaseUrl(meBaseUrlOverride || fromAdmin || fromEnv);

  const roots: string[] = [];
  const push = (u: string) => {
    const n = normalizeSignerBaseUrl(u);
    if (n && !roots.includes(n)) roots.push(n);
  };

  // MLS: check /api/me trên cùng host với sign trước
  if (signRoot) push(signRoot);
  // Host me riêng (nếu khác)
  if (explicit) push(explicit);

  return roots;
}
