import { GoogleGenAI } from "@google/genai";
import logger from "../../../helpers/logger";
import redis from "../../../helpers/redis";
import { ForbiddenError } from "../../../libs/core";
import { ArtStyleModel } from "../../../libs/dal/art-style/art-style.model";
import { credentialService } from "../../../libs/dal/credential";
import { CustomerModel } from "../../../libs/dal/customer";
import { ObjectToPersonifyModel } from "../../../libs/dal/objectToPersonify/objectToPersonify.model";
import { AiProviderKeyEnum } from "../../../libs/dal/product";
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from "../../../packages/encryption/encrypt-provider";
import { CaptchaResponseData } from "../../helpers/validateApiKey";

const AI_MAX_RETRIES = 5;
const REDIS_KEY_GEMINI_DAILY_QUOTA_EXHAUSTED = "gemini:daily_quota_exhausted";

export interface GeminiClientEntry {
  client: InstanceType<typeof GoogleGenAI>;
  apiKey: string;
}

/** Generate a simple UUID v4 string */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
export enum TrendingModeTypeEnum {
  single_variant = "single_variant",
  story_script = "story_script",
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

// ──────────────── Redis daily quota helpers ────────────────

/**
 * Tính số giây còn lại cho đến 00:00 Pacific Time (PST/PDT).
 */
function getSecondsUntilMidnightPacific(): number {
  const now = new Date();
  const pacificStr = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const pacificNow = new Date(pacificStr);
  const h = pacificNow.getHours();
  const m = pacificNow.getMinutes();
  const s = pacificNow.getSeconds();
  const secondsSinceMidnight = h * 3600 + m * 60 + s;
  const secondsInDay = 24 * 3600;
  return secondsSinceMidnight === 0 ? secondsInDay : secondsInDay - secondsSinceMidnight;
}

/**
 * Kiểm tra xem error có phải lỗi 403 CONSUMER_SUSPENDED (key bị Google suspend vĩnh viễn).
 */
function isConsumerSuspendedError(err: any): boolean {
  const numericCode = err?.code || err?.statusCode || err?.httpCode;
  const msg = (err?.message || "").toString();
  return (
    (numericCode === 403 || Number(err?.status) === 403 || msg.includes("403")) &&
    (msg.includes("CONSUMER_SUSPENDED") || msg.includes("has been suspended"))
  );
}

/**
 * Xóa API key bị CONSUMER_SUSPENDED khỏi danh sách credential trong DB.
 * Đọc credential hiện tại, giải mã, loại bỏ key bị suspended, mã hóa lại và lưu vào DB.
 */
async function removeSuspendedKeyFromDB(suspendedApiKey: string): Promise<void> {
  try {
    const credentialDoc = (await credentialService.findOne({
      key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
      isAdminCredential: true,
    })) as any;
    const credential = credentialDoc?._doc;
    if (!credential?.value) return;

    const decryptedValue = decryptProviderSecret(credential.value);
    if (!decryptedValue) return;

    // Tách danh sách key, loại bỏ key bị suspended
    const allKeys = decryptedValue
      .split(/[,\n]+/)
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0);

    const remainingKeys = allKeys.filter((k: string) => k !== suspendedApiKey);

    if (remainingKeys.length === allKeys.length) {
      // Key không tìm thấy trong danh sách (có thể đã bị xóa trước đó)
      return;
    }

    if (remainingKeys.length === 0) {
      logger.error(
        `[removeSuspendedKeyFromDB] Không thể xóa key ***${suspendedApiKey.slice(
          -6
        )} vì đây là key cuối cùng.`
      );
      return;
    }

    // Mã hóa lại danh sách key mới (không có key bị suspended) và cập nhật DB
    const newValue = remainingKeys.join(",");
    const encryptedNewValue = encryptProviderSecret(newValue);

    await credentialService.model.updateOne(
      { _id: credential._id },
      { $set: { value: encryptedNewValue } }
    );

    logger.warn(
      `[removeSuspendedKeyFromDB] Đã xóa API key ***${suspendedApiKey.slice(
        -6
      )} khỏi DB (CONSUMER_SUSPENDED). Còn lại ${remainingKeys.length}/${allKeys.length} keys.`
    );
  } catch (dbErr: any) {
    logger.error(`[removeSuspendedKeyFromDB] Lỗi khi cập nhật DB: ${dbErr?.message}`);
  }
}

/**
 * Kiểm tra xem error có phải lỗi daily quota free-tier (limit: 20) hay không.
 */
