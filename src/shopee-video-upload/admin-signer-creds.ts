/**
 * Đọc cấu hình Signer từ Admin Settings.
 * Ưu tiên: per-request override → admin setting → env.
 */
import { SettingHelper } from "../packages/setting-helper";
import { shopeeUploadConfig } from "./config";
import { SignerCreds } from "./signer/creds-context";

export const SHOPEE_SIGNER_BASE_URL_KEY = "shopee-signer-base-url";
export const SHOPEE_SIGNER_API_KEY_KEY = "shopee-signer-api-key";

export type AdminSignerCreds = {
  baseUrl: string;
  apiKey: string;
  source: "override" | "admin" | "env";
};

async function loadAdminRaw(): Promise<{ baseUrl: string; apiKey: string }> {
  try {
    const [baseUrlRaw, apiKeyRaw] = await SettingHelper.loadMany(
      [SHOPEE_SIGNER_BASE_URL_KEY, SHOPEE_SIGNER_API_KEY_KEY],
      { secure: false }
    );
    return {
      baseUrl: String(baseUrlRaw ?? "").trim(),
      apiKey: String(apiKeyRaw ?? "").trim(),
    };
  } catch {
    return { baseUrl: "", apiKey: "" };
  }
}

/**
 * Resolve credentials hiệu lực cho 1 lần upload / check balance.
 * `override` dành cho per-customer sau này (job payload).
 */
export async function resolveEffectiveSignerCreds(
  override?: SignerCreds
): Promise<AdminSignerCreds> {
  const ovBase = String(override?.baseUrl || "").trim();
  const ovKey = String(override?.apiKey || "").trim();
  if (ovBase || ovKey) {
    const admin = await loadAdminRaw();
    return {
      baseUrl: ovBase || admin.baseUrl || shopeeUploadConfig.creditBaseUrl,
      apiKey: ovKey || admin.apiKey || shopeeUploadConfig.creditApiKey,
      source: "override",
    };
  }

  const admin = await loadAdminRaw();
  if (admin.baseUrl || admin.apiKey) {
    return {
      baseUrl: admin.baseUrl || shopeeUploadConfig.creditBaseUrl,
      apiKey: admin.apiKey || shopeeUploadConfig.creditApiKey,
      source: "admin",
    };
  }

  return {
    baseUrl: shopeeUploadConfig.creditBaseUrl,
    apiKey: shopeeUploadConfig.creditApiKey,
    source: "env",
  };
}
