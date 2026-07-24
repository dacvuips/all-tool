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
 *   7. **Giới hạn luồng**: route kiểm tra số job QUEUED/PROCESSING theo `imageStreamCount`/`videoStreamCount`.
 *   8. **Payload Redis**: worker đọc `dataRedisKey` (TTL 4 giờ) thay vì `requestPayload` Mongo.
 *   9. **Terminal retention**: SUCCEEDED / FAILED giữ 30 phút kể từ `completedAt`.
 *      Sweep mỗi 5 phút xóa doc hết hạn (backup khi setTimeout mất do restart).
 *   10. **Stale PROCESSING**: mỗi 60s quét job không heartbeat > ~2.5 phút → re-enqueue;
 *      sau 5 lần claim vẫn treo → FAILED (504).
 *   11. **Orphaned QUEUED**: mỗi 60s quét job Mongo QUEUED chưa pickup > 2 phút → re-enqueue;
 *      nếu bee-queue `waiting > 0` mà `active = 0` → restart consumer (không cần restart server).
 *
 * Không bật **auto-retry**: API generation tốn quota, retry ngầm dễ ngốn credit. User retry thủ công.
 */
import { Job } from "bee-queue";
import { BaseQueue } from "../../base/baseQueue";
import logger from "../../helpers/logger";
import {
  IMediaGenerationJob,
  isMediaJobTerminal,
  MediaGenerationJobModel,
  mediaGenerationJobService,
  MediaGenerationJobStatus,
  MediaGenerationJobType,
} from "../../libs/dal/mediaGenerationJob";
import { getMediaJobHandler } from "./handlers";
import {
  FAILED_JOB_RETENTION_MS,
  failOrphanedProcessingMediaJob,
  failUnrecoverableMediaJob,
  HEARTBEAT_MS,
  LOCK_TTL_MS,
  MediaJobEmitter,
  SUCCESS_JOB_RETENTION_MS,
} from "./job-emitter";
import { MediaJobCancelledError } from "./job-errors";
import { assertMediaStreamAvailable, canStartMediaJobProcessing } from "./media-job-concurrency";
import {
  assertApiMediaStreamAvailable,
  canStartApiMediaJobProcessing,
  isApiMediaJobType,
} from "./api-media-job-concurrency";
import { incrementApiMediaTokenUsage } from "./handlers/_api-media-quota";
import { isAiTextJobType } from "./ai-text-job-types";
import { isMediaJobPayloadAvailable, MEDIA_JOB_PAYLOAD_EXPIRED_MESSAGE } from "./media-job-data";

/** Tối đa 30 phút cho 1 job trước khi bị coi là stalled. */
const MEDIA_GENERATION_STALL_INTERVAL_MS = 30 * 60 * 1000;

/** Mọi job Redis được giữ tối đa 72h, sau đó cleanup (state vẫn còn ở Mongo). */
const MEDIA_GENERATION_JOB_RETENTION_MS = 72 * 60 * 60 * 1000;

/** Tần suất quét xóa doc Mongo terminal (FAILED / SUCCEEDED) hết hạn. */
const MEDIA_JOB_CLEANUP_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
/** Quét job PROCESSING / QUEUED mồ côi (treo Flow2 / consumer bee-queue chết). */
const MEDIA_JOB_STALE_RECOVERY_SWEEP_INTERVAL_MS = 60 * 1000; // 1 phút
/** Job Mongo QUEUED chưa từng pickup (`startedAt` null) quá lâu → re-enqueue. */
export const MEDIA_JOB_ORPHANED_QUEUED_MS = 2 * 60 * 1000; // 2 phút
/**
 * Không có heartbeat/progress trong khoảng này → coi là treo.
 * = 2× LOCK_TTL + 1× HEARTBEAT (worker sống phải gia hạn lock mỗi 15–60s).
 */
export const MEDIA_JOB_STALE_PROCESSING_MS = LOCK_TTL_MS * 2 + HEARTBEAT_MS;
/** Số lần reclaim tối đa (mỗi lần claim tăng `attempts`) trước khi FAILED. */
export const MEDIA_JOB_MAX_STALE_RECOVERIES = 5;

/** Tham số bee-queue cho mỗi job — chỉ chứa `jobId` để worker load đầy đủ từ Mongo. */

/** Số worker bee-queue — giới hạn tải toàn cục, tránh OOM khi nhiều job video chạy song song. */
const MEDIA_GENERATION_QUEUE_WORKERS = 30;

