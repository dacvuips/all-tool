import logger from "../../helpers/logger";
import redis from "../../helpers/redis";

/** Khoảng cách tối thiểu giữa hai lần gọi captcha API (toàn cluster). */
export const CAPTCHA_SERIAL_INTERVAL_MS = 10000;

const REDIS_KEY = "aisandbox:captcha_serial_next_slot";

/**
 * Hàng đợi tuần tự cho fetch captcha:
 * - FIFO trong cùng process (promise chain).
 * - Redis slot reservation giữa các instance (5s/lần, đúng thứ tự đến).
 */
export class CaptchaSerialQueue {
  private localTail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>, label?: string): Promise<T> {
    const job = this.localTail.then(() => this.executeWithGlobalSlot(fn, label));
    this.localTail = job.then(
      (): void => undefined,
      (): void => undefined
    );
    return job;
  }

  private async executeWithGlobalSlot<T>(fn: () => Promise<T>, label?: string): Promise<T> {
    await this.waitGlobalSlot(label);
    return fn();
  }

  private async waitGlobalSlot(label?: string): Promise<void> {
    const waitMs = await this.reserveWaitMs();
    if (waitMs > 0) {
      logger.info(
        `[CaptchaSerial]${
          label ? ` [${label}]` : ""
        } Chờ ${waitMs}ms (hàng đợi tuần tự, ${CAPTCHA_SERIAL_INTERVAL_MS}ms/lần)...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  /**
   * Atomically đặt slot trên Redis: request đến trước được slot sớm hơn.
   * Trả về số ms cần sleep trước khi gọi captcha API.
   */
  private async reserveWaitMs(): Promise<number> {
    try {
      const lua = `
        local key = KEYS[1]
        local interval = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])
        local ttlMs = tonumber(ARGV[3])
        local nextAvail = tonumber(redis.call('GET', key) or '0')
        if nextAvail < now then
          nextAvail = now
        end
        local mySlot = nextAvail
        redis.call('SET', key, tostring(nextAvail + interval), 'PX', ttlMs)
        return math.max(0, mySlot - now)
      `;
      const ttlMs = Math.max(CAPTCHA_SERIAL_INTERVAL_MS * 120, 60_000);
      const result = await (redis as any).eval(
        lua,
        1,
        REDIS_KEY,
        String(CAPTCHA_SERIAL_INTERVAL_MS),
        String(Date.now()),
        String(ttlMs)
      );
      const waitMs = Number(result);
      return isNaN(waitMs) || waitMs < 0 ? 0 : waitMs;
    } catch (err: any) {
      logger.error(`[CaptchaSerial] reserveWaitMs lỗi: ${err?.message}`);
      return 0;
    }
  }
}

export const captchaSerialQueue = new CaptchaSerialQueue();
