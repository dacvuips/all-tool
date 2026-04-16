import { GoogleGenAI } from "@google/genai";
import logger from "../../../helpers/logger";
import { credentialService } from "../../../libs/dal/credential";
import { CustomerModel } from "../../../libs/dal/customer";
import { AiProviderKeyEnum } from "../../../libs/dal/product";
import { decryptProviderSecret } from "../../../packages/encryption/encrypt-provider";

const AI_MAX_RETRIES = 5;
const SERVICE_UNAVAILABLE_RETRIES = 5;

/** Generate a simple UUID v4 string */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Helper: Gọi lại AI API tối đa AI_MAX_RETRIES lần nếu có lỗi.
 * Chỉ throw error nếu tất cả các lần gọi đều thất bại.
 */
export async function retryAICall<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      logger.warn(
        `[${label}] AI call failed (attempt ${attempt}/${AI_MAX_RETRIES}): ${err?.message}`
      );

      // Không retry nếu lỗi 403 (permission/reCAPTCHA), 401 (auth), hoặc 429 (hết quota) vì retry cũng không giải quyết được
      const errStatus = err?.statusCode || err?.status;
      if (errStatus === 403 || errStatus === 401 || errStatus === 429) {
        logger.warn(`[${label}] Lỗi không thể retry (${errStatus}), dừng ngay.`);
        break;
      }

      if (attempt === AI_MAX_RETRIES) {
        break;
      }
      // Wait before retrying (exponential backoff: 1s, 2s, 4s, 8s)
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

/** Helper: Tạo GoogleGenAI client dùng Gemini API Key */
function createGeminiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

/**
 * Helper: Parse danh sách API keys từ credential value.
 * Hỗ trợ nhiều key phân tách bằng dấu phẩy hoặc xuống dòng.
 */
