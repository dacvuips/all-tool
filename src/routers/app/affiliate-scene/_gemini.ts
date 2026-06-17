import { GoogleGenAI } from "@google/genai";
import logger from "../../../helpers/logger";
import redis from "../../../helpers/redis";
import { ForbiddenError } from "../../../libs/core";
import { credentialService } from "../../../libs/dal/credential";
import { AiProviderKeyEnum } from "../../../libs/dal/product";
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from "../../../packages/encryption/encrypt-provider";
import { isTimeoutOr524Error, retryAICall } from "./_ai-retry";
import {
  GEMINI_MAX_KEY_RETRIES,
  GEMINI_RETRY_DELAY_MS_MAX,
  GEMINI_RETRY_DELAY_MS_MIN,
  REDIS_KEY_GEMINI_DAILY_QUOTA_EXHAUSTED,
} from "./_gemini.constants";

export interface GeminiClientEntry {
  client: InstanceType<typeof GoogleGenAI>;
  apiKey: string;
}

function createGeminiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

function parseMultipleKeys(encryptedValue: string): string[] {
  const decrypted = decryptProviderSecret(encryptedValue);
  if (!decrypted) return [];
  return decrypted
    .split(/[,\n]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

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

function isConsumerSuspendedError(err: any): boolean {
  const numericCode = err?.code || err?.statusCode || err?.httpCode;
  const msg = (err?.message || "").toString();
  return (
    (numericCode === 403 || Number(err?.status) === 403 || msg.includes("403")) &&
    (msg.includes("CONSUMER_SUSPENDED") || msg.includes("has been suspended"))
  );
}

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

    const allKeys = decryptedValue
      .split(/[,\n]+/)
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0);

    const remainingKeys = allKeys.filter((k: string) => k !== suspendedApiKey);

    if (remainingKeys.length === allKeys.length) {
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

function isDailyQuotaExhaustedError(err: any): boolean {
  const msg = (err?.message || "").toString();
  return (
    msg.includes("limit: 20") ||
    msg.includes('"quotaValue":"20"') ||
    msg.includes('\\"quotaValue\\":\\"20\\"')
  );
}

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
  ) {
    return true;
  }

  return false;
}

function isServiceUnavailableError(err: any): boolean {
  const numericCode = err?.code || err?.statusCode || err?.httpCode;
  if (numericCode === 503) return true;
  if (Number(err?.status) === 503) return true;

  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("503") || msg.includes("service unavailable")) return true;

  return false;
}

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
  for (let i = apiKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [apiKeys[i], apiKeys[j]] = [apiKeys[j], apiKeys[i]];
  }
  return apiKeys.map((k) => createGeminiClient(k));
}

export async function getBlacklistedGeminiKeys(): Promise<Set<string>> {
  try {
    const members = await redis.smembers(REDIS_KEY_GEMINI_DAILY_QUOTA_EXHAUSTED);
    return new Set(members);
  } catch (redisErr: any) {
    logger.error(`[getBlacklistedGeminiKeys] Lỗi Redis: ${redisErr?.message}`);
    return new Set();
  }
}

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

  for (let i = availableKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableKeys[i], availableKeys[j]] = [availableKeys[j], availableKeys[i]];
  }

  return availableKeys.map((k) => ({ client: createGeminiClient(k), apiKey: k }));
}

export async function getGeminiClient(): Promise<InstanceType<typeof GoogleGenAI>> {
  const clients = await getAdminGeminiClients();
  return clients[0];
}

