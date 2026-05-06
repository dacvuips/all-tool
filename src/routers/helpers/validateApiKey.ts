import { Request } from "express";
import { settingService } from "../../libs/dal/setting";

/** Cấu hình link API */
export interface ApiLinkData {
  url: string;
  apiKey: string;
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
export async function fetchCaptchaData<T extends IApiToken>(opts: {
  type?: string;
  logPrefix: string;
}): Promise<CaptchaResponseData> {
  const { type, logPrefix } = opts;
  // Lấy links & captcha data
  const links = await getApiSetting("recaptcha-api-secret-key");
  let captchaData: CaptchaResponseData = null;
  let lastError: any = null;

  for (const selectedLink of links) {
    if (!selectedLink || !selectedLink.url) {
      continue;
    }

    try {
      const captchaUrl = type ? `${selectedLink.url}?action=${type}` : selectedLink.url;
      const headers: Record<string, string> = {};
      if (selectedLink.apiKey) {
        headers["X-API-Key"] = selectedLink.apiKey;
      }

      const captchaResp = await fetch(captchaUrl, { headers });

      if (!captchaResp.ok) {
        const errText = await captchaResp.text();
        // On 403, skip to next API key
        if (captchaResp.status === 403) {
          lastError = new Error(`Captcha API error 403: ${errText}`);
          console.warn(
            `[${logPrefix}] Link ${selectedLink?.url} bị 403. Chuyển sang key tiếp theo...`
          );
          continue;
        }
        throw new Error(`Captcha API error ${captchaResp.status}: ${errText}`);
      }

      captchaData = await captchaResp.json();

      break;
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[${logPrefix}] Link ${selectedLink?.url} thất bại: ${err.message}. Thử link tiếp theo...`
      );
      continue;
    }
  }

  if (!captchaData) {
    const err: any = new Error(`Hệ thống hiện tại đang quá tải. Vui lòng thử lại sau ít phút.`);
    err.statusCode = 502;
    throw err;
  }

  return captchaData;
}
