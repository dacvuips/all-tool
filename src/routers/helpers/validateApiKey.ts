import { Request } from "express";
import logger from "../../helpers/logger";
import { settingService } from "../../libs/dal/setting";
import {
  acquireCaptchaLinkWithSlot,
  banCaptchaLink,
  releaseCaptchaLinkSlot,
  TIME,
} from "./captcha-link-slot";
import { captchaSerialQueue } from "./captcha-serial-queue";
import { buildThrottleError, captchaThrottleGate, retryWithThrottleGate } from "./retry-throttle";

export { TIME };

/** Cấu hình link API */
export interface ApiLinkData {
  url: string;
  apiKey: string;
  /**
   * Số request đồng thời tối đa cho link này.
   * Mặc định 1 nếu không khai báo.
   */
  slotNumber?: number;
}

export interface ApiLinkSetting {
  link: ApiLinkData[];
}

/** Các trường tối thiểu cần thiết để validate token */
export interface IApiToken {
  _id: any;
  key?: string;
  active?: boolean;
  expiredDate?: Date;
  requestQuantity?: number;
  usedQuantity?: number;
  streamCount?: number;
}

/** Service tối thiểu cần có findOne và updateOne */
export interface IApiTokenService<T extends IApiToken> {
  findOne(filter: Record<string, any>): Promise<T | null>;
  updateOne(id: any, data: Record<string, any>): Promise<any>;
  model: any;
}

/**
 * Validate x-api-key từ request header và kiểm tra token hợp lệ.
 * Throw error với statusCode tương ứng nếu không hợp lệ.
 * Trả về token nếu hợp lệ.
 */
export async function validateApiKey<T extends IApiToken>(
  req: Request,
  tokenService: IApiTokenService<T>
): Promise<T> {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  // Validate apiKey
  if (!apiKey) {
    const err: any = new Error("Thiếu x-api-key");
    err.statusCode = 400;
    throw err;
  }

  // Kiểm tra token hợp lệ
  const token = await tokenService.findOne({ key: apiKey, active: true });
  if (!token) {
    const err: any = new Error("API Key không hợp lệ");
    err.statusCode = 401;
    throw err;
  }
  if (!token.active) {
    const err: any = new Error("API Key đã bị vô hiệu hóa");
    err.statusCode = 403;
    throw err;
  }
  if (token.expiredDate && new Date(token.expiredDate) < new Date()) {
    const err: any = new Error("API Key đã hết hạn");
    err.statusCode = 403;
    throw err;
  }
  if (
    token.requestQuantity != null &&
    token.requestQuantity >= 0 &&
    token.usedQuantity != null &&
    token.usedQuantity >= token.requestQuantity
  ) {
    const err: any = new Error("Đã hết lượt sử dụng. Vui lòng nâng cấp gói.");
    err.statusCode = 429;
    throw err;
  }

  return token;
}

/**
 * Lấy cấu hình API từ setting theo key.
 * Parse JSON nếu cần và validate link array.
 * Throw error nếu cấu hình không hợp lệ.
 */
export async function getApiSetting(settingKey: string): Promise<ApiLinkData[]> {
  const setting = await settingService.findOne({ key: settingKey });
  let settingValue: ApiLinkSetting | undefined;
  try {
    settingValue =
      typeof setting?.value === "string"
        ? JSON.parse(setting.value)
        : (setting?.value as ApiLinkSetting | undefined);
  } catch {
    const err: any = new Error("Cấu hình API không hợp lệ (JSON parse error)");
    err.statusCode = 500;
    throw err;
  }

  if (!settingValue?.link || settingValue.link.length === 0) {
    const err: any = new Error("Chưa cấu hình API");
    err.statusCode = 500;
    throw err;
  }

  // Shuffle danh sách link ngẫu nhiên
  const links = [...settingValue.link];
  for (let i = links.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [links[i], links[j]] = [links[j], links[i]];
  }

  return links;
}

export interface CaptchaResponseData {
  Time: string;
  Gmail: string;
  ProjectID: string;
  sessionId: string;
  Seed: string;
  captcha: string;
  accessToken: string;
  Cookie: string;
  Headers: Record<string, string>;
}

/**
 * Lấy captcha data từ API bên ngoài.
 * Thử lần lượt các link, tăng usedQuantity, validate response.
 * Trả về captchaData object.
 */
/**
 * Kiểm tra response từ captcha API có phải lỗi "hàng đợi đầy" không.
 * Nếu đúng → throw ThrottleError để retryWithThrottleGate bắt và retry.
 */
