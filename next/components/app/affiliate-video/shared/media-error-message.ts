/**
 * Chuẩn hoá lỗi generate ảnh/video cho UI end-user.
 * Ẩn mã kỹ thuật (failed: task_timeout_20m, Flow2, PUBLIC_ERROR, …).
 */

export const MEDIA_SYSTEM_BUSY_MESSAGE =
  "Hệ thống đang bận, vui lòng nhấp nút tạo lại";

/** Giữ nguyên thông báo UX có chủ đích (dừng, giới hạn concurrency, lưu local, content policy…). */
const KEEP_ORIGINAL_PATTERNS = [
  /^đã dừng/i,
  /^đã huỷ/i,
  /^đã hủy/i,
  /cùng lúc/i,
  /không thể lưu/i,
  /content policy/i,
];

export function toUserFriendlyMediaErrorMessage(
  message: string | null | undefined
): string | null {
  if (message == null) return null;
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  if (KEEP_ORIGINAL_PATTERNS.some((re) => re.test(trimmed))) return trimmed;
  if (trimmed.includes("Hệ thống đang bận")) return trimmed;
  return MEDIA_SYSTEM_BUSY_MESSAGE;
}
