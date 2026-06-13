import logger from "../../../helpers/logger";

export const AI_MAX_RETRIES = 5;

/**
 * Gọi lại AI API tối đa AI_MAX_RETRIES lần nếu có lỗi.
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

      const errStatus = err?.statusCode || err?.status;
      if (errStatus === 403 || errStatus === 401 || errStatus === 429) {
        logger.warn(`[${label}] Lỗi không thể retry (${errStatus}), dừng ngay.`);
        break;
      }

      if (attempt === AI_MAX_RETRIES) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

/** Nhận diện trang lỗi Cloudflare 524 (HTML hoặc status code). */
export function isCloudflare524Html(text: string): boolean {
  if (!text) return false;
  return (
    text.includes("524: A timeout occurred") ||
    text.includes("Error code 524") ||
    (text.includes("cf-error-details") && text.includes("524"))
  );
}

/** Kiểm tra timeout / Cloudflare 524 / gateway timeout — có thể retry. */
export function isTimeoutOr524Error(err: any): boolean {
  const numericCode = err?.code || err?.statusCode || err?.httpCode;
  if (numericCode === 524 || numericCode === 504 || numericCode === 408) return true;
  if (Number(err?.status) === 524 || Number(err?.status) === 504) return true;

  const msg = (err?.message || "").toString();
  if (
    msg.includes("524") ||
    msg.includes("504") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("A timeout occurred") ||
    msg.includes("timeout") ||
    isCloudflare524Html(msg)
  ) {
    return true;
  }

  return false;
}