function parseMultipleKeys(encryptedValue: string): string[] {
  const decrypted = decryptProviderSecret(encryptedValue);
  if (!decrypted) return [];
  return decrypted
    .split(/[,\n]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Helper chung: Lấy danh sách credential Gemini API keys của customer.
 * Trả về array GoogleGenAI clients (1 per key).
 * Throw error nếu chưa cấu hình key.
 */
export async function getAdminGeminiClients(): Promise<InstanceType<typeof GoogleGenAI>[]> {
  const credentialDoc = (await credentialService.findOne({
    key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
    isAdminCredential: true,
  })) as any;
  const credential = credentialDoc?._doc;
  if (!credential?.value) {
    const err: any = new Error("Chưa cấu hình Google Gemini API Key");
    err.statusCode = 403;
    throw err;
  }
  const apiKeys = parseMultipleKeys(credential.value);
  if (apiKeys.length === 0) {
    const err: any = new Error("Chưa cấu hình Google Gemini API Key");
    err.statusCode = 403;
    throw err;
  }
  // Xáo trộn ngẫu nhiên thứ tự API keys để phân tải đều
  for (let i = apiKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [apiKeys[i], apiKeys[j]] = [apiKeys[j], apiKeys[i]];
  }
  return apiKeys.map((k) => createGeminiClient(k));
}

/**
 * (Backward compat) Lấy 1 GoogleGenAI client duy nhất (key đầu tiên).
 */
export async function getGeminiClient(): Promise<InstanceType<typeof GoogleGenAI>> {
  const clients = await getAdminGeminiClients();
  return clients[0];
}

/**
 * Lấy GoogleGenAI client cho customer (hiện tại dùng admin key chung).
 * customerId được nhận nhưng chưa dùng vì chưa có customer-specific Gemini key.
 */
export async function getCustomerGeminiClient(
  _customerId: string
): Promise<InstanceType<typeof GoogleGenAI>> {
  return getGeminiClient();
}

/**
 * Kiểm tra xem error có phải lỗi 429 / quota exceeded không.
 * Gemini SDK trả về: { code: 429, status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota..." }
 */
function isRateLimitOrQuotaError(err: any): boolean {
  const numericCode = err?.code || err?.statusCode || err?.httpCode;
  if (numericCode === 429) return true;

  const statusStr = (err?.status || "").toString().toUpperCase();
  if (statusStr === "RESOURCE_EXHAUSTED") return true;
  if (Number(err?.status) === 429) return true;

  const msg = (err?.message || "").toLowerCase();
  if (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("429")
  )
    return true;

  return false;
}

/**
 * Kiểm tra xem error có phải lỗi 503 (Service Unavailable) không.
 */
function isServiceUnavailableError(err: any): boolean {
  const numericCode = err?.code || err?.statusCode || err?.httpCode;
  if (numericCode === 503) return true;
  if (Number(err?.status) === 503) return true;

  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("503") || msg.includes("service unavailable")) return true;

  return false;
}

/**
 * Gọi AI API với cơ chế xoay vòng nhiều API key:
 * - Nếu 429 / quota exceeded → nhảy sang API key tiếp theo.
 * - Nếu 503 → retry tối đa SERVICE_UNAVAILABLE_RETRIES lần cho key đó, rồi mới nhảy sang key tiếp.
 * - Các lỗi khác → throw ngay.
 * - Nếu tất cả key đều thất bại → throw error cuối cùng.
 */
export async function callWithKeyRotation<T>(
  clients: InstanceType<typeof GoogleGenAI>[],
  fn: (client: InstanceType<typeof GoogleGenAI>) => Promise<T>,
  label: string
): Promise<T> {
  let lastError: any;
  for (let keyIdx = 0; keyIdx < clients.length; keyIdx++) {
    const client = clients[keyIdx];
    const keyLabel = `key ${keyIdx + 1}/${clients.length}`;

    // Đối với mỗi key, thử gọi; nếu 503 thì retry tối đa SERVICE_UNAVAILABLE_RETRIES lần
    let retriesFor503 = 0;
    let shouldTryNextKey = false;

    while (true) {
      try {
        const result = await fn(client);
        return result;
      } catch (err: any) {
        lastError = err;

        if (isRateLimitOrQuotaError(err)) {
          logger.warn(
            `[${label}] ${keyLabel} bị 429/quota: ${err?.message}. Chuyển sang key tiếp theo.`
          );
          shouldTryNextKey = true;
          break;
        }

        if (isServiceUnavailableError(err)) {
          retriesFor503++;
          if (retriesFor503 >= SERVICE_UNAVAILABLE_RETRIES) {
            logger.warn(
              `[${label}] ${keyLabel} bị 503 sau ${retriesFor503} lần retry. Chuyển sang key tiếp theo.`
            );
            shouldTryNextKey = true;
            break;
          }
          logger.warn(
            `[${label}] ${keyLabel} bị 503 (lần ${retriesFor503}/${SERVICE_UNAVAILABLE_RETRIES}). Retry sau 3s...`
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }

        // Lỗi khác (400, 401, 403, 500...) → throw ngay
        logger.error(`[${label}] ${keyLabel} lỗi không thể retry: ${err?.message}`);
        throw err;
      }
    }

    if (!shouldTryNextKey) break;
  }

  // Tất cả key đều thất bại
  logger.error(`[${label}] Tất cả ${clients.length} API key đều thất bại.`);
  throw lastError;
}

/**
 * Helper: Lấy OpenAI API Key của customer, giải mã và trả về.
 * Throw error nếu chưa cấu hình key.
 */
export async function getCustomerOpenAIKey(customerId: string): Promise<string> {
  const credentialDoc = (await credentialService.findOne({
    customerId,
    key: AiProviderKeyEnum.OPENAI_KEY,
    isCustomerCredential: true,
  })) as any;
  const credential = credentialDoc?._doc;
  if (!credential?.value) {
    const err: any = new Error("Chưa cấu hình OpenAI API Key");
    err.statusCode = 403;
    throw err;
  }
  return decryptProviderSecret(credential.value);
}

/**
 * Helper: Lấy Google Labs Access Token và Project ID của customer.
 * Throw error nếu chưa cấu hình.
 */
export async function getCustomerGoogleLabsCredentials(): Promise<{
  googleLabsApiKey: string;
  geminiAPIKeys: string[];
}> {
  const [apiKeyDoc, geminiAPIKeyDoc] = await Promise.all([
    credentialService.findOne({
      key: AiProviderKeyEnum.GOOGLE_LABS_API_KEY,
      isAdminCredential: true,
    }),

    credentialService.findOne({
      key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
      isAdminCredential: true,
    }),
  ]);
  const apiKeyCred = (apiKeyDoc as any)?._doc;

  if (!apiKeyCred?.value) {
    const err: any = new Error("Chưa cấu hình Google Labs Access Token");
    err.statusCode = 403;
    throw err;
  }

  const geminiCred = (geminiAPIKeyDoc as any)?._doc;
  const geminiAPIKeys = geminiCred?.value ? parseMultipleKeys(geminiCred.value) : [];
  return {
    googleLabsApiKey: decryptProviderSecret(apiKeyCred.value),
    geminiAPIKeys,
  };
}

/**
 * Kiểm tra giới hạn ảnh của customer. Throw error 403 nếu vượt quá.
 */
export async function checkImageLimit(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.imageCount googlePackage.imageLimit")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const currentCount = customer.googlePackage?.imageCount || 0;
  const limit = customer.googlePackage?.imageLimit || 0;
  if (currentCount + 1 > limit) {
    const err: any = new Error(
      `Bạn đã vượt quá giới hạn ảnh (${currentCount}/${limit}). Vui lòng nâng cấp gói để tiếp tục.`
    );
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Kiểm tra giới hạn video của customer. Throw error 403 nếu vượt quá.
 */
export async function checkVideoLimit(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.videoCount googlePackage.videoLimit")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const currentCount = customer.googlePackage?.videoCount || 0;
  const limit = customer.googlePackage?.videoLimit || 0;
  if (currentCount + 1 > limit) {
    const err: any = new Error(
      `Bạn đã vượt quá giới hạn video (${currentCount}/${limit}). Vui lòng nâng cấp gói để tiếp tục.`
    );
    err.statusCode = 403;
    throw err;
  }
}

/** Tăng imageCount lên 1 sau khi tạo ảnh thành công */
export async function incrementImageCount(customerId: string): Promise<void> {
  await CustomerModel.findByIdAndUpdate(customerId, { $inc: { "googlePackage.imageCount": 1 } });
}

/** Tăng videoCount lên 1 sau khi tạo video thành công */
export async function incrementVideoCount(customerId: string): Promise<void> {
  await CustomerModel.findByIdAndUpdate(customerId, { $inc: { "googlePackage.videoCount": 1 } });
}

export interface AffiliateVideoFormConfig {
  category: string;
  objectToPersonify: string;
  tipContent: string;
  mood: string;
  language: string;
  artStyle: string;
  storyModeType: "prompt_to_video" | "image_to_video";
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  batchSize: number;
}

/**
 * Thay thế tất cả placeholder {{fieldName}} trong text bằng giá trị từ config
 */
export function interpolateTemplate(text: string, config: AffiliateVideoFormConfig): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = (config as any)[key];
    return value !== undefined && value !== null ? `"${String(value)}"` : "";
  });
}

/**
 * Upload ảnh lên Google Labs (aisandbox) và trả về media name.
 * Endpoint: POST https://aisandbox-pa.googleapis.com/v1/flow/uploadImage
 */
export async function uploadImageToGoogleLabs(
  imageBytes: string,
  mimeType: string,
  accessToken: string,
  projectId: string
): Promise<string> {
  const endpoint = "https://aisandbox-pa.googleapis.com/v1/flow/uploadImage";
  const fileName = `photo_${Date.now()}.jpg`;

  const payload = {
    clientContext: {
      projectId,
      tool: "PINHOLE",
    },
    imageBytes,
    isUserUploaded: true,
    isHidden: false,
    mimeType: mimeType || "image/jpeg",
    fileName,
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const err: any = new Error(`Upload image API error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }

  const result = await resp.json();

  // Response là array, lấy media.name từ phần tử đầu tiên
  const mediaName = Array.isArray(result) ? result[0]?.media?.name : result?.media?.name;

  if (!mediaName) {
    const err: any = new Error("Không lấy được media name từ uploadImage response");
    err.statusCode = 500;
    throw err;
  }

  logger.info(`[uploadImage] Upload thành công, media name: ${mediaName}`);
  return mediaName;
}

export type CliproxyAction = "VIDEO_GENERATION" | "IMAGE_GENERATION";

export interface CliproxyCaptchaData {
  Time: string;
  Gmail: string;
  ProjectID: string;
  sessionId: string;
  captcha: string;
  accessToken: string;
  Cookie: string;
}

/**
 * Lấy captcha từ Cliproxy API + credentials từ Google Labs.
 * Hỗ trợ 2 loại action: VIDEO_GENERATION và IMAGE_GENERATION.
 * Throw error nếu không lấy được captcha hoặc accessToken.
 */
export async function getReCaptchaCredentials(
  action: CliproxyAction
): Promise<CliproxyCaptchaData & { projectId: string; accessToken: string }> {
  const url = `https://capcha.aitipmart.site/captcha${
    action === "VIDEO_GENERATION" ? "" : "?action=IMAGE_GENERATION"
  }`;
  const { googleLabsApiKey } = await getCustomerGoogleLabsCredentials();
  const captchaResp = await fetch(url, {
    headers: {
      "X-API-Key": googleLabsApiKey,
    },
  });

  const captchaData = (await captchaResp.json()) as CliproxyCaptchaData;

  if (!captchaData?.captcha || !captchaData?.accessToken) {
    const err: any = new Error("Không lấy được captcha/credentials từ Cliproxy API");
    err.statusCode = 500;
    throw err;
  }

  return {
    ...captchaData,
    sessionId: captchaData.sessionId,
    projectId: captchaData.ProjectID,
    accessToken: captchaData.accessToken,
  };
}
