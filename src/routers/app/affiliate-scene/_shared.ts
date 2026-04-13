import { GoogleGenAI } from "@google/genai";
import logger from "../../../helpers/logger";
import { credentialService } from "../../../libs/dal/credential";
import { CustomerModel } from "../../../libs/dal/customer";
import { AiProviderKeyEnum } from "../../../libs/dal/product";
import { decryptProviderSecret } from "../../../packages/encryption/encrypt-provider";

const AI_MAX_RETRIES = 5;

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

      // Không retry nếu lỗi 403 (permission/reCAPTCHA) hoặc 401 (auth) vì retry cũng không giải quyết được
      const errStatus = err?.statusCode || err?.status;
      if (errStatus === 403 || errStatus === 401) {
        logger.warn(`[${label}] Lỗi xác thực (${errStatus}), không retry thêm.`);
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
 * Helper chung: Lấy credential Gemini của customer, giải mã và tạo GoogleGenAI client.
 * Throw error nếu chưa cấu hình key.
 */
export async function getCustomerGeminiClient(
  customerId: string
): Promise<InstanceType<typeof GoogleGenAI>> {
  const credentialDoc = (await credentialService.findOne({
    customerId,
    key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
    isCustomerCredential: true,
  })) as any;
  const credential = credentialDoc?._doc;
  if (!credential?.value) {
    const err: any = new Error("Chưa cấu hình Google Gemini API Key");
    err.statusCode = 403;
    throw err;
  }
  const apiKey = decryptProviderSecret(credential.value);
  return createGeminiClient(apiKey);
}

/**
 * Helper: Lấy Google Labs Access Token và Project ID của customer.
 * Throw error nếu chưa cấu hình.
 */
export async function getCustomerGoogleLabsCredentials(
  customerId: string
): Promise<{ accessToken: string; projectId: string }> {
  const [tokenDoc, projectDoc] = await Promise.all([
    credentialService.findOne({
      customerId,
      key: AiProviderKeyEnum.GOOGLE_LABS_TOKEN,
      isCustomerCredential: true,
    }),
    credentialService.findOne({
      customerId,
      key: AiProviderKeyEnum.GOOGLE_LABS_PROJECT_ID,
      isCustomerCredential: true,
    }),
  ]);
  const tokenCred = (tokenDoc as any)?._doc;
  const projectCred = (projectDoc as any)?._doc;
  if (!tokenCred?.value) {
    const err: any = new Error("Chưa cấu hình Google Labs Access Token");
    err.statusCode = 403;
    throw err;
  }
  if (!projectCred?.value) {
    const err: any = new Error("Chưa cấu hình Google Labs Project ID");
    err.statusCode = 403;
    throw err;
  }
  return {
    accessToken: decryptProviderSecret(tokenCred.value),
    projectId: decryptProviderSecret(projectCred.value),
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
  customerId: string
): Promise<string> {
  const { accessToken, projectId } = await getCustomerGoogleLabsCredentials(customerId);
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
export async function getCliproxyCredentials(
  action: CliproxyAction,
  customerId: string
): Promise<CliproxyCaptchaData & { projectId: string; accessToken: string }> {
  const url =
    action === "VIDEO_GENERATION"
      ? "http://cliproxy.io.vn/captcha"
      : `http://cliproxy.io.vn/captcha?action=${action}`;

  const [captchaResp, googleLabsCreds] = await Promise.all([
    fetch(url),
    getCustomerGoogleLabsCredentials(customerId),
  ]);

  const captchaData = (await captchaResp.json()) as CliproxyCaptchaData;

  if (!captchaData?.captcha || !captchaData?.accessToken) {
    const err: any = new Error("Không lấy được captcha/credentials từ Cliproxy API");
    err.statusCode = 500;
    throw err;
  }

  return {
    ...captchaData,
    sessionId: captchaData.sessionId,
    projectId: googleLabsCreds.projectId,
    accessToken: googleLabsCreds.accessToken,
  };
}
