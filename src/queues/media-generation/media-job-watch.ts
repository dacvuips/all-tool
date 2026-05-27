/**
 * Job watcher — Redis TTL cho biết client còn đang theo dõi job (subscription / heartbeat).
 *
 * Key: `mgj:watch:{jobId}` → customerId, TTL 45s (gia hạn khi subscribe hoặc touch).
 * Worker chỉ chạy pipeline khi key tồn tại (sau grace period cho race POST → subscribe).
 */
import logger from "../../helpers/logger";
import redis from "../../helpers/redis";

const KEY_PREFIX = "mgj:watch:";

/** TTL key watch (giây) — hết hạn ≈ client đóng tab / mất WS */
export const MEDIA_JOB_WATCH_TTL_SEC = 45;

/** Sau khi tạo job, chờ tối đa bao lâu để client subscribe (ms) */
export const MEDIA_JOB_WATCH_GRACE_MS = 30_000;

/** Hoãn pickup lại khi chưa có watcher nhưng còn trong grace */
export const MEDIA_JOB_WATCH_RETRY_DELAY_MS = 5_000;

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