function detectCaptchaQueueFull(status: number, errText: string): boolean {
  if (status !== 500 && status !== 503 && status !== 429) return false;
  // Captcha server trả body dạng: {"statusCode":500,"message":"Hàng đợi cho [...] đã đầy (N). Thử lại sau."}
  if (
    errText.includes("đã đầy") ||
    errText.includes("queue is full") ||
    errText.includes("too many")
  ) {
    return true;
  }
  return false;
}

/** Không có tài khoản Chrome Extension online → block link 30 phút. */
function detectCaptchaNoAccountOnline(status: number, errText: string): boolean {
  if (status !== 500) return false;
  return (
    errText.includes("Không có tài khoản nào đang online") ||
    errText.includes("Hãy mở Chrome Extension")
  );
}

/** Số lần retry tối đa khi Google trả lỗi reCAPTCHA (mỗi lần lấy captcha mới qua hàng đợi 10s). */
export const CAPTCHA_GENERATION_MAX_RETRIES = 10;

export function isCaptchaValidationError(err: any): boolean {
  return err?.isCaptchaError === true || err?.isRetryableCaptchaError === true;
}

/** Nhận diện lỗi reCAPTCHA / unusual activity trong text response (Google Aisandbox hoặc Flow2). */
export function isRecaptchaRelatedErrorText(text?: string): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  return (
    upper.includes("PUBLIC_ERROR_UNUSUAL_ACTIVITY") ||
    upper.includes("CAPTCHA_FAILED") ||
    upper.includes("RECAPTCHA EVALUATION FAILED") ||
    (upper.includes("RECAPTCHA") && upper.includes("FAILED"))
  );
}

/**
 * Phát hiện lỗi captcha từ HTTP response Aisandbox (403 hoặc body chứa reCAPTCHA/unusual activity).
 */
export function detectAisandboxCaptchaError(status: number, errText: string): boolean {
  if (isRecaptchaRelatedErrorText(errText)) return true;

  if (status === 403) {
    try {
      const errJson = JSON.parse(errText);
      if (isRecaptchaRelatedErrorText(errJson?.error?.message)) return true;
      if (
        errJson?.error?.details?.some(
          (d: { reason?: string }) =>
            d.reason === "PUBLIC_ERROR_UNUSUAL_ACTIVITY" || isRecaptchaRelatedErrorText(d.reason)
        )
      ) {
        return true;
      }
    } catch {
      // errText đã được kiểm tra ở trên
    }
  }

  return false;
}

/** Throw lỗi captcha chuẩn — `callAisandbox*API` retry khi có `captchaRetry`. */
export function throwAisandboxCaptchaError(): never {
  const err: any = new Error("Google xác minh Captcha thất bại. Vui lòng thử lại sau 2-3 phút.");
  err.isCaptchaError = true;
  err.statusCode = 403;
  throw err;
}

/** Cập nhật token/captcha mới; giữ nguyên uploadedImageNames / mediaId đã upload. */
export function applyFreshCaptchaCredentials<T extends Record<string, any>>(
  params: T,
  captcha: CaptchaResponseData
): T {
  return {
    ...params,
    recaptchaToken: captcha.captcha,
    sessionId: captcha.sessionId,
    projectId: captcha.ProjectID,
    accessToken: captcha.accessToken,
    headers: captcha.Headers,
    ...(captcha.Seed != null ? { Seed: captcha.Seed } : {}),
  };
}

/**
 * Chạy fn với captcha mới mỗi lần thử; khi Google báo lỗi reCAPTCHA → fetchCaptchaData lại (hàng đợi 10s).
 */
