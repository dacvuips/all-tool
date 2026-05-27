/**
 * Emitter dùng chung cho mọi handler tạo media: cập nhật Mongo + publish pubsub.
 *
 * Mục tiêu thiết kế:
 *   - **Atomic + Idempotent**: dùng `findOneAndUpdate` với filter status/lock để chống race.
 *   - **Worker lock**: mỗi process có 1 `WORKER_INSTANCE_ID` (UUID). Job được "khoá" vào
 *     worker này; worker khác (vd sau nodemon restart) phải chờ lock hết hạn mới giành được.
 *   - **Cancel-aware**: handler chỉ cần `await emitter.progress(...)`; nếu user đã cancel,
 *     hàm sẽ throw `MediaJobCancelledError` để worker break sớm.
 *   - **Heartbeat**: mỗi lần emit progress đều gia hạn `lockExpiresAt` để worker khác biết
 *     đây vẫn còn sống.
 */
import { CONSTANTS } from "../../constants/constant.const";
import logger from "../../helpers/logger";
import {
  IMediaGenerationJob,
  isMediaJobTerminal,
  MEDIA_JOB_TERMINAL_STATUSES,
  mediaGenerationJobService,
  MediaGenerationJobStatus,
} from "../../libs/dal/mediaGenerationJob";
import { pubsub } from "../../libs/graphql/pub-sub";
import { MediaJobCancelledError } from "./job-errors";
import { clearJobWatch, isJobWatched } from "./media-job-watch";

/**
 * UUID duy nhất cho mỗi process Node. Nodemon restart → ID mới.
 * Worker dùng để claim lock trên job; chỉ worker có cùng `workerInstanceId` được cập nhật tiếp.
 */
const WORKER_INSTANCE_ID = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Thời lượng lock (ms). Worker sống phải gia hạn lock mỗi `HEARTBEAT_MS`; nếu chết,
 * worker khác chờ tối đa `LOCK_TTL_MS` rồi giành lại.
 *
 * Trade-off: TTL ngắn → recovery nhanh khi crash, nhưng nguy cơ 2 worker chạy song song
 * nếu heartbeat trễ. TTL dài → an toàn race nhưng job kẹt lâu khi server chết.
 */
const LOCK_TTL_MS = 60 * 1000; // 60 giây
/** Tần suất heartbeat tự động (gia hạn lock dù handler không gọi progress) */
const HEARTBEAT_MS = 15 * 1000; // 15 giây

/** Payload phát qua pubsub — gửi xuống GraphQL Subscription resolver */
export type MediaGenerationJobPubsubPayload = {
  jobId: string;
  customerId: string;
  type: string;
  status: MediaGenerationJobStatus;
  progress: number;
  message?: string;
  resultData?: Record<string, unknown> | null;
  errorMessage?: string | null;
  errorCode?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

/** Snapshot rút gọn để publish — luôn lấy từ document mới nhất sau update */
function toPayload(doc: IMediaGenerationJob): MediaGenerationJobPubsubPayload {
  const json: any = (doc as any).toObject ? (doc as any).toObject() : doc;
  return {
    jobId: String(json._id),
    customerId: json.customerId,
    type: json.type,
    status: json.status,
    progress: typeof json.progress === "number" ? json.progress : 0,
    message: json.message ?? undefined,
    resultData: json.resultData ?? null,
    errorMessage: json.errorMessage ?? null,
    errorCode: json.errorCode ?? null,
    metadata: json.metadata ?? null,
    createdAt: json.createdAt,
    startedAt: json.startedAt ?? null,
    completedAt: json.completedAt ?? null,
  };
}

/** Publish 1 payload qua pubsub (kênh chung MEDIA_GENERATION_JOB; filter ở resolver) */
async function publishChange(doc: IMediaGenerationJob): Promise<void> {
  try {
    const payload = toPayload(doc);
    await pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.MEDIA_GENERATION_JOB, payload);
  } catch (err: any) {
    logger.error(`[MediaJobEmitter] publish lỗi: ${err?.message}`);
  }
}

