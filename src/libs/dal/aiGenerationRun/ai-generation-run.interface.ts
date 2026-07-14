import { TimestampEntity } from "../../core";
import { AiProviderKeyEnum, ApiOutputTypeEnum } from "../product";

/** Trạng thái một lần chạy AI generation */
export enum AiGenerationRunStatusEnum {
  /** Đang chờ trong queue */
  PENDING = "PENDING",
  /** Worker đang xử lý */
  PROCESSING = "PROCESSING",
  /** Hoàn thành, đã có resultRefs */
  COMPLETED = "COMPLETED",
  /** Lỗi khi gọi API hoặc upload */
  FAILED = "FAILED",
  /** Bị hủy (nếu hỗ trợ sau) */
  CANCELLED = "CANCELLED",
}

/** Một output (ảnh/video/file) trong kết quả – tham chiếu tới Attachment hoặc URL */
export type GenerationOutputRef = {
  /** Loại: image | video | file | audio */
  type: "image" | "video" | "file" | "audio";
  /** Id bản ghi Attachment (nếu đã lưu MinIO qua attachment) */
  attachmentId?: string;
  /** URL public hoặc presigned (nếu không dùng Attachment) */
  url?: string;
  /** MIME type */
  mimeType?: string;
  /** Kích thước bytes */
  size?: number;
  /** Thứ tự hiển thị (1, 2, 3...) */
  order?: number;
  /** request_id Flow2 — upsample ảnh 2K/4K hoặc video 1080p */
  flow2RequestId?: string;
};

/** Metadata response từ API (token usage, model, ...) – không lưu blob */
export type ResponseSummary = {
  /** Số ảnh/video trả về */
  outputCount?: number;
  /** Token usage (nếu provider trả về) */
  usageMetadata?: Record<string, unknown>;
  /** Tên model đã dùng */
  model?: string;
};
export enum AiGenerationRunTypeEnum {
  TEXT_TO_VIDEO = "TEXT_TO_VIDEO",
  IMAGE_TO_VIDEO = "IMAGE_TO_VIDEO",
  TEXT_TO_IMAGE = "TEXT_TO_IMAGE",
  IMAGE_TO_IMAGE = "IMAGE_TO_IMAGE",
  TEXT_TO_AUDIO = "TEXT_TO_AUDIO",
  START_END_TO_VIDEO = "START_END_TO_VIDEO",
  FACE_SYNC = "FACE_SYNC",
}

/** Bản ghi mỗi lần chạy node AI: lưu trạng thái, tham chiếu kết quả, lịch sử */
export type IAiGenerationRun = TimestampEntity & {
  /** Người dùng (customer) */
  customerId: string;
  prompt: string;
  voicePrompt: string;
  /** Provider: OPENAI_KEY, GOOGLE_GEMINI_KEY, ... */
  provider: AiProviderKeyEnum;
  type: AiGenerationRunTypeEnum;
  /** Loại output: IMAGE, VIDEO, FILE, AUDIO */
  outputType: ApiOutputTypeEnum;
  /** Trạng thái run */
  status: AiGenerationRunStatusEnum;
  /** Snapshot input (fieldValues, context) để debug / chạy lại */
  requestSnapshot?: Record<string, unknown>;
  /** Metadata response (không lưu blob) */
  responseSummary?: ResponseSummary;
  /** Danh sách tham chiếu tới ảnh/video/file đã lưu (Attachment hoặc URL) */
  resultRefs?: GenerationOutputRef[];
  /** Thông báo lỗi khi status = FAILED */
  errorMessage?: string;
  /** Thời điểm bắt đầu xử lý (worker bắt đầu) */
  startedAt?: Date;
  /** Thời điểm xong hoặc lỗi */
  completedAt?: Date;
  /** Số credit áp dụng cho run (copy từ node config lúc tạo run) */
  creditCost?: number;
  /** Thời điểm đã trừ credit (null nếu chưa trừ) */
  creditChargedAt?: Date;
  /** Thời điểm đã hoàn credit khi run FAILED (null nếu chưa hoàn) */
  creditRefundedAt?: Date;
  /** Các field config */
  metadata?: any;
};
