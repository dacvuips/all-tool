/**
 * Job watcher — Redis TTL cho biết client còn đang theo dõi job (subscription / heartbeat).
 *
 * Key: `mgj:watch:{jobId}` → customerId, TTL MEDIA_JOB_WATCH_TTL_SEC.
 *
 * Luồng khởi tạo (sau tối ưu start nhanh):
 *   1. `createAndEnqueueMediaJob` gọi `markJobWatched` **trước** enqueue → worker pickup ngay, không chờ WS.
 *   2. Client `touchWatch` ngay sau POST + mỗi WATCH_HEARTBEAT_MS (FE) → gia hạn TTL suốt job dài (video).
 *   3. GraphQL subscription cũng gọi `markJobWatched` khi connect — lớp backup.
 *
 * Worker chỉ chạy pipeline khi key tồn tại. Nếu client đóng tab và không refresh TTL,
 * key hết hạn → `emitter.progress()` huỷ job (tránh tốn quota API vô hạn).
 *
 * Quan hệ timing (giữ ổn định):
 *   - TTL (60s) > 2 × heartbeat FE (20s) + buffer mạng (~15s).
 *   - Retry delay (1.5s) chỉ dùng khi key chưa kịp tạo (Redis lag / race hiếm).
 */
import logger from "../../helpers/logger";
import redis from "../../helpers/redis";

const KEY_PREFIX = "mgj:watch:";

/**
 * TTL key watch (giây).
 * Gia hạn bởi: markJobWatched, refreshJobWatch (touchWatch), subscribe lần đầu.
 * Hết TTL ≈ không còn client theo dõi → worker dừng ở milestone progress tiếp theo.
 */
export const MEDIA_JOB_WATCH_TTL_SEC = 60;

/**
 * Sau khi tạo job, chờ tối đa bao lâu để có watcher (ms).
 * Dùng khi worker pickup mà key chưa tồn tại — hiếm sau khi server primed watch lúc enqueue.
 */
export const MEDIA_JOB_WATCH_GRACE_MS = 30_000;

/**
 * Hoãn pickup lại khi chưa có watcher nhưng còn trong grace (ms).
 * Giảm từ 5s → 1.5s: retry nhanh hơn nếu race Redis/Mongo; không ảnh hưởng job đã có key.
 */
export const MEDIA_JOB_WATCH_RETRY_DELAY_MS = 1_500;

function watchKey(jobId: string): string {
  return `${KEY_PREFIX}${jobId}`;
}

/** Đăng ký client đang theo dõi job (gọi khi GraphQL subscription bắt đầu). */
export async function markJobWatched(jobId: string, customerId: string): Promise<void> {
  try {
    await redis.set(watchKey(jobId), customerId, "EX", MEDIA_JOB_WATCH_TTL_SEC);
  } catch (err: any) {
    logger.warn(`[MediaJobWatch] markJobWatched jobId=${jobId} lỗi: ${err?.message}`);
  }
}

/** Gia hạn TTL — chỉ khi customerId khớp (chống client khác touch nhầm). */
export async function refreshJobWatch(jobId: string, customerId: string): Promise<boolean> {
  try {
    const key = watchKey(jobId);
    const current = await redis.get(key);
    if (current === customerId) {
      await redis.expire(key, MEDIA_JOB_WATCH_TTL_SEC);
      return true;
    }
    if (!current) {
      await redis.set(key, customerId, "EX", MEDIA_JOB_WATCH_TTL_SEC);
      return true;
    }
    return false;
  } catch (err: any) {
    logger.warn(`[MediaJobWatch] refreshJobWatch jobId=${jobId} lỗi: ${err?.message}`);
    return false;
  }
}

/** Client còn đang watch job không? */
export async function isJobWatched(jobId: string): Promise<boolean> {
  try {
    return (await redis.exists(watchKey(jobId))) === 1;
  } catch (err: any) {
    logger.warn(`[MediaJobWatch] isJobWatched jobId=${jobId} lỗi: ${err?.message}`);
    // Lỗi Redis → coi như còn watch để tránh huỷ nhầm job đang chạy
    return true;
  }
}

export async function clearJobWatch(jobId: string): Promise<void> {
  try {
    await redis.del(watchKey(jobId));
  } catch (err: any) {
    logger.warn(`[MediaJobWatch] clearJobWatch jobId=${jobId} lỗi: ${err?.message}`);
  }
}
