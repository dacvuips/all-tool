/**
 * Chuẩn hoá lỗi generate ảnh/video cho UI end-user.
 * Chỉ ẩn mã kỹ thuật (PUBLIC_ERROR_*, failed: task_timeout, Flow2/API provider…).
 * Các thông báo UX / business khác giữ nguyên.
 */

export const MEDIA_SYSTEM_BUSY_MESSAGE =
  "Hệ thống đang bận, vui lòng nhấp nút tạo lại";

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
  if (TECHNICAL_ERROR_PATTERNS.some((re) => re.test(trimmed))) {
    return MEDIA_SYSTEM_BUSY_MESSAGE;
  }
  return trimmed;
}
