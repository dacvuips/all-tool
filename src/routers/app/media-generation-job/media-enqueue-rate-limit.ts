/**
 * Rate limit enqueue media theo customer — chặn spam retry 429 làm quá tải server (504).
 */
import redis from "../../../helpers/redis";

const WINDOW_SEC = 60;
/** Tối đa POST enqueue / phút / customer (bao gồm retry khi hết slot luồng). */
const ENQUEUE_MAX_PER_MIN = 90;

const ENQUEUE_COUNT_KEY_PREFIX = "media:enqueue:rl:";

export async function assertMediaEnqueueRateLimit(customerId: string): Promise<void> {
  const key = `${ENQUEUE_COUNT_KEY_PREFIX}${customerId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  if (count > ENQUEUE_MAX_PER_MIN) {
    const err: any = new Error(
      `Quá nhiều yêu cầu tạo media (${ENQUEUE_MAX_PER_MIN}/phút). Vui lòng chờ vài giây rồi thử lại.`
    );
    err.statusCode = 429;
    err.retryAfterMs = 5000;
    throw err;
  }
}
