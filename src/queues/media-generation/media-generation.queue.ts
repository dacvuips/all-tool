/**
 * Queue xử lý Media Generation Job (ảnh/video).
 *
 * Mỗi job trong queue trỏ tới 1 bản ghi `MediaGenerationJob` trong Mongo (qua `jobId`).
 * Worker:
 *   1. Load doc → kiểm tra idempotency (đã terminal? bỏ qua).
 *   2. Khởi tạo `MediaJobEmitter` (chuyển sang PROCESSING + emit progress).
 *   3. Dispatch handler theo `type`.
 *   4. Nhận `resultData` → emitter.succeed(...).
 *   5. Lỗi → emitter.fail(err.message, err.statusCode).
 *   6. Đặc biệt: `MediaJobCancelledError` → coi như đã CANCELLED (không log lỗi server).
 *   7. **Job watcher**: chỉ chạy khi Redis key `mgj:watch:{jobId}` còn (subscription / touchWatch).
 *   8. **Terminal retention**: SUCCEEDED giữ 10 phút; FAILED giữ 15 phút kể từ `completedAt`.
 *      Sweep mỗi 5 phút xóa doc hết hạn (backup khi setTimeout mất do restart).
 *   9. **Stale PROCESSING**: mỗi 60s quét job không heartbeat > ~2.5 phút → re-enqueue;
 *      sau 5 lần claim vẫn treo → FAILED (504).
 *
 * Không bật **auto-retry**: API generation tốn quota, retry ngầm dễ ngốn credit. User retry thủ công.
 */
import { Job } from "bee-queue";
import { BaseQueue } from "../../base/baseQueue";
import logger from "../../helpers/logger";
import {
  IMediaGenerationJob,
  mediaGenerationJobService,
  MediaGenerationJobModel,
  MediaGenerationJobStatus,
  isMediaJobTerminal,
} from "../../libs/dal/mediaGenerationJob";
import { getMediaJobHandler } from "./handlers";
import {
  abandonMediaJobNoWatcher,
  failOrphanedProcessingMediaJob,
  FAILED_JOB_RETENTION_MS,
  HEARTBEAT_MS,
  LOCK_TTL_MS,
  MediaJobEmitter,
  SUCCESS_JOB_RETENTION_MS,
} from "./job-emitter";
import { MediaJobCancelledError } from "./job-errors";
import {
  isJobWatched,
  MEDIA_JOB_WATCH_GRACE_MS,
  MEDIA_JOB_WATCH_RETRY_DELAY_MS,
} from "./media-job-watch";

/** Tối đa 20 phút cho 1 job trước khi bị coi là stalled. */
const MEDIA_GENERATION_STALL_INTERVAL_MS = 20 * 60 * 1000;

/** Mọi job Redis được giữ tối đa 72h, sau đó cleanup (state vẫn còn ở Mongo). */
const MEDIA_GENERATION_JOB_RETENTION_MS = 72 * 60 * 60 * 1000;

/** Tần suất quét xóa doc Mongo terminal (FAILED / SUCCEEDED) hết hạn. */
const MEDIA_JOB_CLEANUP_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
/** Quét job PROCESSING không cập nhật (treo Flow2 / worker chết). */
const MEDIA_JOB_STALE_RECOVERY_SWEEP_INTERVAL_MS = 60 * 1000; // 1 phút
/**
 * Không có heartbeat/progress trong khoảng này → coi là treo.
 * = 2× LOCK_TTL + 1× HEARTBEAT (worker sống phải gia hạn lock mỗi 15–60s).
 */
export const MEDIA_JOB_STALE_PROCESSING_MS = LOCK_TTL_MS * 2 + HEARTBEAT_MS;
/** Số lần reclaim tối đa (mỗi lần claim tăng `attempts`) trước khi FAILED. */
export const MEDIA_JOB_MAX_STALE_RECOVERIES = 5;

/** Tham số bee-queue cho mỗi job — chỉ chứa `jobId` để worker load đầy đủ từ Mongo. */
export type MediaQueueJobPayload = {
  jobId: string;
};

class MediaGenerationQueue extends BaseQueue {
  constructor() {
    super("MediaGenerationJob", 3, {
      removeOnSuccess: true,
      removeOnFailure: false, // giữ failed job để có thể inspect; cleanup retention sẽ dọn
      stallIntervalMs: MEDIA_GENERATION_STALL_INTERVAL_MS,
      jobRetentionMs: MEDIA_GENERATION_JOB_RETENTION_MS,
      activateDelayedJobs: true, // hoãn pickup khi chưa có job watcher
    });
  }