function isDailyQuotaExhaustedError(err: any): boolean {
  const msg = (err?.message || "").toString();
  return (
    msg.includes("limit: 20") ||
    msg.includes('"quotaValue":"20"') ||
    msg.includes('\\"quotaValue\\":\\"20\\"')
  );
}

/**
 * Thêm API key vào danh sách blacklist trên Redis (hết daily quota).
 * Key sẽ tự động hết hạn vào 00:00 Pacific Time.
 */
async function blacklistGeminiKeyForDay(apiKey: string): Promise<void> {
  try {
    const ttl = getSecondsUntilMidnightPacific();
    await redis.sadd(REDIS_KEY_GEMINI_DAILY_QUOTA_EXHAUSTED, apiKey);
    await redis.expire(REDIS_KEY_GEMINI_DAILY_QUOTA_EXHAUSTED, ttl);
    logger.info(
      `[blacklistGeminiKey] API key ***${apiKey.slice(
        -6
      )} đã bị blacklist ${ttl}s (đến 00:00 Pacific).`
    );
  } catch (redisErr: any) {
    logger.error(`[blacklistGeminiKey] Lỗi Redis: ${redisErr?.message}`);
  }
}

/**
 * Lấy danh sách API keys đang bị blacklist (hết daily quota) từ Redis.
 */
export async function getBlacklistedGeminiKeys(): Promise<Set<string>> {
  try {
    const members = await redis.smembers(REDIS_KEY_GEMINI_DAILY_QUOTA_EXHAUSTED);
    return new Set(members);
  } catch (redisErr: any) {
    logger.error(`[getBlacklistedGeminiKeys] Lỗi Redis: ${redisErr?.message}`);
    return new Set();
  }
}

/**
 * Lấy danh sách Gemini clients còn available (loại bỏ key đã bị blacklist daily quota).
 * Throw error nếu không còn key nào khả dụng.
 */
export async function getAvailableGeminiClients(): Promise<GeminiClientEntry[]> {
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

  // Lấy danh sách key bị blacklist từ Redis (daily quota)
  const blacklistedKeys = await getBlacklistedGeminiKeys();
  const availableKeys = apiKeys.filter((k) => !blacklistedKeys.has(k));

  if (availableKeys.length === 0) {
    const err: any = new Error(
      `Tất cả ${apiKeys.length} API keys đều đã hết daily quota (free tier). Vui lòng đợi đến 00:00 Pacific Time.`
    );
    err.statusCode = 429;
    throw err;
  }

  logger.info(
    `[getAvailableGeminiClients] ${availableKeys.length}/${apiKeys.length} keys khả dụng (${blacklistedKeys.size} hết quota).`
  );

  // Xáo trộn ngẫu nhiên
  for (let i = availableKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableKeys[i], availableKeys[j]] = [availableKeys[j], availableKeys[i]];
  }

  return availableKeys.map((k) => ({ client: createGeminiClient(k), apiKey: k }));
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
 * - Nếu 503 → chờ 6-10s rồi nhảy sang API key tiếp theo.
 * - Các lỗi khác → throw ngay.
 * - Tối đa thử 5 key. Nếu quá 5 key → throw error ngay.
 */
const MAX_KEY_RETRIES = 5;