export async function getCustomerGeminiClient(
  _customerId: string
): Promise<InstanceType<typeof GoogleGenAI>> {
  return getGeminiClient();
}

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

    if (exhaustedKeys.has(apiKey)) {
      keyIdx = (keyIdx + 1) % entries.length;
      continue;
    }

    if (attempts >= GEMINI_MAX_KEY_RETRIES) {
      logger.error(
        `[${label}] Đã thử ${GEMINI_MAX_KEY_RETRIES} key nhưng đều thất bại. Dừng retry.`
      );
      throw new ForbiddenError(`Google AI hiện đang quá tải. Vui lòng thử lại sau 2-3 phút.`);
    }

    attempts++;

    try {
      return await fn(client);
    } catch (err: any) {
      lastError = err;

      if (isRateLimitOrQuotaError(err)) {
        logger.warn(
          `[${label}] ${keyLabel} bị 429/quota (attempt ${attempts}/${GEMINI_MAX_KEY_RETRIES}): ${err?.message}. Chuyển sang key tiếp theo.`
        );
        if (isDailyQuotaExhaustedError(err)) {
          await blacklistGeminiKeyForDay(apiKey);
          exhaustedKeys.add(apiKey);
        }
        keyIdx = (keyIdx + 1) % entries.length;
        continue;
      }

      if (isConsumerSuspendedError(err)) {
        logger.warn(
          `[${label}] ${keyLabel} bị CONSUMER_SUSPENDED (attempt ${attempts}/${GEMINI_MAX_KEY_RETRIES}): ${err?.message}. Xóa khỏi DB và chuyển sang key tiếp theo.`
        );
        await removeSuspendedKeyFromDB(apiKey);
        exhaustedKeys.add(apiKey);
        keyIdx = (keyIdx + 1) % entries.length;
        continue;
      }

      if (isServiceUnavailableError(err)) {
        logger.warn(
          `[${label}] ${keyLabel} bị 503 (attempt ${attempts}/${GEMINI_MAX_KEY_RETRIES}): ${err?.message}. Chờ 2-3s rồi chuyển sang key tiếp theo.`
        );
        const delayMs =
          Math.floor(Math.random() * (GEMINI_RETRY_DELAY_MS_MAX - GEMINI_RETRY_DELAY_MS_MIN + 1)) +
          GEMINI_RETRY_DELAY_MS_MIN;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        keyIdx = (keyIdx + 1) % entries.length;
        continue;
      }

      if (isTimeoutOr524Error(err)) {
        logger.warn(
          `[${label}] ${keyLabel} bị timeout/524 (attempt ${attempts}/${GEMINI_MAX_KEY_RETRIES}): ${err?.message}. Chờ 2-3s rồi retry.`
        );
        const delayMs =
          Math.floor(Math.random() * (GEMINI_RETRY_DELAY_MS_MAX - GEMINI_RETRY_DELAY_MS_MIN + 1)) +
          GEMINI_RETRY_DELAY_MS_MIN;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        keyIdx = (keyIdx + 1) % entries.length;
        continue;
      }

      logger.error(`[${label}] ${keyLabel} lỗi không thể retry: ${err?.message}`);
      throw err;
    }
  }

  logger.error(`[${label}] Tất cả ${entries.length} API key đều thất bại (hết quota daily).`);
  throw lastError;
}

export async function callGeminiWithRetry<T>(
  fn: (client: InstanceType<typeof GoogleGenAI>) => Promise<T>,
  label: string,
  clients?: GeminiClientEntry[]
): Promise<T> {
  const entries = clients ?? (await getAvailableGeminiClients());
  return retryAICall(() => callWithKeyRotation(entries, fn, label), label);
}

/** Gemini trả text rỗng → coi là thất bại, không tính quota. */
export function assertGeminiTextResponse(response: { text?: string | null }): string {
  const text = (response.text || "").trim();
  if (!text) {
    const err: any = new Error("AI không trả kết quả");
    err.statusCode = 502;
    throw err;
  }
  return text;
}

/** Parse danh sách Gemini API keys từ credential (dùng chung cho Google Labs creds). */
export function parseGeminiCredentialKeys(encryptedValue: string): string[] {
  return parseMultipleKeys(encryptedValue);
}

export type GeminiInlineMedia = { imageBytes: string; mimeType: string };

type GeminiContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

function buildGeminiContents(
  text: string,
  media?: GeminiInlineMedia[]
): string | Array<{ role: "user"; parts: GeminiContentPart[] }> {
  if (!media?.length) return text;
  return [
    {
      role: "user",
      parts: [
        ...media.map((item) => ({
          inlineData: {
            data: item.imageBytes,
            mimeType: item.mimeType,
          },
        })),
        { text },
      ],
    },
  ];
}

/** Gọi Gemini generateContent JSON — model/schema/media tùy từng route. */
export async function callGeminiJsonGenerate(params: {
  model: string;
  text: string;
  media?: GeminiInlineMedia[];
  label: string;
  responseSchema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  clients?: GeminiClientEntry[];
}): Promise<string> {
  const response = await callGeminiWithRetry(
    (ai) =>
      ai.models.generateContent({
        model: params.model,
        contents: buildGeminiContents(params.text, params.media),
        config: {
          ...(params.temperature != null ? { temperature: params.temperature } : {}),
          ...(params.maxOutputTokens != null ? { maxOutputTokens: params.maxOutputTokens } : {}),
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
        },
      }),
    params.label,
    params.clients
  );

  const finishReason = (response as { candidates?: Array<{ finishReason?: string }> })
    ?.candidates?.[0]?.finishReason;
  const text = assertGeminiTextResponse(response);

  if (finishReason === "MAX_TOKENS") {
    logger.warn(
      `[${params.label}] Gemini finishReason=MAX_TOKENS, outputLength=${text.length}`
    );
    const err: any = new Error(
      "AI trả kết quả bị cắt ngắn. Vui lòng thử lại hoặc dùng ảnh có ít panel hơn."
    );
    err.statusCode = 502;
    throw err;
  }

  return text;
}