  protected async process(job: Job<MediaQueueJobPayload>): Promise<void> {
    const { jobId } = job.data || {};
    this.logger.info(`[MediaGenerationJob] PICKUP jobId=${jobId} beeJobId=${(job as any).id}`);
    if (!jobId) {
      this.logger.warn("MediaGenerationJob: missing jobId in queue payload");
      return;
    }

    const jobDoc = (await mediaGenerationJobService.findOne({
      _id: jobId,
    })) as unknown as IMediaGenerationJob | null;

    if (!jobDoc) {
      this.logger.warn(`MediaGenerationJob ${jobId} not found in Mongo (đã xoá?)`);
      return;
    }

    this.logger.info(
      `[MediaGenerationJob] LOADED jobId=${jobId} type=${(jobDoc as any).type} status=${(jobDoc as any).status}`
    );

    // Idempotency: nếu đã terminal (CANCELLED / SUCCEEDED / FAILED), không xử lý nữa.
    // Trường hợp này xảy ra khi bee-queue stall + reprocess.
    if (isMediaJobTerminal((jobDoc as any).status)) {
      this.logger.info(
        `MediaGenerationJob ${jobId} đã ở trạng thái terminal (${(jobDoc as any).status}), bỏ qua.`
      );
      return;
    }

    // Chỉ chạy khi client còn subscribe / heartbeat job (job watcher)
    if (!(await isJobWatched(jobId))) {
      const createdAt = (jobDoc as any).createdAt
        ? new Date((jobDoc as any).createdAt).getTime()
        : Date.now();
      const ageMs = Date.now() - createdAt;
      if (ageMs < MEDIA_JOB_WATCH_GRACE_MS) {
        this.logger.info(
          `[MediaGenerationJob] jobId=${jobId} chưa có watcher (${Math.round(ageMs)}ms), hoãn ${MEDIA_JOB_WATCH_RETRY_DELAY_MS}ms`
        );
        await enqueueMediaGenerationJob(jobId, { delayMs: MEDIA_JOB_WATCH_RETRY_DELAY_MS });
        return;
      }
      this.logger.info(
        `[MediaGenerationJob] jobId=${jobId} không có watcher sau grace — huỷ và xóa`
      );
      await abandonMediaJobNoWatcher(jobId, (jobDoc as any).customerId);
      return;
    }

    // Thử claim worker lock — nếu worker khác đang giữ thì skip.
    const emitter = await MediaJobEmitter.tryClaim(jobDoc);
    if (!emitter) {
      this.logger.info(`[MediaGenerationJob] SKIP jobId=${jobId} (worker khác đang xử lý)`);
      return;
    }

    try {
      const handler = getMediaJobHandler((jobDoc as any).type);
      const result = await handler(jobDoc, emitter);
      await emitter.succeed(result as Record<string, unknown>);
    } catch (err: any) {
      if (err instanceof MediaJobCancelledError) {
        this.logger.info(`MediaGenerationJob ${jobId} bị huỷ giữa chừng.`);
        return;
      }

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Lỗi không xác định khi tạo media";
      const statusCode = err?.statusCode || err?.status || 500;
      this.logger.error(`MediaGenerationJob ${jobId} thất bại: ${message}`, err);

      await emitter.fail(message, statusCode);
      // KHÔNG throw — đã capture vào job state.
    }
  }
}

export const mediaGenerationQueue = new MediaGenerationQueue();

/**
 * Đẩy 1 job vào queue. Caller (route POST) phải đã tạo `MediaGenerationJob` doc và truyền `jobId`.
 *
 * Trả về promise resolve khi job đã enqueue thành công (chưa chắc đã chạy).
 */
export async function enqueueMediaGenerationJob(
  jobId: string,
  options?: { delayMs?: number }
): Promise<void> {
  try {
    let beeJob = mediaGenerationQueue.queue().createJob({ jobId });
    const delayMs = options?.delayMs ?? 0;
    if (delayMs > 0) {
      beeJob = beeJob.delayUntil(Date.now() + delayMs);
    }
    const saved = await beeJob.save();
    logger.info(
      `[MediaGenerationQueue] ENQUEUED jobId=${jobId} beeJobId=${(saved as any).id}${
        delayMs > 0 ? ` delay=${delayMs}ms` : ""
      }`
    );
  } catch (err: any) {
    logger.error(`[MediaGenerationQueue] enqueue lỗi: ${err?.message}`);
    throw err;
  }
}

/** Status snapshot dùng cho health-check */
export function getMediaGenerationQueueStatus() {
  return mediaGenerationQueue.getQueueStatus();
}

