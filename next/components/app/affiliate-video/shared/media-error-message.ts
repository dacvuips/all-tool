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

/** Lỗi UX/business — trả về message thân thiện, không gộp vào "hệ thống bận". */
const CONTENT_POLICY_PATTERN =
  /content\s*policy|violates the content|vi phạm chính sách nội dung/i;

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
