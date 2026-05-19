import logger from "../../helpers/logger";
import redis from "../../helpers/redis";

/**
 * Throttle Gate — cơ chế phối hợp đa instance qua Redis.
 *
 * Hành vi:
 *  - Bình thường: request bay tự do, không giới hạn.
 *  - Khi BẤT KỲ instance nào nhận lỗi 429 + PUBLIC_ERROR_USER_REQUESTS_THROTTLED:
 *    1. Set "gate" trên Redis = thời điểm tương lai mà mọi instance phải chờ (backoff).
 *    2. Tất cả request mới ở mọi instance kiểm tra gate trước khi gọi Google.
 *    3. Nếu gate active → chờ đến khi hết → rồi retry.
 *    4. Nếu retry tiếp tục 429 → extend gate (exponential backoff 2s→4s→8s→16s→30s→60s).
 *  - Khi request thành công → gate tự hết hạn (TTL), không ảnh hưởng request khác.
 *
 * Ưu điểm so với semaphore cố định:
 *  - Khi Google không throttle → 100% capacity, không bị giới hạn cứng.
 *  - Adaptive theo tín hiệu thực tế từ Google.
 *  - Cross-instance: tất cả instance back off đồng bộ.
 */

// ── Throttle detection helpers ──────────────────────────────────────────────

export interface ThrottleErrorShape {
  isThrottleError?: boolean;
  statusCode?: number;
  message?: string;
}

export function isThrottleError(err: any): boolean {
  if (!err) return false;
  if (err.isThrottleError === true) return true;
  const status = err.statusCode || err.status || err.code;
  const msg = (err.message || "").toString();
  if (
    (Number(status) === 429 || msg.includes(" 429")) &&
    msg.includes("PUBLIC_ERROR_USER_REQUESTS_THROTTLED")
  ) {
    return true;
  }
  return false;
}

/**
 * Parse response body để xác định 429 có phải throttle không.
 */
export async function classify429Error(
  resp: globalThis.Response
): Promise<{ isThrottle: boolean; errText: string }> {
  const errText = await resp.text();
  if (resp.status !== 429) {
    return { isThrottle: false, errText };
  }
  let isThrottle = false;
  try {
    const errJson = JSON.parse(errText);
    const details: any[] = errJson?.error?.details || [];
    isThrottle = details.some((d) => d?.reason === "PUBLIC_ERROR_USER_REQUESTS_THROTTLED");
    if (!isThrottle) {
      const statusStr = (errJson?.error?.status || "").toString();
      if (
        statusStr === "RESOURCE_EXHAUSTED" &&
        errText.includes("PUBLIC_ERROR_USER_REQUESTS_THROTTLED")
      ) {
        isThrottle = true;
      }
    }
  } catch {
    if (errText.includes("PUBLIC_ERROR_USER_REQUESTS_THROTTLED")) {
      isThrottle = true;
    }
  }
  return { isThrottle, errText };
}

/** Tạo Error object cho throttle. */
export function buildThrottleError(message: string): Error & ThrottleErrorShape {
  const err: any = new Error(message);
  err.isThrottleError = true;
  err.statusCode = 429;
  return err;
}

// ── Throttle Gate class ─────────────────────────────────────────────────────

// Backoff schedule: 2s, 4s, 8s, 16s, 30s, 60s (cap)
const BACKOFF_SCHEDULE_MS = [2000, 4000, 8000, 16000, 30000, 60000];
const DEFAULT_MAX_RETRIES = 5;

/**
 * ThrottleGate: shared gate trên Redis giữa các instance.
 *
 * Redis key lưu giá trị = epoch ms mà gate hết hạn.
 * TTL trên key tự xóa khi gate expired (phòng leftover).
 */
export class ThrottleGate {
  constructor(private readonly redisKey: string) {}

  /**
   * Đọc thời điểm gate hết hạn (epoch ms) từ Redis.
   * Trả 0 nếu gate không active.
   */
  async getGateExpiresAt(): Promise<number> {
    try {
      const val = await redis.get(this.redisKey);
      if (!val) return 0;
      const expiresAt = Number(val);
      if (isNaN(expiresAt)) return 0;
      return expiresAt > Date.now() ? expiresAt : 0;
    } catch (err: any) {
      logger.error(`[ThrottleGate][${this.redisKey}] getGateExpiresAt lỗi: ${err?.message}`);
      return 0; // Fail-open: nếu Redis hỏng, cho request đi tiếp
    }
  }