/** Hàm tiện ích: tính thời điểm hết hạn lock kế tiếp */
function nextLockExpiresAt(): Date {
  return new Date(Date.now() + LOCK_TTL_MS);
}

/**
 * Emitter cho 1 job — đã claim worker lock.
 *
 * Vòng đời:
 *   const emitter = await MediaJobEmitter.tryClaim(job);
 *   if (!emitter) return; // worker khác đang xử lý
 *   await emitter.progress(15, "...");
 *   ...
 *   await emitter.succeed({ images: [...] });
 *   // hoặc: await emitter.fail(err.message, err.statusCode);
 */
export class MediaJobEmitter {
  private terminated = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private constructor(public readonly jobId: string, public readonly customerId: string) {}

  /** Bật heartbeat refresh lock định kỳ; tự dừng khi terminated. */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(async () => {
      if (this.terminated) {
        this.stopHeartbeat();
        return;
      }
      try {
        const model = mediaGenerationJobService.model;
        const doc = await model.findOneAndUpdate(
          {
            _id: this.jobId,
            workerInstanceId: WORKER_INSTANCE_ID,
            status: { $nin: MEDIA_JOB_TERMINAL_STATUSES },
          },
          { $set: { lockExpiresAt: nextLockExpiresAt() } },
          { new: true }
        );
        if (!doc) {
          // Mất lock hoặc đã terminal — dừng heartbeat (handler sẽ phát hiện ở progress kế tiếp)
          this.stopHeartbeat();
        }
      } catch (err: any) {
        logger.warn(`[MediaJobEmitter] heartbeat jobId=${this.jobId} lỗi: ${err?.message}`);
      }
    }, HEARTBEAT_MS);
    // Cho phép process exit ngay cả khi timer còn (Node.js feature)
    if (typeof this.heartbeatTimer.unref === "function") {
      this.heartbeatTimer.unref();
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Thử *giành lock* cho 1 job:
   *   - Cho phép nếu: status=QUEUED, hoặc lock đã hết hạn, hoặc đã thuộc về worker này.
   *   - Set: status=PROCESSING + workerInstanceId=self + lockExpiresAt=now+TTL + attempts++.
   *
   * @returns emitter nếu claim thành công; `null` nếu worker khác đang giữ.
   */
  static async tryClaim(job: IMediaGenerationJob): Promise<MediaJobEmitter | null> {
    const id = String((job as any)._id);
    const model = mediaGenerationJobService.model;
    const now = new Date();

    const doc = await model.findOneAndUpdate(
      {
        _id: id,
        status: { $nin: MEDIA_JOB_TERMINAL_STATUSES },
        // Chỉ claim được khi:
        //   - Job còn QUEUED (chưa từng pickup), HOẶC
        //   - Lock đã hết hạn (worker cũ chết / nodemon restart), HOẶC
        //   - Chưa có lock (lockExpiresAt = null).
        // KHÔNG cho phép cùng worker re-claim job đang chạy (chặn duplicate pickup do bee-queue).
        $or: [
          { status: MediaGenerationJobStatus.QUEUED },
          { lockExpiresAt: { $lt: now } },
          { lockExpiresAt: null },
        ],
      },
      {
        $set: {
          status: MediaGenerationJobStatus.PROCESSING,
          workerInstanceId: WORKER_INSTANCE_ID,
          lockExpiresAt: nextLockExpiresAt(),
          startedAt: (job as any).startedAt || now,
          message: (job as any).message || "Đang khởi tạo...",
          progress: Math.max(1, (job as any).progress || 0),
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    );

    if (!doc) {
      // Đã terminal hoặc worker khác đang giữ lock chưa hết hạn
      const current = (await mediaGenerationJobService.findOne({ _id: id })) as any;
      const owner = current?.workerInstanceId;
      logger.warn(
        `[MediaJobEmitter] không claim được jobId=${id} (owner=${owner}, status=${current?.status}, lockExpiresAt=${current?.lockExpiresAt})`
      );
      return null;
    }

    logger.info(
      `[MediaJobEmitter] claim OK jobId=${id} workerId=${WORKER_INSTANCE_ID} attempts=${(doc as any).attempts}`
    );
    await publishChange(doc as unknown as IMediaGenerationJob);
    const emitter = new MediaJobEmitter(id, (doc as any).customerId);
    emitter.startHeartbeat();
    return emitter;
  }

  /**
   * Cập nhật tiến độ + gia hạn lock.
   *
   * Nếu worker khác đã giành lock (hoặc job CANCELLED), hàm sẽ:
   *   - Throw `MediaJobCancelledError` nếu CANCELLED.
   *   - Đánh dấu `terminated = true` và return im lặng nếu mất lock (worker khác đang chạy).
   */
  async progress(progress: number, message?: string): Promise<void> {
    if (this.terminated) return;

    // Client không còn subscribe / heartbeat → dừng sớm, tránh tốn quota API
    if (!(await isJobWatched(this.jobId))) {
      this.terminated = true;
      this.stopHeartbeat();
      await abandonMediaJobNoWatcher(this.jobId, this.customerId);
      throw new MediaJobCancelledError(this.jobId);
    }

    const clamped = Math.max(0, Math.min(99, Math.round(progress)));
    const model = mediaGenerationJobService.model;

    const doc = await model.findOneAndUpdate(
      {
        _id: this.jobId,
        workerInstanceId: WORKER_INSTANCE_ID,
        status: { $nin: MEDIA_JOB_TERMINAL_STATUSES },
      },
      {
        $set: {
          progress: clamped,
          lockExpiresAt: nextLockExpiresAt(),
          ...(message ? { message } : {}),
        },
      },
      { new: true }
    );

    if (doc) {
      await publishChange(doc as unknown as IMediaGenerationJob);
      return;
    }

    // Update fail → có thể CANCELLED hoặc mất lock
    const current = (await mediaGenerationJobService.findOne({ _id: this.jobId })) as any;
    if (!current) {
      this.terminated = true;
      return;
    }
    if (current.status === MediaGenerationJobStatus.CANCELLED) {
      this.terminated = true;
      throw new MediaJobCancelledError(this.jobId);
    }
    if (isMediaJobTerminal(current.status)) {
      this.terminated = true;
      return;
    }
    if (current.workerInstanceId !== WORKER_INSTANCE_ID) {
      logger.warn(
        `[MediaJobEmitter] jobId=${this.jobId} đã bị takeover bởi worker ${current.workerInstanceId} (self=${WORKER_INSTANCE_ID}), ngừng emit`
      );
      this.terminated = true;
      this.stopHeartbeat();
      return;
    }
  }

  /**
   * Đánh dấu thành công + lưu resultData. Chỉ ghi khi *vẫn* giữ lock.
   *
   * Sau khi publish pubsub (client nhận SUCCEEDED + resultData), **xóa ngay** document Mongo
   * để không tích tụ dữ liệu (ảnh/video base64 trong resultData rất nặng).
   * Client phải lấy kết quả từ subscription; poll/query sau xóa sẽ trả null.
   */
  async succeed(resultData: Record<string, unknown>, finalMessage = "Hoàn tất!"): Promise<void> {
    if (this.terminated) return;
    const model = mediaGenerationJobService.model;
    const doc = await model.findOneAndUpdate(
      {
        _id: this.jobId,
        workerInstanceId: WORKER_INSTANCE_ID,
        status: { $nin: MEDIA_JOB_TERMINAL_STATUSES },
      },
      {
        $set: {
          status: MediaGenerationJobStatus.SUCCEEDED,
          progress: 100,
          message: finalMessage,
          resultData,
          completedAt: new Date(),
          errorMessage: null,
          errorCode: null,
          workerInstanceId: null,
          lockExpiresAt: null,
        },
      },
      { new: true }
    );
    this.terminated = true;
    this.stopHeartbeat();
    if (doc) {
      logger.info(`[MediaJobEmitter] SUCCEED jobId=${this.jobId}`);
      // Bắt buộc publish trước khi xóa — subscription là nguồn kết quả chính cho FE.
      await publishChange(doc as unknown as IMediaGenerationJob);
      await clearJobWatch(this.jobId);
      try {
        const deleted = await model.deleteOne({ _id: this.jobId });
        if (deleted.deletedCount) {
          logger.info(`[MediaJobEmitter] DELETED jobId=${this.jobId} sau SUCCEEDED`);
        }
      } catch (err: any) {
        logger.warn(
          `[MediaJobEmitter] xóa job SUCCEEDED thất bại jobId=${this.jobId}: ${err?.message}`
        );
      }
    } else {
      logger.warn(`[MediaJobEmitter] succeed jobId=${this.jobId} nhưng không còn giữ lock`);
    }
  }

  /** Đánh dấu thất bại. Chỉ ghi khi *vẫn* giữ lock. */
  async fail(errorMessage: string, errorCode?: number): Promise<void> {
    if (this.terminated) return;
    const model = mediaGenerationJobService.model;
    const doc = await model.findOneAndUpdate(
      {
        _id: this.jobId,
        workerInstanceId: WORKER_INSTANCE_ID,
        status: { $nin: MEDIA_JOB_TERMINAL_STATUSES },
      },
      {
        $set: {
          status: MediaGenerationJobStatus.FAILED,
          message: errorMessage,
          errorMessage,
          errorCode: errorCode ?? 500,
          completedAt: new Date(),
          workerInstanceId: null,
          lockExpiresAt: null,
        },
      },
      { new: true }
    );
    this.terminated = true;
    this.stopHeartbeat();
    if (doc) {
      logger.info(`[MediaJobEmitter] FAIL jobId=${this.jobId} ${errorMessage}`);
      await publishChange(doc as unknown as IMediaGenerationJob);
    }
  }
}

/**
 * Đánh dấu một job là CANCELLED.
 * Hoạt động bất kể job đang ở worker nào — vì status terminal là điểm dừng cho mọi emitter.
 */
export async function markMediaJobCancelled(
  jobId: string,
  customerId: string
): Promise<boolean> {
  const model = mediaGenerationJobService.model;
  const doc = await model.findOneAndUpdate(
    {
      _id: jobId,
      customerId,
      status: { $nin: MEDIA_JOB_TERMINAL_STATUSES },
    },
    {
      $set: {
        status: MediaGenerationJobStatus.CANCELLED,
        cancelRequestedAt: new Date(),
        completedAt: new Date(),
        message: "Đã huỷ theo yêu cầu",
        workerInstanceId: null,
        lockExpiresAt: null,
      },
    },
    { new: true }
  );
  if (!doc) return false;
  await publishChange(doc as unknown as IMediaGenerationJob);
  await clearJobWatch(jobId);
  return true;
}

/**
 * Huỷ job vì không còn client watch (đóng tab / mất kết nối).
 * Publish CANCELLED để FE còn kết nối nhận được, rồi xóa Mongo.
 */
export async function abandonMediaJobNoWatcher(
  jobId: string,
  customerId: string
): Promise<boolean> {
  const model = mediaGenerationJobService.model;
  const doc = await model.findOneAndUpdate(
    {
      _id: jobId,
      customerId,
      status: { $nin: MEDIA_JOB_TERMINAL_STATUSES },
    },
    {
      $set: {
        status: MediaGenerationJobStatus.CANCELLED,
        completedAt: new Date(),
        message: "Client không còn theo dõi job",
        workerInstanceId: null,
        lockExpiresAt: null,
      },
    },
    { new: true }
  );
  if (!doc) {
    await clearJobWatch(jobId);
    return false;
  }
  logger.info(`[MediaJobEmitter] ABANDON (no watcher) jobId=${jobId}`);
  await publishChange(doc as unknown as IMediaGenerationJob);
  await clearJobWatch(jobId);
  try {
    await model.deleteOne({ _id: jobId });
  } catch (err: any) {
    logger.warn(`[MediaJobEmitter] xóa job abandon jobId=${jobId}: ${err?.message}`);
  }
  return true;
}
