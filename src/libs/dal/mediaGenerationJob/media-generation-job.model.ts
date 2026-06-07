import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import {
  IMediaGenerationJob,
  MediaGenerationJobStatus,
  MediaGenerationJobType,
} from "./media-generation-job.interface";

const Schema = mongoose.Schema;

/**
 * Schema cho bản ghi Job tạo media.
 *
 * Lưu ý thiết kế:
 * - `progress`, `attempts` luôn có default = 0 để không bị `undefined` ở client.
 * - `requestPayload` / `resultData` / `metadata` đều là `Mixed` để mềm dẻo theo từng `type`.
 * - Không lưu raw image base64 lớn trong `requestPayload` (đã upload lên Google trước khi enqueue).
 * - `customerId + status` index để query lịch sử/filter nhanh.
 */
const mediaGenerationJobSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: Object.values(MediaGenerationJobType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(MediaGenerationJobStatus),
      default: MediaGenerationJobStatus.QUEUED,
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    message: { type: String },
    /** Key Redis `mgj:data:{jobId}` — payload request không lưu Mongo */
    dataRedisKey: { type: String },
    /** Giữ cho job cũ; job mới không ghi field này */
    requestPayload: { type: Schema.Types.Mixed },
    resultData: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
    errorCode: { type: Number },
    cancelRequestedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    attempts: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    workerInstanceId: { type: String, default: null },
    lockExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** Query lịch sử của một user: theo createdAt desc */
mediaGenerationJobSchema.index({ customerId: 1, createdAt: -1 });
/** Filter theo trạng thái — phục vụ dashboard / cleanup */
mediaGenerationJobSchema.index({ customerId: 1, status: 1, createdAt: -1 });

export const MediaGenerationJobModel = MainConnection.model<IMediaGenerationJob>(
  "MediaGenerationJob",
  mediaGenerationJobSchema
);

export const MediaGenerationJobLoader = ModelLoader(MediaGenerationJobModel);
