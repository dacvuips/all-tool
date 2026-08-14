/**
 * Chuẩn hoá lỗi generate ảnh/video cho UI end-user.
 * Chỉ ẩn mã kỹ thuật (PUBLIC_ERROR_*, failed: task_timeout, Flow2/API provider…).
 * Các thông báo UX / business khác giữ nguyên (vd. content policy).
 */

export const MEDIA_SYSTEM_BUSY_MESSAGE =
  "Hệ thống đang bận, vui lòng nhấp nút tạo lại";

/** Google/policy — user cần đổi prompt/ảnh, không phải retry kỹ thuật. */
export const MEDIA_CONTENT_POLICY_MESSAGE =
  "Google từ chối tạo vì vi phạm chính sách nội dung. Vui lòng thay nội dung hoặc ảnh.";

/** Upscale 1080p / 2K / 4K khi Flow2 hết hạn request gốc (request_not_found / 404). */
export const UPSAMPLE_SOURCE_EXPIRED_MESSAGE =
  "File không tồn tại hoặc đã quá hạn, generate lại file khác rồi tải lại hoặc tải chất lượng mặc định";

export function isUpsampleSourceNotFoundError(
  message: string | null | undefined,
  status?: number
): boolean {
  if (status === 404) return true;
  const text = String(message || "");
  if (!text.trim()) return false;
  return /request[_\s-]?not[_\s-]?found/i.test(text) || /\b404\b/.test(text);
}

export function toUpsampleUserErrorMessage(
  message: string | null | undefined,
  status?: number,
  fallback = "Lỗi upscale"
): string {
  if (isUpsampleSourceNotFoundError(message, status)) {
    return UPSAMPLE_SOURCE_EXPIRED_MESSAGE;
  }
  const trimmed = String(message || "").trim();
  return trimmed || fallback;
}

/** Lỗi UX/business — trả về message thân thiện, không gộp vào "hệ thống bận". */
const CONTENT_POLICY_PATTERN =
  /content\s*policy|violates the content|vi phạm chính sách nội dung/i;

/**
 * Message user có thể xử lý (đổi prompt/ảnh) — luôn hiện nguyên lỗi, kể cả khi
 * prefix là "Flow2 xử lý thất bại: …".
 */
export const USER_FACING_ERROR_PATTERNS = [
  /content\s*policy/i,
  /violates\s+(the\s+)?content\s*policy/i,
  /refused\s+to\s+create/i,
  /replace\s+the\s+content/i,
  /safety\s*(filter|policy|system)?/i,
  /không\s+phù\s+hợp/i,
  /vi\s*phạm\s*(chính\s*sách|nội\s*dung)/i,
];

/** Lỗi Google/Flow2 content policy — gợi ý nút rewrite prompt */
export function isMediaContentPolicyError(
  message: string | null | undefined
): boolean {
  if (message == null) return false;
  const trimmed = message.trim();
  if (!trimmed) return false;
  return /violates\s+(the\s+)?content\s*policy/i.test(trimmed);
}

/** Lỗi kỹ thuật từ provider/queue — thay bằng thông báo chung. */
const TECHNICAL_ERROR_PATTERNS = [
  /PUBLIC_ERROR_/i,
  /failed:\s*/i,
  /task_timeout/i,
  /Google Labs API error/i,
  /Aisandbox API error/i,
  /Flow2\b.*\b(error|thất bại|enqueue)/i,
  /MEDIA_GENERATION_STATUS_/i,
];

export function toUserFriendlyMediaErrorMessage(
  message: string | null | undefined
): string | null {
  if (message == null) return null;
  const trimmed = message.trim();
  if (!trimmed) return trimmed;

  // Content policy: giữ UX rõ ràng (prefix Flow2 cũng khớp TECHNICAL nhưng không phải "bận").
  if (CONTENT_POLICY_PATTERN.test(trimmed)) {
    return MEDIA_CONTENT_POLICY_MESSAGE;
  }

  if (TECHNICAL_ERROR_PATTERNS.some((re) => re.test(trimmed))) {
    return MEDIA_SYSTEM_BUSY_MESSAGE;
  }
  return trimmed;
}
