import { TimestampEntity } from "../../core";

/**
 * Trạng thái vòng đời của một Job tạo media (ảnh/video).
 *
 * State machine (chỉ cho phép tiến lên — không hỗ trợ rollback):
 *
 *   [create]
 *      ↓
 *   QUEUED ──(worker pickup)──→ PROCESSING ──(success)──→ SUCCEEDED → (xóa Mongo ngay)
 *      │                              │
 *      │                              └──(throw)──→ FAILED
 *      └──(user cancel hoặc worker phát hiện cancel)──→ CANCELLED
 *
 * Các trạng thái SUCCEEDED / FAILED / CANCELLED là *terminal* — không emit thêm progress.
 * Job SUCCEEDED được publish pubsub rồi xóa document ngay (không lưu lâu trong DB).
 */
export enum MediaGenerationJobStatus {
  /** Đã enqueue vào bee-queue, chờ worker pick up */
  QUEUED = "QUEUED",
  /** Worker đang xử lý (đã trừ slot concurrency) */
  PROCESSING = "PROCESSING",
  /** Hoàn thành thành công, có `resultData` */
  SUCCEEDED = "SUCCEEDED",
  /** Lỗi không thể tiếp tục — xem `errorMessage` / `errorCode` */
  FAILED = "FAILED",
  /** Bị huỷ (user gọi cancel mutation hoặc worker thấy yêu cầu huỷ) */
  CANCELLED = "CANCELLED",
}

/**
 * Phân loại job — quyết định handler nào trong worker sẽ xử lý.
 * Mỗi giá trị tương ứng với 1 route POST cũ (giữ path để không phá client cũ).
 */
export enum MediaGenerationJobType {
  /** POST /api/app/generation-image/ — affiliate scene generate image */
  GENERATION_IMAGE = "GENERATION_IMAGE",
  /** POST /api/app/generation-element-image/ — element editor generate image */
  GENERATION_ELEMENT_IMAGE = "GENERATION_ELEMENT_IMAGE",
  /** POST /api/app/copy-video-generate-image/ — copy-video module generate image */
  COPY_VIDEO_GENERATE_IMAGE = "COPY_VIDEO_GENERATE_IMAGE",
  /** POST /api/app/generation-video/ — affiliate scene generate video */
  GENERATION_VIDEO = "GENERATION_VIDEO",
  /** POST /api/app/generation-element-video/ — element editor generate video */
  GENERATION_ELEMENT_VIDEO = "GENERATION_ELEMENT_VIDEO",
  /** POST /api/app/generation-element-video-to-video/ — element editor video-to-video */
  GENERATION_ELEMENT_VIDEO_TO_VIDEO = "GENERATION_ELEMENT_VIDEO_TO_VIDEO",
  /** POST /api/app/generation-review-image/ — review product generate image */
  GENERATION_REVIEW_IMAGE = "GENERATION_REVIEW_IMAGE",
  /** POST /api/app/generation-review-video/ — review product generate video */
  GENERATION_REVIEW_VIDEO = "GENERATION_REVIEW_VIDEO",
}

/** Output cuối khi job tạo ảnh thành công (1 hoặc nhiều ảnh base64/url) */
export type MediaGenerationImageResult = {
  /** Mảng item ảnh — tương thích cấu trúc cũ (data) */
  images: Array<{
    imageBytes?: string;
    mimeType?: string;
    fifeUrl?: string;
    imageUrl?: string;
  }>;
};

/** Output cuối khi job tạo video thành công (videoUri hoặc bytes) */
export type MediaGenerationVideoResult = {
  videoUri?: string | null;
  videoBytes?: string | null;
  mimeType: string;
  aspectRatio?: string;
};

/** Output chung — union, cho phép resultData mềm dẻo */
export type MediaGenerationResult = MediaGenerationImageResult | MediaGenerationVideoResult;

/**
 * Bản ghi MongoDB cho một Job tạo media.
 *
 * Mọi field tuỳ chọn (?) đều có giá trị mặc định an toàn ở model schema.
 * `requestPayload` là Mixed — chứa toàn bộ input để worker chạy lại; KHÔNG lưu raw image
 * base64 nếu kích thước lớn để tránh phình Mongo (đã upload sang Google trước khi xếp hàng).
 */
export type IMediaGenerationJob = TimestampEntity & {
  /** ID người tạo (customer hoặc shop/staff) — *bắt buộc*, dùng để filter subscription */
  customerId: string;
  /** Loại job — quyết định handler */
  type: MediaGenerationJobType;
  /** Trạng thái hiện tại */
  status: MediaGenerationJobStatus;
  /** Phần trăm tiến độ 0–100 (xấp xỉ; có thể nhảy không tuyến tính) */
  progress: number;
  /** Thông điệp tiến độ hiện tại (tiếng Việt, đã dịch nếu có) */
  message?: string;
  /** Input payload — worker dùng để chạy lại; có thể chứa prompt, urls, base64 nhỏ */
  requestPayload?: Record<string, unknown>;
  /** Kết quả cuối khi `status = SUCCEEDED` */
  resultData?: Record<string, unknown>;
  /** Thông báo lỗi khi `status = FAILED` (tiếng Việt nếu có) */
  errorMessage?: string;
  /** HTTP-like status code lỗi (để client xử lý hint UI) */
  errorCode?: number;
  /** Thời điểm user yêu cầu huỷ (worker đọc để dừng emit) */
  cancelRequestedAt?: Date;
  /** Metadata tự do từ client (ví dụ sceneId, clientRequestId) — *KHÔNG dùng cho logic backend* */
  metadata?: Record<string, unknown>;
  /** Số lần worker pickup (theo dõi stall / retry) */
  attempts: number;
  /** Thời điểm worker bắt đầu xử lý */
  startedAt?: Date;
  /** Thời điểm chuyển sang terminal state (SUCCEEDED/FAILED/CANCELLED) */
  completedAt?: Date;
  /**
   * ID instance worker đang giữ job (process-level UUID).
   * - Chỉ worker có `workerInstanceId === current` được phép cập nhật progress.
   * - Khi nodemon restart, instance ID mới khác → worker cũ tự "mất quyền"; worker mới phải
   *   chờ `lockExpiresAt` hết hạn rồi mới giành lock được.
   */
  workerInstanceId?: string | null;
  /**
   * Thời điểm lock hết hạn (worker phải gia hạn mỗi lần emit progress).
   * Nếu `lockExpiresAt < now` thì worker khác được phép giành lock.
   */
  lockExpiresAt?: Date | null;
};

/** Các trạng thái terminal — không cho phép cập nhật tiếp */
export const MEDIA_JOB_TERMINAL_STATUSES: ReadonlyArray<MediaGenerationJobStatus> = [
  MediaGenerationJobStatus.SUCCEEDED,
  MediaGenerationJobStatus.FAILED,
  MediaGenerationJobStatus.CANCELLED,
];

/** Helper: kiểm tra job đã ở trạng thái terminal */
export function isMediaJobTerminal(status: MediaGenerationJobStatus): boolean {
  return MEDIA_JOB_TERMINAL_STATUSES.includes(status);
}
