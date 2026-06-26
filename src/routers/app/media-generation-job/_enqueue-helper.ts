/**
 * Helper dùng chung cho mọi route POST tạo media.
 *
 * Luồng mới:
 *   1. Kiểm tra giới hạn luồng (imageStreamCount / videoStreamCount theo customer).
 *   2. Sinh jobId → ghi payload lên Redis (TTL 1 giờ).
 *   3. Tạo doc Mongo (chỉ metadata + dataRedisKey, không lưu payload).
 *   4. Enqueue bee-queue → worker đọc Redis khi chạy.
 *   5. Trả `{ jobId, status }` cho client subscribe/poll.
 */
import mongoose from "mongoose";
import logger from "../../../helpers/logger";
import {
  IMediaGenerationJob,
  mediaGenerationJobService,
  MediaGenerationJobStatus,
  MediaGenerationJobType,
} from "../../../libs/dal/mediaGenerationJob";
import { assertMediaStreamAvailable } from "../../../queues/media-generation/media-job-concurrency";
import {
  buildMediaJobDataKey,
  saveMediaJobPayload,
} from "../../../queues/media-generation/media-job-data";
import { enqueueMediaGenerationJob } from "../../../queues/media-generation/media-generation.queue";
import {
  FAILED_JOB_RETENTION_MS,
  scheduleTerminalMediaJobDeletion,
} from "../../../queues/media-generation/job-emitter";

export type CreateAndEnqueueArgs = {
  customerId: string;
  type: MediaGenerationJobType;
  requestPayload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreateAndEnqueueOptions = {
  /** API Media tự kiểm tra luồng theo token trước khi gọi */
  skipStreamCheck?: boolean;
};

export type CreateAndEnqueueResult = {
  jobId: string;
  status: MediaGenerationJobStatus;
};

export async function createAndEnqueueMediaJob(
  args: CreateAndEnqueueArgs,
  options?: CreateAndEnqueueOptions
): Promise<CreateAndEnqueueResult> {
  // 1. Kiểm tra số job đang chạy/chờ so với giới hạn luồng của customer (luồng app)
  if (!options?.skipStreamCheck) {
    await assertMediaStreamAvailable(args.customerId, args.type);
  }

  // 2. Sinh jobId trước để dùng làm key Redis
  const jobId = new mongoose.Types.ObjectId().toString();
  const dataRedisKey = buildMediaJobDataKey(jobId);

  // 3. Ghi payload lên Redis (bắt buộc trước khi tạo job Mongo)
  await saveMediaJobPayload(jobId, args.requestPayload);

  // 4. Tạo doc Mongo — không lưu requestPayload
  const doc = (await mediaGenerationJobService.create({
    _id: jobId,
    customerId: args.customerId,
    type: args.type,
    status: MediaGenerationJobStatus.QUEUED,
    progress: 0,
    message: "Đang chờ trong hàng đợi...",
    dataRedisKey,
    metadata: args.metadata || {},
    attempts: 0,
  } as Partial<IMediaGenerationJob>)) as unknown as IMediaGenerationJob;

  const createdJobId = String((doc as any)._id);

  try {
    // 5. Enqueue vào bee-queue
    await enqueueMediaGenerationJob(createdJobId);
  } catch (err: any) {
    logger.error(`[createAndEnqueueMediaJob] enqueue ${createdJobId} lỗi: ${err?.message}`);
    const completedAt = new Date();
    await mediaGenerationJobService.updateOne(createdJobId, {
      status: MediaGenerationJobStatus.FAILED,
      errorMessage: "Không thể đưa job vào hàng đợi. Vui lòng thử lại sau.",
      errorCode: 503,
      completedAt,
    } as any);
    scheduleTerminalMediaJobDeletion(
      createdJobId,
      MediaGenerationJobStatus.FAILED,
      completedAt,
      FAILED_JOB_RETENTION_MS
    );
    const wrapped: any = new Error("Không thể đưa job vào hàng đợi. Vui lòng thử lại sau.");
    wrapped.statusCode = 503;
    throw wrapped;
  }

  return {
    jobId: createdJobId,
    status: MediaGenerationJobStatus.QUEUED,
  };
}