export async function runWithCaptchaRetry<T>(opts: {
  type?: string;
  logPrefix: string;
  customerId?: string;
  fn: (captcha: CaptchaResponseData) => Promise<T>;
}): Promise<T> {
  const { type, logPrefix, fn, customerId } = opts;
  let lastError: any;

  for (let attempt = 1; attempt <= CAPTCHA_GENERATION_MAX_RETRIES; attempt++) {
    const captcha = await fetchCaptchaData({ type, logPrefix, customerId });
    try {
      return await fn(captcha);
    } catch (err: any) {
      if (isCaptchaValidationError(err) && attempt < CAPTCHA_GENERATION_MAX_RETRIES) {
        lastError = err;
        logger.warn(
          `[${logPrefix}] Google Captcha thất bại, lấy captcha mới (${attempt}/${CAPTCHA_GENERATION_MAX_RETRIES})...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export async function fetchCaptchaData(opts: {
  type?: string;
  logPrefix: string;
  customerId?: string;
}): Promise<CaptchaResponseData> {
  const { type, logPrefix, customerId } = opts;

  // Ưu tiên generatedCustomAPI của customer (active + endpoint + APIKey)
  let links: ApiLinkData[] | null = null;
  if (customerId) {
    try {
      const { CustomerModel } = await import("../../libs/dal/customer/customer.model");
      const customer = await CustomerModel.findById(customerId)
        .select("generatedCustomAPI")
        .lean<{ generatedCustomAPI?: { active?: boolean; endpoint?: string; APIKey?: string } }>();
      const custom = customer?.generatedCustomAPI;
      if (custom?.active && custom?.endpoint?.trim() && custom?.APIKey?.trim()) {
        links = [
          {
            url: custom.endpoint.trim().replace(/\/+$/, ""),
            apiKey: custom.APIKey.trim(),
          },
        ];
        logger.info(
          `[${logPrefix}] Dùng generatedCustomAPI của customer ${customerId}`
        );
      }
    } catch (err: any) {
      logger.warn(
        `[${logPrefix}] Không đọc được generatedCustomAPI (${customerId}): ${err?.message} — fallback setting hệ thống`
      );
    }
  }

  // Lấy links hệ thống (shuffle ngẫu nhiên mỗi lần gọi)
  if (!links) {
    links = await getApiSetting("recaptcha-api-secret-key");
  }

  /**
   * Mọi request captcha xếp hàng FIFO, tối thiểu 10s giữa hai lần gọi API (Redis + local chain).
   * Mỗi link có slot riêng trên Redis (TIME ms): quay vòng link cho đến khi slot trống.
   * Link lỗi "không có tài khoản online" → ban 30 phút.
   * Hàng đợi đầy → ThrottleError + retryWithThrottleGate.
   */
  return captchaSerialQueue.run(
    () =>
      retryWithThrottleGate(
        async () => {
          let lastError: any = null;
          const validLinkCount = links!.filter((l) => l?.url).length;
          const maxLinkAttempts = Math.max(validLinkCount * 3, 3);
          let linkAttempts = 0;

          while (linkAttempts++ < maxLinkAttempts) {
            const selectedLink = await acquireCaptchaLinkWithSlot(links!, logPrefix);

            try {
              const captchaUrl = type ? `${selectedLink.url}?action=${type}` : selectedLink.url;
              const headers: Record<string, string> = {};
              if (selectedLink.apiKey) {
                headers["X-API-Key"] = selectedLink.apiKey;
              }

              const captchaResp = await fetch(captchaUrl, { headers });

              if (!captchaResp.ok) {
                const errText = await captchaResp.text();

                if (detectCaptchaQueueFull(captchaResp.status, errText)) {
                  await releaseCaptchaLinkSlot(selectedLink);
                  console.warn(
                    `[${logPrefix}] Link ${selectedLink?.url} bị throttle (hàng đợi đầy ${captchaResp.status}). Set gate, chờ retry...`
                  );
                  throw buildThrottleError(
                    `Captcha API error ${captchaResp.status}: ${errText.slice(0, 200)}`
                  );
                }

                if (detectCaptchaNoAccountOnline(captchaResp.status, errText)) {
                  await banCaptchaLink(selectedLink);
                  lastError = new Error(
                    `Captcha API error ${captchaResp.status}: ${errText.slice(0, 200)}`
                  );
                  console.warn(
                    `[${logPrefix}] Link ${selectedLink?.url} không có tài khoản online. Ban 30 phút, thử link khác...`
                  );
                  continue;
                }

                if (captchaResp.status === 403) {
                  await releaseCaptchaLinkSlot(selectedLink);
                  lastError = new Error(`Captcha API error 403: ${errText}`);
                  console.warn(
                    `[${logPrefix}] Link ${selectedLink?.url} bị 403. Chuyển sang link tiếp theo...`
                  );
                  continue;
                }

                await releaseCaptchaLinkSlot(selectedLink);
                throw new Error(`Captcha API error ${captchaResp.status}: ${errText}`);
              }

              return (await captchaResp.json()) as CaptchaResponseData;
            } catch (err: any) {
              if (err.isThrottleError) throw err;
              if (err.statusCode === 502 && err.message?.includes("quá tải")) throw err;

              await releaseCaptchaLinkSlot(selectedLink);
              lastError = err;
              console.warn(
                `[${logPrefix}] Link ${selectedLink?.url} thất bại: ${err.message}. Thử link tiếp theo...`
              );
              continue;
            }
          }

          const err: any = new Error(
            lastError?.message || "Hệ thống hiện tại đang quá tải. Vui lòng thử lại sau ít phút."
          );
          err.statusCode = 502;
          throw err;
        },
        { label: "captcha-fetch", gate: captchaThrottleGate }
      ),
    logPrefix
  );
}