  /**
   * Set gate trên Redis. Chỉ extend (không thu hẹp) nếu gate hiện tại xa hơn.
   * @param delayMs Thời gian chờ tính từ bây giờ.
   */
  async setGate(delayMs: number): Promise<void> {
    try {
      const newExpiresAt = Date.now() + delayMs;
      // Lua: chỉ set nếu giá trị mới > giá trị cũ (extend gate, không thu hẹp)
      const lua = `
        local key = KEYS[1]
        local newVal = tonumber(ARGV[1])
        local ttlMs = tonumber(ARGV[2])
        local curVal = tonumber(redis.call('GET', key) or '0')
        if curVal == nil then curVal = 0 end
        if newVal > curVal then
          redis.call('SET', key, ARGV[1], 'PX', ttlMs)
        end
        return 1
      `;
      // TTL trên key = delayMs + 5s buffer
      const ttlMs = delayMs + 5000;
      await (redis as any).eval(lua, 1, this.redisKey, String(newExpiresAt), String(ttlMs));
    } catch (err: any) {
      logger.error(`[ThrottleGate][${this.redisKey}] setGate lỗi: ${err?.message}`);
    }
  }

  /**
   * Chờ đến khi gate hết hạn.
   * Trả về ngay nếu gate không active.
   */
  async waitForGate(label?: string): Promise<void> {
    const expiresAt = await this.getGateExpiresAt();
    if (expiresAt <= 0) return; // gate không active

    const waitTime = expiresAt - Date.now();
    if (waitTime <= 0) return;

    logger.info(
      `[ThrottleGate][${this.redisKey}] ${
        label || ""
      } Gate active, chờ ${waitTime}ms trước khi gọi API...`
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

// ── Pre-built gates cho image & video ───────────────────────────────────────

export const imageThrottleGate = new ThrottleGate("aisandbox:throttle_gate:image");
export const videoThrottleGate = new ThrottleGate("aisandbox:throttle_gate:video");

// ── Main retry helper ───────────────────────────────────────────────────────

export interface RetryWithGateOptions {
  maxRetries?: number;
  label?: string;
  gate: ThrottleGate;
}

/**
 * Gọi fn() với cơ chế Throttle Gate:
 *  1. Chờ gate nếu active (lần đầu và sau mỗi retry).
 *  2. Gọi fn(). Nếu thành → trả kết quả.
 *  3. Nếu lỗi throttle → set gate (backoff tăng dần) → loop retry.
 *  4. Nếu lỗi khác → throw ngay.
 *  5. Vượt maxRetries → throw error cuối cùng.
 */
export async function retryWithThrottleGate<T>(
  fn: () => Promise<T>,
  options: RetryWithGateOptions
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const label = options.label || "retry-throttle";
  const gate = options.gate;

  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Chờ gate trước khi gọi (nếu instance khác vừa bị throttle)
    await gate.waitForGate(label);

    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (!isThrottleError(err)) {
        throw err; // Lỗi khác → throw ngay
      }

      if (attempt >= maxRetries) {
        logger.error(
          `[${label}] Đã retry ${maxRetries} lần do throttle nhưng vẫn lỗi. Throw error.`
        );
        break;
      }

      // Tính backoff + jitter ±20%
      const baseDelay = BACKOFF_SCHEDULE_MS[Math.min(attempt, BACKOFF_SCHEDULE_MS.length - 1)];
      const jitter = baseDelay * (Math.random() * 0.4 - 0.2);
      const delay = Math.max(500, Math.floor(baseDelay + jitter));

      // Set gate trên Redis để thông báo toàn bộ instance cùng back off
      await gate.setGate(delay);

      logger.warn(
        `[${label}] Throttle 429 (attempt ${attempt + 1}/${
          maxRetries + 1
        }). Set gate ${delay}ms, chờ rồi retry...`
      );

      // Chờ backoff (gate.waitForGate ở đầu loop sẽ check lại, nhưng chờ luôn ở đây cho request hiện tại)
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