/** Job QUEUED chờ slot PROCESSING — re-enqueue sau khoảng này (ms). */
const MEDIA_JOB_STREAM_DEFER_MS = 5_000;

/** Khoảng cách giữa các job khi resume sau restart — tránh thundering herd. */
const MEDIA_JOB_RESUME_STAGGER_MS = 300;

export type MediaQueueJobPayload = {
  jobId: string;
};

class MediaGenerationQueue extends BaseQueue {
  constructor() {
    super("MediaGenerationJob", MEDIA_GENERATION_QUEUE_WORKERS, {
      removeOnSuccess: true,
      removeOnFailure: false, // giữ failed job để có thể inspect; cleanup retention sẽ dọn
      stallIntervalMs: MEDIA_GENERATION_STALL_INTERVAL_MS,
      jobRetentionMs: MEDIA_GENERATION_JOB_RETENTION_MS,
      activateDelayedJobs: true,
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
      `[MediaGenerationJob] LOADED jobId=${jobId} type=${(jobDoc as any).type} status=${
        (jobDoc as any).status
      }`
    );

    // Idempotency: nếu đã terminal (CANCELLED / SUCCEEDED / FAILED), không xử lý nữa.
    // Trường hợp này xảy ra khi bee-queue stall + reprocess.
    if (isMediaJobTerminal((jobDoc as any).status)) {
      this.logger.info(
        `MediaGenerationJob ${jobId} đã ở trạng thái terminal (${(jobDoc as any).status}), bỏ qua.`
      );
      return;
    }

    if (!(await isMediaJobPayloadAvailable(jobDoc))) {
      await failUnrecoverableMediaJob(jobId, MEDIA_JOB_PAYLOAD_EXPIRED_MESSAGE, 410);
      return;
    }

    // Giới hạn luồng theo customer: job QUEUED chỉ pickup khi còn slot PROCESSING.
    // Tránh race enqueue (nhiều POST đồng thời) hoặc resume sau restart làm quá tải server.
    if ((jobDoc as any).status === MediaGenerationJobStatus.QUEUED) {
      const jobType = (jobDoc as any).type as MediaGenerationJobType;
      const apiMediaTokenId = (jobDoc as any).metadata?.apiMediaTokenId as string | undefined;

      const canStart = isApiMediaJobType(jobType)
        ? apiMediaTokenId
          ? await canStartApiMediaJobProcessing(apiMediaTokenId)
          : false
        : isAiTextJobType(jobType)
          ? true
          : await canStartMediaJobProcessing((jobDoc as any).customerId, jobType);

      if (!canStart) {
        this.logger.info(
          `[MediaGenerationJob] DEFER jobId=${jobId} (đã đạt giới hạn luồng PROCESSING)`
        );
        await enqueueMediaGenerationJob(jobId, { delayMs: MEDIA_JOB_STREAM_DEFER_MS });
        return;
      }
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
      const succeeded = await emitter.succeed(result as Record<string, unknown>);

      // API Media gen image/video: trừ usedQuantity chỉ khi SUCCEEDED. Upsample không trừ.
      if (
        succeeded &&
        ((jobDoc as any).type === MediaGenerationJobType.API_MEDIA_IMAGE ||
          (jobDoc as any).type === MediaGenerationJobType.API_MEDIA_VIDEO)
      ) {
        const apiMediaTokenId = (jobDoc as any).metadata?.apiMediaTokenId as string | undefined;
        if (apiMediaTokenId) {
          try {
            await incrementApiMediaTokenUsage(apiMediaTokenId);
          } catch (quotaErr: any) {
            this.logger.error(
              `[MediaGenerationJob] Trừ quota API Media thất bại jobId=${jobId}: ${quotaErr?.message}`
            );
          }
        }
      }
    } catch (err: any) {
      if (err instanceof MediaJobCancelledError) {
        this.logger.info(`MediaGenerationJob ${jobId} bị huỷ giữa chừng.`);
        return;
      }

      const message =
        err?.response?.data?.message || err?.message || "Lỗi không xác định khi tạo media";
      const statusCode = err?.statusCode || err?.status || 500;
      this.logger.error(`MediaGenerationJob ${jobId} thất bại: ${message}`, err);

      await emitter.fail(message, statusCode);
      // KHÔNG throw — đã capture vào job state. KHÔNG trừ usedQuantity.
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

/** Đánh thức queue thủ công (admin): restart consumer + khôi phục job treo/orphan. */
export async function wakeMediaGenerationQueue(): Promise<{
  consumerRestarted: boolean;
  orphanedRequeued: number;
  staleRequeued: number;
  staleFailed: number;
  queueRunning: boolean;
  queueActive: number;
  queueWaiting: number;
}> {
  const orphaned = await recoverOrphanedQueuedMediaJobs();
  const stale = await recoverStaleProcessingMediaJobs();
  const queueStatus = await getMediaGenerationQueueStatus();
  return {
    consumerRestarted: orphaned.consumerRestarted,
    orphanedRequeued: orphaned.requeued,
    staleRequeued: stale.requeued,
    staleFailed: stale.failed,
    queueRunning: queueStatus.running,
    queueActive: queueStatus.active,
    queueWaiting: queueStatus.waiting,
  };
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
        `[MediaGenerationQueue] Reset lock cho ${
          (resetResult as any).modifiedCount
        } job PROCESSING từ phiên trước`
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
    let skippedExpired = 0;
    for (const job of jobs) {
      const jobId = String((job as any)._id);
      try {
        if (!(await isMediaJobPayloadAvailable(job))) {
          const ok = await failUnrecoverableMediaJob(jobId, MEDIA_JOB_PAYLOAD_EXPIRED_MESSAGE, 410);
          if (ok) skippedExpired++;
          continue;
        }
        await enqueueMediaGenerationJob(jobId);
        if (MEDIA_JOB_RESUME_STAGGER_MS > 0) {
          await new Promise((resolve) => setTimeout(resolve, MEDIA_JOB_RESUME_STAGGER_MS));
        }
      } catch (err: any) {
        logger.error(`[MediaGenerationQueue] Resume jobId=${jobId} lỗi: ${err?.message}`);
      }
    }
    if (skippedExpired > 0) {
      logger.warn(
        `[MediaGenerationQueue] Bỏ qua ${skippedExpired} job(s) — payload Redis đã hết hạn`
      );
    }
    return jobs.length - skippedExpired;
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
/**
 * Khôi phục job Mongo QUEUED không được worker pickup (bee-queue consumer chết sau Redis blip).
 *
 * 1. `waiting > 0` && `active = 0` → restart bee-queue consumer (fix chính, không cần restart server).
 * 2. Mongo `QUEUED` + `startedAt` null + `updatedAt` cũ > 2 phút → re-enqueue (backup).
 */
export async function recoverOrphanedQueuedMediaJobs(): Promise<{
  consumerRestarted: boolean;
  requeued: number;
}> {
  let consumerRestarted = false;
  let requeued = 0;

  try {
    const status = await getMediaGenerationQueueStatus();

    if (!status.running) {
      mediaGenerationQueue.defaultQueue();
      consumerRestarted = true;
      logger.warn("[MediaGenerationQueue] Queue chưa chạy — đã khởi động consumer");
    } else if (status.waiting > 0 && status.active === 0) {
      mediaGenerationQueue.restartQueueConsumer();
      consumerRestarted = true;
      logger.warn(
        `[MediaGenerationQueue] Restart consumer: waiting=${status.waiting}, active=${status.active}`
      );
    }

    const staleCutoff = new Date(Date.now() - MEDIA_JOB_ORPHANED_QUEUED_MS);
    const jobs = (await mediaGenerationJobService.findAll({
      filter: {
        status: MediaGenerationJobStatus.QUEUED,
        startedAt: null,
        updatedAt: { $lt: staleCutoff },
      },
      limit: 200,
      order: { updatedAt: 1 },
    } as any)) as unknown as IMediaGenerationJob[];

    for (const job of jobs) {
      const jobId = String((job as any)._id);
      try {
        if (!(await isMediaJobPayloadAvailable(job))) {
          await failUnrecoverableMediaJob(jobId, MEDIA_JOB_PAYLOAD_EXPIRED_MESSAGE, 410);
          continue;
        }
        await mediaGenerationJobService.updateOne(jobId, {
          message: "Đang thử lại (tự động khôi phục hàng đợi)...",
        } as any);
        await enqueueMediaGenerationJob(jobId);
        requeued++;
        logger.warn(`[MediaGenerationQueue] Re-enqueue orphaned QUEUED jobId=${jobId}`);
      } catch (err: any) {
        logger.error(
          `[MediaGenerationQueue] Re-enqueue orphaned QUEUED jobId=${jobId} lỗi: ${err?.message}`
        );
      }
    }

    if (consumerRestarted || requeued > 0) {
      logger.info(
        `[MediaGenerationQueue] Orphaned QUEUED sweep: consumerRestarted=${consumerRestarted}, requeued=${requeued}`
      );
    }

    return { consumerRestarted, requeued };
  } catch (err: any) {
    logger.error(`[MediaGenerationQueue] recoverOrphanedQueuedMediaJobs lỗi: ${err?.message}`);
    return { consumerRestarted: false, requeued: 0 };
  }
}

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

      if (!(await isMediaJobPayloadAvailable(job))) {
        const ok = await failUnrecoverableMediaJob(jobId, MEDIA_JOB_PAYLOAD_EXPIRED_MESSAGE, 410);
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
        logger.error(`[MediaGenerationQueue] Re-enqueue stale jobId=${jobId} lỗi: ${err?.message}`);
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

/**
 * Khôi phục bee-job đang "active" mồ côi sau nodemon/server restart.
 *
 * Khi worker cũ chết, bee-queue vẫn giữ job ở Redis state "active" nhưng không ai
 * chạy handler → Mongo mãi QUEUED. `checkStalledJobs()` chỉ dùng `stallIntervalMs`
 * (20 phút) nên quá chậm — xóa active mồ côi ngay, rồi `resumeStaleMediaJobs()`
 * sẽ enqueue lại từ Mongo.
 */
export async function recoverStalledBeeJobsOnStartup(): Promise<number> {
  try {
    const q = mediaGenerationQueue.queue();
    const activeJobs = await q.getJobs("active", { start: 0, size: 500 });
    if (activeJobs.length === 0) return 0;

    let removed = 0;
    for (const beeJob of activeJobs) {
      try {
        const mongoJobId = (beeJob as any).data?.jobId;
        await beeJob.remove();
        removed++;
        logger.warn(
          `[MediaGenerationQueue] Xóa bee-job active mồ côi beeJobId=${beeJob.id} mongoJobId=${mongoJobId}`
        );
      } catch (err: any) {
        logger.error(`[MediaGenerationQueue] remove bee-job ${beeJob.id} lỗi: ${err?.message}`);
      }
    }
    if (removed > 0) {
      logger.warn(
        `[MediaGenerationQueue] Đã dọn ${removed} bee-job active mồ côi — sẽ re-enqueue từ Mongo`
      );
    }
    return removed;
  } catch (err: any) {
    logger.error(`[MediaGenerationQueue] recoverStalledBeeJobsOnStartup lỗi: ${err?.message}`);
    return 0;
  }
}

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
    `[MediaGenerationQueue] Terminal job cleanup sweep every ${
      MEDIA_JOB_CLEANUP_SWEEP_INTERVAL_MS / 60000
    } min`
  );
}

/** Quét job PROCESSING / QUEUED treo — idempotent, gọi 1 lần khi worker start. */
export function startStaleProcessingRecoverySweep(): void {
  if (mediaJobStaleRecoveryTimer) return;

  const run = () => {
    recoverStaleProcessingMediaJobs().catch((err) =>
      logger.error("[MediaGenerationQueue] stale PROCESSING sweep lỗi", err)
    );
    recoverOrphanedQueuedMediaJobs().catch((err) =>
      logger.error("[MediaGenerationQueue] orphaned QUEUED sweep lỗi", err)
    );
  };

  run();
  mediaJobStaleRecoveryTimer = setInterval(run, MEDIA_JOB_STALE_RECOVERY_SWEEP_INTERVAL_MS);
  if (typeof mediaJobStaleRecoveryTimer.unref === "function") {
    mediaJobStaleRecoveryTimer.unref();
  }
  logger.info(
    `[MediaGenerationQueue] Recovery sweep every ${
      MEDIA_JOB_STALE_RECOVERY_SWEEP_INTERVAL_MS / 1000
    }s (PROCESSING stale ${MEDIA_JOB_STALE_PROCESSING_MS / 1000}s, QUEUED orphan ${
      MEDIA_JOB_ORPHANED_QUEUED_MS / 1000
    }s)`
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
  const customerId = (job as any).customerId as string;
  const jobType = (job as any).type as MediaGenerationJobType;

  // Kiểm tra lại giới hạn luồng trước khi retry (AI text dùng quota request, không đếm stream)
  if (isApiMediaJobType(jobType)) {
    const apiMediaTokenId = (job as any).metadata?.apiMediaTokenId as string | undefined;
    if (apiMediaTokenId) {
      await assertApiMediaStreamAvailable(apiMediaTokenId);
    }
  } else if (!isAiTextJobType(jobType)) {
    await assertMediaStreamAvailable(customerId, jobType);
  }

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
