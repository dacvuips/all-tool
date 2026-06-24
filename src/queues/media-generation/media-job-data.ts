/**
 * Lưu payload request của media job trên Redis (thay vì MongoDB).
 *
 * Key: `mgj:data:{jobId}` — TTL 1 giờ.
 * Job Mongo chỉ giữ `dataRedisKey` để worker đọc lại khi xử lý.
 */
import logger from "../../helpers/logger";
import redis from "../../helpers/redis";

/** TTL payload trên Redis — 4 giờ */
export const MEDIA_JOB_DATA_TTL_SEC = 240 * 60;

/** Job Redis-only mà key đã hết TTL — không thể resume sau restart. */
export const MEDIA_JOB_PAYLOAD_EXPIRED_MESSAGE =
  "Dữ liệu job đã hết hạn trên Redis. Vui lòng tạo lại job.";

const KEY_PREFIX = "mgj:data:";

export function hasMongoRequestPayload(job: {
  requestPayload?: Record<string, unknown>;
}): boolean {
  const payload = job.requestPayload;
  return !!payload && typeof payload === "object" && Object.keys(payload).length > 0;
}

/** Redis còn key hoặc job cũ còn `requestPayload` trên Mongo. */
export async function isMediaJobPayloadAvailable(job: {
  dataRedisKey?: string | null;
  requestPayload?: Record<string, unknown>;
}): Promise<boolean> {
  if (!job.dataRedisKey) {
    return hasMongoRequestPayload(job);
  }
  try {
    const raw = await redis.get(job.dataRedisKey);
    if (raw) return true;
  } catch (err: any) {
    logger.warn(`[MediaJobData] exists key=${job.dataRedisKey} lỗi: ${err?.message}`);
  }
  return hasMongoRequestPayload(job);
}

export function buildMediaJobDataKey(jobId: string): string {
  return `${KEY_PREFIX}${jobId}`;
}

/** Ghi payload lên Redis trước khi tạo job Mongo. */
export async function saveMediaJobPayload(
  jobId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const key = buildMediaJobDataKey(jobId);
  try {
    await redis.set(key, JSON.stringify(payload), "EX", MEDIA_JOB_DATA_TTL_SEC);
    return key;
  } catch (err: any) {
    logger.error(`[MediaJobData] save jobId=${jobId} lỗi: ${err?.message}`);
    const wrapped: any = new Error("Không thể lưu dữ liệu job. Vui lòng thử lại sau.");
    wrapped.statusCode = 503;
    throw wrapped;
  }
}

/** Worker đọc payload từ Redis; fallback `requestPayload` Mongo cho job cũ. */
export async function loadMediaJobPayload<T extends Record<string, unknown>>(job: {
  dataRedisKey?: string | null;
  requestPayload?: Record<string, unknown>;
}): Promise<T> {
  const key = job.dataRedisKey;
  if (key) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        return JSON.parse(raw) as T;
      }
      if (hasMongoRequestPayload(job)) {
        logger.warn(`[MediaJobData] Redis miss key=${key}, dùng requestPayload Mongo`);
        return job.requestPayload as T;
      }
      const err: any = new Error(MEDIA_JOB_PAYLOAD_EXPIRED_MESSAGE);
      err.statusCode = 410;
      throw err;
    } catch (err: any) {
      if (err?.statusCode) throw err;
      logger.error(`[MediaJobData] load key=${key} lỗi: ${err?.message}`);
      const wrapped: any = new Error("Không đọc được dữ liệu job từ Redis.");
      wrapped.statusCode = 503;
      throw wrapped;
    }
  }

  // Job cũ còn lưu trực tiếp trên Mongo
  return (job.requestPayload || {}) as T;
}

/** Xóa payload Redis khi job kết thúc (best-effort; TTL vẫn là lớp backup). */
export async function clearMediaJobPayload(dataRedisKey?: string | null): Promise<void> {
  if (!dataRedisKey) return;
  try {
    await redis.del(dataRedisKey);
  } catch (err: any) {
    logger.warn(`[MediaJobData] clear key=${dataRedisKey} lỗi: ${err?.message}`);
  }
}