/**
 * Quét các job đang PROCESSING mà lock đã hết hạn (worker chết / nodemon restart)
 * và đẩy lại vào bee-queue để worker khác tiếp nhận.
 *
 * - Chỉ enqueue lại nếu `lockExpiresAt < now - gracePeriod` (tránh enqueue trùng khi worker
 *   hiện tại vẫn còn sống nhưng update chưa kịp).
 * - Worker pickup sẽ gọi `MediaJobEmitter.tryClaim()` — claim được thì chạy, không thì skip.
 * - Không reset progress / attempts — handler tự bắt đầu lại từ bước đầu của pipeline.
 */
export async function resumeStaleMediaJobs(): Promise<number> {
  try {
    // Tất cả job đang PROCESSING ở phiên trước đều thuộc về worker đã chết
    // (process restart → WORKER_INSTANCE_ID mới). Reset lock để worker hiện tại claim được.
    const resetResult = await MediaGenerationJobModel.updateMany(
      { status: MediaGenerationJobStatus.PROCESSING },
      { $set: { lockExpiresAt: null, workerInstanceId: null } }
    );
    if ((resetResult as any).modifiedCount > 0) {
      logger.info(
        `[MediaGenerationQueue] Reset lock cho ${(resetResult as any).modifiedCount} job PROCESSING từ phiên trước`
      );
    }

    const jobs = (await mediaGenerationJobService.findAll({
      filter: {
        status: {
          $in: [MediaGenerationJobStatus.QUEUED, MediaGenerationJobStatus.PROCESSING],
        },
      },
      limit: 500,
      order: { createdAt: 1 },
    } as any)) as unknown as IMediaGenerationJob[];

    if (jobs.length === 0) return 0;
    logger.info(`[MediaGenerationQueue] Re-enqueue ${jobs.length} job(s) sau restart`);
    for (const job of jobs) {
      const jobId = String((job as any)._id);
      try {
        await enqueueMediaGenerationJob(jobId);
      } catch (err: any) {
        logger.error(`[MediaGenerationQueue] Resume jobId=${jobId} lỗi: ${err?.message}`);
      }
    }
    return jobs.length;
  } catch (err: any) {
    logger.error(`[MediaGenerationQueue] resumeStaleMediaJobs lỗi: ${err?.message}`);
    return 0;
  }
}

/**
 * Xóa doc Mongo terminal đã hết hạn.
 * - FAILED: `completedAt` cũ hơn 10 phút (kể từ lúc fail).
 * - SUCCEEDED: `completedAt` cũ hơn 10 phút.
 */
/**
 * Job PROCESSING mà lock hết hạn / null và `updatedAt` quá cũ → re-enqueue hoặc FAILED.
 * Bắt trường hợp worker crash, nodemon restart không enqueue lại, hoặc poll Flow2 treo.
 */
export async function recoverStaleProcessingMediaJobs(): Promise<{
  requeued: number;
  failed: number;
}> {
  try {
    const now = new Date();
    const staleCutoff = new Date(Date.now() - MEDIA_JOB_STALE_PROCESSING_MS);

    const jobs = (await mediaGenerationJobService.findAll({
      filter: {
        status: MediaGenerationJobStatus.PROCESSING,
        updatedAt: { $lt: staleCutoff },
        $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lt: now } }],
      },
      limit: 200,
      order: { updatedAt: 1 },
    } as any)) as unknown as IMediaGenerationJob[];

    let requeued = 0;
    let failed = 0;

    for (const job of jobs) {
      const jobId = String((job as any)._id);
      const attempts = (job as any).attempts ?? 1;

      if (attempts >= MEDIA_JOB_MAX_STALE_RECOVERIES) {
        const ok = await failOrphanedProcessingMediaJob(
          jobId,
          `Job treo quá lâu ở PROCESSING (đã thử ${attempts} lần). Vui lòng tạo job mới.`,
          504
        );
        if (ok) failed++;
        continue;
      }

      await MediaGenerationJobModel.updateOne(
        { _id: jobId, status: MediaGenerationJobStatus.PROCESSING },
        {
          $set: {
            lockExpiresAt: null,
            workerInstanceId: null,
            message: "Đang thử lại (job bị treo, khôi phục tự động)...",
          },
        }
      );

      try {
        await enqueueMediaGenerationJob(jobId);
        requeued++;
        logger.warn(
          `[MediaGenerationQueue] Re-enqueue stale PROCESSING jobId=${jobId} attempts=${attempts}`
        );
      } catch (err: any) {
        logger.error(
          `[MediaGenerationQueue] Re-enqueue stale jobId=${jobId} lỗi: ${err?.message}`
        );
      }
    }

    if (requeued > 0 || failed > 0) {
      logger.info(
        `[MediaGenerationQueue] Stale PROCESSING sweep: requeued=${requeued}, failed=${failed}`
      );
    }
    return { requeued, failed };
  } catch (err: any) {
    logger.error(`[MediaGenerationQueue] recoverStaleProcessingMediaJobs lỗi: ${err?.message}`);
    return { requeued: 0, failed: 0 };
  }
}

