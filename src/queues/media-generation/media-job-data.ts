/**
 * Lưu payload request của media job trên Redis (thay vì MongoDB).
 *
 * Key: `mgj:data:{jobId}` — TTL 1 giờ.
 * Job Mongo chỉ giữ `dataRedisKey` để worker đọc lại khi xử lý.
 */
import logger from "../../helpers/logger";
import redis, { ensureRedisReady } from "../../helpers/redis";
import { isRedisUnavailableError } from "../../helpers/sharedRedisClient";

/** TTL payload trên Redis — 1 giờ */
export const MEDIA_JOB_DATA_TTL_SEC = 60 * 60;
export const MEDIA_JOB_DATA_TTL_MS = MEDIA_JOB_DATA_TTL_SEC * 1000;

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

/** `createdAt` Mongo, fallback timestamp trong ObjectId. */
export function getMediaJobCreatedAt(job: {
  _id?: { getTimestamp?: () => Date } | string;
  createdAt?: Date | string | null;
}): Date | null {
  if (job.createdAt) {
    const d = job.createdAt instanceof Date ? job.createdAt : new Date(job.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const id = job._id;
  if (id && typeof id === "object" && typeof id.getTimestamp === "function") {
    return id.getTimestamp();
  }
  if (typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)) {
    const sec = parseInt(id.slice(0, 8), 16);
    if (!Number.isNaN(sec)) return new Date(sec * 1000);
  }
  return null;
}

/**
 * Payload Redis chỉ được coi là hết hạn khi đã quá TTL **theo thời gian tạo job**.
 * Redis miss sớm hơn (restart / Redis chưa ready) không được fail unrecoverable.
 */
export function isMediaJobPayloadTtlElapsed(
  job: {
    _id?: { getTimestamp?: () => Date } | string;
    createdAt?: Date | string | null;
  },
  now = Date.now()
): boolean {
  const createdAt = getMediaJobCreatedAt(job);
  if (!createdAt) return false;
  return now - createdAt.getTime() >= MEDIA_JOB_DATA_TTL_MS;
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

/**
 * Redis miss + đã quá TTL theo createdAt → fail unrecoverable.
 * Redis miss nhưng job còn trong TTL → chưa coi là hết hạn (có thể Redis tạm mất / chưa ready).
 */
export async function shouldFailMediaJobAsPayloadExpired(job: {
  _id?: { getTimestamp?: () => Date } | string;
  createdAt?: Date | string | null;
  dataRedisKey?: string | null;
  requestPayload?: Record<string, unknown>;
}): Promise<boolean> {
  if (await isMediaJobPayloadAvailable(job)) return false;
  return isMediaJobPayloadTtlElapsed(job);
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
    await ensureRedisReady();
    await redis.set(key, JSON.stringify(payload), "EX", MEDIA_JOB_DATA_TTL_SEC);
    return key;
  } catch (err: any) {
    logger.error(`[MediaJobData] save jobId=${jobId} lỗi: ${err?.message}`);
    if (isRedisUnavailableError(err) || !err?.statusCode) {
      const wrapped: any = new Error("Không thể lưu dữ liệu job. Vui lòng thử lại sau.");
      wrapped.statusCode = 503;
      throw wrapped;
    }
    throw err;
  }
}

/** Worker đọc payload từ Redis; fallback `requestPayload` Mongo cho job cũ. */
export async function loadMediaJobPayload<T extends Record<string, unknown>>(job: {
  _id?: { getTimestamp?: () => Date } | string;
  createdAt?: Date | string | null;
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
      // Chỉ 410 khi đã quá TTL theo createdAt; miss sớm → 503 để retry.
      if (isMediaJobPayloadTtlElapsed(job)) {
        const err: any = new Error(MEDIA_JOB_PAYLOAD_EXPIRED_MESSAGE);
        err.statusCode = 410;
        throw err;
      }
      const transient: any = new Error("Không đọc được dữ liệu job từ Redis.");
      transient.statusCode = 503;
      throw transient;
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