export async function callWithKeyRotation<T>(
  entries: GeminiClientEntry[],
  fn: (client: InstanceType<typeof GoogleGenAI>) => Promise<T>,
  label: string
): Promise<T> {
  let lastError: any;
  const exhaustedKeys = new Set<string>();
  let keyIdx = 0;
  let attempts = 0;

  while (exhaustedKeys.size < entries.length) {
    const { client, apiKey } = entries[keyIdx];
    const keyLabel = `key ${keyIdx + 1}/${entries.length}`;

    // Bỏ qua nếu key này đã bị giới hạn daily quota
    if (exhaustedKeys.has(apiKey)) {
      keyIdx = (keyIdx + 1) % entries.length;
      continue;
    }

    // Giới hạn tối đa 5 key thử
    if (attempts >= MAX_KEY_RETRIES) {
      logger.error(`[${label}] Đã thử ${MAX_KEY_RETRIES} key nhưng đều thất bại. Dừng retry.`);
      throw new ForbiddenError(`Google AI hiện đang quá tải. Vui lòng thử lại sau 2-3 phút.`);
    }

    attempts++;

    try {
      const result = await fn(client);
      return result;
    } catch (err: any) {
      lastError = err;

      if (isRateLimitOrQuotaError(err)) {
        logger.warn(
          `[${label}] ${keyLabel} bị 429/quota (attempt ${attempts}/${MAX_KEY_RETRIES}): ${err?.message}. Chuyển sang key tiếp theo.`
        );
        // Nếu là daily quota exhausted (free tier limit: 20) → blacklist key trên Redis
        if (isDailyQuotaExhaustedError(err)) {
          await blacklistGeminiKeyForDay(apiKey);
          exhaustedKeys.add(apiKey);
        }
        keyIdx = (keyIdx + 1) % entries.length;
        continue;
      }

      if (isConsumerSuspendedError(err)) {
        logger.warn(
          `[${label}] ${keyLabel} bị CONSUMER_SUSPENDED (attempt ${attempts}/${MAX_KEY_RETRIES}): ${err?.message}. Xóa khỏi DB và chuyển sang key tiếp theo.`
        );
        await removeSuspendedKeyFromDB(apiKey);
        exhaustedKeys.add(apiKey);
        keyIdx = (keyIdx + 1) % entries.length;
        continue;
      }

      if (isServiceUnavailableError(err)) {
        logger.warn(
          `[${label}] ${keyLabel} bị 503 (attempt ${attempts}/${MAX_KEY_RETRIES}): ${err?.message}. Chờ 6-10s rồi chuyển sang key tiếp theo.`
        );
        const delayMs = Math.floor(Math.random() * (10000 - 6000 + 1)) + 6000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        keyIdx = (keyIdx + 1) % entries.length;
        continue;
      }

      // Lỗi khác (400, 401, 403, 500...) → throw ngay
      logger.error(`[${label}] ${keyLabel} lỗi không thể retry: ${err?.message}`);
      throw err;
    }
  }

  // Tất cả key đều thất bại
  logger.error(`[${label}] Tất cả ${entries.length} API key đều thất bại (hết quota daily).`);
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

/**
 * Kiểm tra giới hạn generation text của customer. Throw error 403 nếu vượt quá.
 */
export async function checkRequestLimit(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.requestCount googlePackage.requestLimit")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const currentCount = customer.googlePackage?.requestCount || 0;
  const limit = customer.googlePackage?.requestLimit || 0;
  if (currentCount + 1 > limit) {
    const err: any = new Error(
      `Bạn đã vượt quá giới hạn generation text (${currentCount}/${limit}). Vui lòng nâng cấp gói để tiếp tục.`
    );
    err.statusCode = 403;
    throw err;
  }
}

/** Tăng requestCount lên 1 sau khi generation text thành công */
export async function incrementRequestCount(customerId: string): Promise<void> {
  await CustomerModel.findByIdAndUpdate(customerId, { $inc: { "googlePackage.requestCount": 1 } });
}

/**
 * Resolve objectToPersonify prompt from DB.
 * - Nếu FE chưa gửi objectToPersonify → dùng objectDoc.prompt
 * - Nếu FE gửi objectToPersonify khác objectDoc.name → dùng objectDoc.name
 * - Nếu FE gửi objectToPersonify trùng objectDoc.name → dùng objectDoc.prompt (hiện tại)
 */
export async function resolveObjectToPersonifyPrompt(opts: {
  objectToPersonifyCode?: string;
  objectToPersonify?: string;
}): Promise<{ prompt?: string; error?: { status: number; message: string } }> {
  if (!opts.objectToPersonifyCode) {
    return { prompt: opts.objectToPersonify };
  }

  const objectDoc = await ObjectToPersonifyModel.findOne({
    code: opts.objectToPersonifyCode,
  }).lean();

  if (!objectDoc) {
    return { prompt: opts.objectToPersonify };
  }

  // Nếu FE gửi objectToPersonify và khác objectDoc.name → dùng objectDoc.name
  if (opts.objectToPersonify && opts.objectToPersonify !== objectDoc.name) {
    return { prompt: opts.objectToPersonify };
  }

  // FE chưa gửi hoặc trùng objectDoc.name → dùng objectDoc.prompt (current behavior)
  return { prompt: objectDoc.prompt || opts.objectToPersonify };
}

/**
 * Resolve artStyle prompt from DB.
 * - Nếu FE gửi artStyleId (art style ID) → lookup prompt từ DB
 * - Nếu không tìm thấy → giữ nguyên artStyle name từ FE
 */
export async function resolveArtStylePrompt(opts: {
  artStyleId?: string;
  artStyle?: string;
}): Promise<{ prompt?: string; name?: string }> {
  if (!opts.artStyleId) {
    return { prompt: opts.artStyle };
  }

  try {
    const artStyleDoc = await ArtStyleModel.findById(opts.artStyleId).lean();
    if (!artStyleDoc) {
      return { prompt: opts.artStyle };
    }

    // Nếu có prompt trong DB → dùng prompt đó, ngược lại giữ artStyle name
    return { prompt: artStyleDoc.prompt || opts.artStyle, name: artStyleDoc.name };
  } catch {
    return { prompt: opts.artStyle };
  }
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
  artStyleId?: string;
}

export interface TrendingVideoFormConfig {
  tipContent: string;
  batchSize: number;
  productImages?: string[];
  trendingModeType: TrendingModeTypeEnum;
  category?: string;
  mood: string;
  language: string;
  artStyle: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  promptId: string;
  artStyleId?: string;
}
/** Quy tắc thứ tự ảnh tham chiếu — chỉ ghi một lần khi có cả nhân hoá và sản phẩm. */
const IMAGE_REFERENCE_ORDER_RULE =
  "Ảnh tham chiếu đầu tiên luôn là nhân vật/nhân hoá; từ ảnh tham chiếu thứ hai trở đi là ảnh sản phẩm.";

const PRODUCT_IMAGE_REFERENCE_RULES =
  "đưa TẤT CẢ sản phẩm vào CÙNG MỘT hình ảnh duy nhất. Mỗi sản phẩm phải giữ nguyên chính xác diện mạo, hình dáng, màu sắc, thương hiệu và bao bì như trong hình ảnh tham chiếu. Hãy sắp xếp tất cả sản phẩm một cách tự nhiên trong một bố cục thống nhất. Mỗi sản phẩm phải hiển thị rõ ràng và dễ nhận biết trong hình ảnh cuối cùng. Một số hình ảnh sản phẩm ngẫu nhiên phải được nhân vật cầm trên tay";

const OBJECT_PERSONIFY_IMAGE_REFERENCE_RULES =
  "giữ nguyên chính xác diện mạo, hình dáng, màu sắc, chất liệu và đặc điểm nhận dạng, gương mặt tỉ lệ mắt mũi miệng, kích thước của nhân vật như trong ảnh đầu tiên tham chiếu khi tạo hình ảnh không biến đổi thành nhân vật nhân hoá, không được tự ý vẽ thêm hoặc bớt gì";

export const DEFAULT_PRODUCT_IMAGE_REFERENCE_NOTE = `\nQUAN TRỌNG: Prompt này dành cho ảnh thứ 2 trở đi. Bạn PHẢI ${PRODUCT_IMAGE_REFERENCE_RULES}. ${IMAGE_REFERENCE_ORDER_RULE}`;

export const DEFAULT_OBJECT_PERSONIFY_IMAGE_REFERENCE_NOTE = `\nQUAN TRỌNG: Prompt này dành cho ảnh đầu tiên. Bạn PHẢI ${OBJECT_PERSONIFY_IMAGE_REFERENCE_RULES}. ${IMAGE_REFERENCE_ORDER_RULE}`;

function buildCombinedImageReferenceNote(productCustomPrompt?: string): string {
  const productSection = productCustomPrompt
    ? productCustomPrompt
    : `Bạn PHẢI ${PRODUCT_IMAGE_REFERENCE_RULES}.`;
  return (
    `\nQUAN TRỌNG — ẢNH THAM CHIẾU:\n` +
    `${IMAGE_REFERENCE_ORDER_RULE}\n\n` +
    `• Ảnh 1 (nhân vật/nhân hoá): Bạn PHẢI ${OBJECT_PERSONIFY_IMAGE_REFERENCE_RULES}.\n\n` +
    `• Ảnh 2 trở đi (sản phẩm): ${productSection}`
  );
}

/** Gộp note nhân hoá + sản phẩm; tránh lặp quy tắc thứ tự ảnh khi cả hai đều có. */
export function buildImageReferenceNotes(opts: {
  productUrls?: string[];
  productCustomPrompt?: string;
  personifyImages?: ReferenceImageInput[];
}): string {
  const productUrls = opts.productUrls?.filter(Boolean) || [];
  const hasProduct = productUrls.length > 0;
  const hasPersonify = filterReferenceImages(opts.personifyImages).length > 0;

  if (!hasProduct && !hasPersonify) return "";
  if (hasProduct && hasPersonify) {
    return buildCombinedImageReferenceNote(opts.productCustomPrompt);
  }
  if (hasPersonify) return buildObjectPersonifyImageReferenceNote(opts.personifyImages);
  return buildProductImageReferenceNote(productUrls, opts.productCustomPrompt);
}

export function buildProductImageReferenceNote(urls: string[], customPrompt?: string): string {
  const filtered = urls?.filter(Boolean) || [];
  if (filtered.length === 0) return "";
  if (customPrompt) return `\n${customPrompt}`;
  return DEFAULT_PRODUCT_IMAGE_REFERENCE_NOTE;
}

export type ReferenceImageInput =
  | string
  | {
      imageBytes?: string;
      mimeType?: string;
      fifeUrl?: string;
      name?: string;
    };

export type UploadableReferenceImage = string | { imageBytes: string; mimeType?: string };

function normalizeReferenceImageItem(item: ReferenceImageInput): UploadableReferenceImage | null {
  if (!item) return null;

  if (typeof item === "string") {
    const s = item.trim();
    if (!s) return null;
    const dataMatch = s.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) return { imageBytes: dataMatch[2], mimeType: dataMatch[1] };
    return s;
  }

  let bytes = item.imageBytes?.trim();
  if (!bytes && item.fifeUrl?.trim()) {
    const url = item.fifeUrl.trim();
    const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) return { imageBytes: dataMatch[2], mimeType: dataMatch[1] };
    return url;
  }
  if (!bytes) return null;

  const dataMatch = bytes.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    return { imageBytes: dataMatch[2], mimeType: dataMatch[1] };
  }
  return { imageBytes: bytes, mimeType: item.mimeType || "image/png" };
}

