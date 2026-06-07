/**
 * Helper dùng chung cho mọi route POST tạo media: validate → tạo `MediaGenerationJob` doc → enqueue.
 *
 * Thiết kế:
 *   - Route gọi `createAndEnqueueMediaJob({ ... })` rồi trả `{ jobId, status }` cho client.
 *   - **Start nhanh:** trước khi enqueue, ghi Redis `mgj:watch:{jobId}` (markJobWatched) để worker
 *     không phải chờ client subscribe/touchWatch — tránh delay 5s×N do race POST → WS.
 *   - Client vẫn bắt buộc touchWatch định kỳ cho job dài (video): TTL Redis hết hạn nếu đóng tab.
 *   - Nếu enqueue Redis fail, doc Mongo *vẫn* tồn tại nhưng worker không pickup → caller sẽ
 *     biết qua exception và có thể trả 503 cho user.
 *   - `metadata` là dictionary tự do từ client (sceneId, clientRequestId, ...) — không dùng cho
 *     logic backend, chỉ phản hồi lại qua subscription/query để client map về UI.
 */
import logger from "../../../helpers/logger";
import {
  IMediaGenerationJob,
  mediaGenerationJobService,
  MediaGenerationJobStatus,
  MediaGenerationJobType,
} from "../../../libs/dal/mediaGenerationJob";
import { enqueueMediaGenerationJob } from "../../../queues/media-generation/media-generation.queue";
import {
  FAILED_JOB_RETENTION_MS,
  scheduleTerminalMediaJobDeletion,
} from "../../../queues/media-generation/job-emitter";
import { markJobWatched } from "../../../queues/media-generation/media-job-watch";

export type CreateAndEnqueueArgs = {
  customerId: string;
  type: MediaGenerationJobType;
  requestPayload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreateAndEnqueueResult = {
  jobId: string;
  status: MediaGenerationJobStatus;
};

export async function createAndEnqueueMediaJob(
  args: CreateAndEnqueueArgs
): Promise<CreateAndEnqueueResult> {
  // 1. Tạo doc Mongo ở trạng thái QUEUED
  const doc = (await mediaGenerationJobService.create({
    customerId: args.customerId,
    type: args.type,
    status: MediaGenerationJobStatus.QUEUED,
    progress: 0,
    message: "Đang chờ trong hàng đợi...",
    requestPayload: args.requestPayload,
    metadata: args.metadata || {},
    attempts: 0,
  } as Partial<IMediaGenerationJob>)) as unknown as IMediaGenerationJob;

  const jobId = String((doc as any)._id);

  try {
    // 2. Primed job watcher TRƯỚC enqueue — worker pickup lần đầu đã thấy key Redis.
    //    Best-effort: lỗi Redis vẫn enqueue; worker retry sau MEDIA_JOB_WATCH_RETRY_DELAY_MS (1.5s).
    //    TTL được gia hạn bởi client touchWatch — job dài không bị cắt sau 60s.
    await markJobWatched(jobId, args.customerId);

    // 3. Enqueue vào bee-queue (delay 0 — chạy ngay khi có worker slot)
    await enqueueMediaGenerationJob(jobId);
  } catch (err: any) {
    // 4. Nếu enqueue fail → đánh dấu FAILED ngay để FE không subscribe vô tận
    logger.error(`[createAndEnqueueMediaJob] enqueue ${jobId} lỗi: ${err?.message}`);
    const completedAt = new Date();
    await mediaGenerationJobService.updateOne(jobId, {
      status: MediaGenerationJobStatus.FAILED,
      errorMessage: "Không thể đưa job vào hàng đợi. Vui lòng thử lại sau.",
      errorCode: 503,
      completedAt,
    } as any);
    scheduleTerminalMediaJobDeletion(
      jobId,
      MediaGenerationJobStatus.FAILED,
      completedAt,
      FAILED_JOB_RETENTION_MS
    );
    const wrapped: any = new Error("Không thể đưa job vào hàng đợi. Vui lòng thử lại sau.");
    wrapped.statusCode = 503;
    throw wrapped;
  }

  return {
    jobId,
    status: MediaGenerationJobStatus.QUEUED,
  };
}