export async function cleanupExpiredTerminalMediaJobs(): Promise<{
  failed: number;
  succeeded: number;
}> {
  try {
    const now = Date.now();
    const failedCutoff = new Date(now - FAILED_JOB_RETENTION_MS);
    const successCutoff = new Date(now - SUCCESS_JOB_RETENTION_MS);

    const [failedResult, successResult] = await Promise.all([
      MediaGenerationJobModel.deleteMany({
        status: MediaGenerationJobStatus.FAILED,
        completedAt: { $lt: failedCutoff, $ne: null },
      }),
      MediaGenerationJobModel.deleteMany({
        status: MediaGenerationJobStatus.SUCCEEDED,
        completedAt: { $lt: successCutoff, $ne: null },
      }),
    ]);

    const failed = (failedResult as any).deletedCount ?? 0;
    const succeeded = (successResult as any).deletedCount ?? 0;
    if (failed > 0 || succeeded > 0) {
      logger.info(
        `[MediaGenerationQueue] Cleanup sweep: removed ${failed} FAILED, ${succeeded} SUCCEEDED`
      );
    }
    return { failed, succeeded };
  } catch (err: any) {
    logger.error(`[MediaGenerationQueue] cleanupExpiredTerminalMediaJobs lỗi: ${err?.message}`);
    return { failed: 0, succeeded: 0 };
  }
}

let mediaJobCleanupSweepTimer: ReturnType<typeof setInterval> | null = null;
let mediaJobStaleRecoveryTimer: ReturnType<typeof setInterval> | null = null;

/** Bật sweep định kỳ — idempotent, gọi 1 lần khi worker start. */
export function startMediaJobCleanupSweep(): void {
  if (mediaJobCleanupSweepTimer) return;

  const runTerminalCleanup = () => {
    cleanupExpiredTerminalMediaJobs().catch((err) =>
      logger.error("[MediaGenerationQueue] cleanup sweep lỗi", err)
    );
  };

  runTerminalCleanup();
  mediaJobCleanupSweepTimer = setInterval(runTerminalCleanup, MEDIA_JOB_CLEANUP_SWEEP_INTERVAL_MS);
  if (typeof mediaJobCleanupSweepTimer.unref === "function") {
    mediaJobCleanupSweepTimer.unref();
  }
  logger.info(
    `[MediaGenerationQueue] Terminal job cleanup sweep every ${MEDIA_JOB_CLEANUP_SWEEP_INTERVAL_MS / 60000} min`
  );
}

/** Quét job PROCESSING treo — idempotent, gọi 1 lần khi worker start. */
export function startStaleProcessingRecoverySweep(): void {
  if (mediaJobStaleRecoveryTimer) return;

  const run = () => {
    recoverStaleProcessingMediaJobs().catch((err) =>
      logger.error("[MediaGenerationQueue] stale PROCESSING sweep lỗi", err)
    );
  };

  run();
  mediaJobStaleRecoveryTimer = setInterval(run, MEDIA_JOB_STALE_RECOVERY_SWEEP_INTERVAL_MS);
  if (typeof mediaJobStaleRecoveryTimer.unref === "function") {
    mediaJobStaleRecoveryTimer.unref();
  }
  logger.info(
    `[MediaGenerationQueue] Stale PROCESSING recovery every ${MEDIA_JOB_STALE_RECOVERY_SWEEP_INTERVAL_MS / 1000}s (threshold ${MEDIA_JOB_STALE_PROCESSING_MS / 1000}s)`
  );
}

/**
 * Thử retry 1 job FAILED: tạo job mới trong bee-queue (job doc vẫn giữ).
 * Lưu ý: chỉ retry khi caller xác nhận chính chủ (kiểm tra customerId).
 */
export async function retryMediaGenerationJob(jobId: string): Promise<boolean> {
  const job = (await mediaGenerationJobService.findOne({
    _id: jobId,
  })) as unknown as IMediaGenerationJob | null;
  if (!job) return false;
  const status = (job as any).status as MediaGenerationJobStatus;
  if (status === MediaGenerationJobStatus.SUCCEEDED) return false;
  if (status === MediaGenerationJobStatus.PROCESSING) return false;
  // Reset trạng thái về QUEUED để worker pickup lại
  await mediaGenerationJobService.updateOne(jobId, {
    status: MediaGenerationJobStatus.QUEUED,
    progress: 0,
    message: "Đang chờ trong hàng đợi (retry)...",
    errorMessage: null,
    errorCode: null,
    cancelRequestedAt: null,
    completedAt: null,
    startedAt: null,
  } as any);
  await enqueueMediaGenerationJob(jobId);
  return true;
}
