import { TimestampEntity } from "../../core";

/** Loại output: ảnh, video, file, audio */
export type CustomerMediaType = "image" | "video" | "file" | "audio";

/**
 * Bản ghi lưu từng output (ảnh/video) của customer từ AI generation.
 * Dùng để query nhanh "tất cả media của customer" mà không cần scan AiGenerationRun.
 */
export type ICustomerGenerationMedia = TimestampEntity & {
  /** Customer (người dùng) */
  customerId: string;
  /** Product chứa flow */
  productId: string;
  /** Id node trong flow */
  nodeId: string;
  /** Id run (AiGenerationRun) tạo ra output này */
  runId: string;
  /** Loại: image | video | file | audio */
  type: CustomerMediaType;
  /** Id bản ghi Attachment (nếu đã lưu MinIO) */
  attachmentId?: string;
  /** URL public hoặc presigned */
  url?: string;
  /** MIME type */
  mimeType?: string;
  /** Kích thước bytes */
  size?: number;
  /** Thứ tự trong run (1, 2, 3...) */
  order?: number;
  /** request_id Flow2 — dùng upsample 2K/4K (ảnh) hoặc 1080p (video) */
  flow2RequestId?: string;
};
