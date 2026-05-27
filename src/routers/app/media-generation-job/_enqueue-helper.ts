/**
 * Helper dùng chung cho mọi route POST tạo media: validate → tạo `MediaGenerationJob` doc → enqueue.
 *
 * Thiết kế:
 *   - Route gọi `createAndEnqueueMediaJob({ ... })` rồi trả `{ jobId, status }` cho client.
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
    // 2. Enqueue vào bee-queue
    await enqueueMediaGenerationJob(jobId);
  } catch (err: any) {
    // 3. Nếu enqueue fail → đánh dấu FAILED ngay để FE không subscribe vô tận
    logger.error(`[createAndEnqueueMediaJob] enqueue ${jobId} lỗi: ${err?.message}`);
    await mediaGenerationJobService.updateOne(jobId, {
      status: MediaGenerationJobStatus.FAILED,
      errorMessage: "Không thể đưa job vào hàng đợi. Vui lòng thử lại sau.",
      errorCode: 503,
      completedAt: new Date(),
    } as any);
    const wrapped: any = new Error("Không thể đưa job vào hàng đợi. Vui lòng thử lại sau.");
    wrapped.statusCode = 503;
    throw wrapped;
  }

  return {
    jobId,
    status: MediaGenerationJobStatus.QUEUED,
  };
}