export function filterReferenceImages(images?: ReferenceImageInput[]): UploadableReferenceImage[] {
  const out: UploadableReferenceImage[] = [];
  for (const item of images || []) {
    const normalized = normalizeReferenceImageItem(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function buildObjectPersonifyImageReferenceNote(images?: ReferenceImageInput[]): string {
  if (filterReferenceImages(images).length === 0) return "";
  return DEFAULT_OBJECT_PERSONIFY_IMAGE_REFERENCE_NOTE;
}

export function buildProductImageScriptNote(urls: string[]): string {
  const filtered = urls?.filter(Boolean) || [];
  if (filtered.length === 0) return "";
  return `\n\n*** ẢNH SẢN PHẨM THAM CHIẾU ***\nCác ảnh sản phẩm dưới đây là tham chiếu cho sản phẩm chính trong video. Hãy sử dụng chúng để mô tả chính xác hơn các props / sản phẩm trong visual_prompt.\nURLs: ${filtered.join(
    ", "
  )}`;
}

export function buildObjectPersonifyImageScriptNote(images?: ReferenceImageInput[]): string {
  const filtered = filterReferenceImages(images);
  if (filtered.length === 0) return "";
  const urls = filtered.filter((i): i is string => typeof i === "string");
  const urlPart = urls.length ? `\nURLs: ${urls.join(", ")}` : "";
  return `\n\n*** ẢNH THAM CHIẾU NHÂN HOÁ ĐỒ VẬT ***\nCó ảnh tham chiếu nhân hoá đồ vật (base64 hoặc URL). Hãy dùng để mô tả chính xác hơn nhân vật nhân hoá trong visual_prompt.${urlPart}`;
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
export function interpolateTrendingTemplate(text: string, config: TrendingVideoFormConfig): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = (config as any)[key];
    return value !== undefined && value !== null ? `"${String(value)}"` : "";
  });
}

export enum ActionEnum {
  VIDEO_GENERATION = "VIDEO_GENERATION",
  IMAGE_GENERATION = "IMAGE_GENERATION",
}

/**
 * Lấy captcha từ Cliproxy API + credentials từ Google Labs.
 * Hỗ trợ 2 loại action: VIDEO_GENERATION và IMAGE_GENERATION.
 * Throw error nếu không lấy được captcha hoặc accessToken.
 */
export async function getReCaptchaCredentials(
  action: ActionEnum
): Promise<CaptchaResponseData & { projectId: string; accessToken: string }> {
  const url = `https://capcha.aitipmart.site/captcha${
    action === ActionEnum.VIDEO_GENERATION ? "" : "?action=IMAGE_GENERATION"
  }`;
  const { googleLabsApiKey } = await getCustomerGoogleLabsCredentials();
  const captchaResp = await fetch(url, {
    headers: {
      "X-API-Key": googleLabsApiKey,
    },
  });

  const captchaData = (await captchaResp.json()) as CaptchaResponseData;

  if (!captchaData?.captcha || !captchaData?.accessToken) {
    const err: any = new Error("Không lấy được captcha/credentials từ server");
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
