/**
 * Các custom error dùng trong vòng đời của Media Generation Job.
 *
 * Tách riêng vì:
 * - Worker cần `instanceof` để phân biệt "user huỷ" với "lỗi server".
 * - Không log stacktrace của `MediaJobCancelledError` như lỗi hệ thống.
 */

/** Job đã bị user (hoặc admin) yêu cầu huỷ — không phải lỗi server */
export class MediaJobCancelledError extends Error {
  constructor(public readonly jobId: string) {
    super(`Media generation job ${jobId} đã bị huỷ.`);
    this.name = "MediaJobCancelledError";
  }
}

/** Job đã ở trạng thái terminal nhưng vẫn cố cập nhật → bỏ qua âm thầm */
export class MediaJobTerminalError extends Error {
  constructor(public readonly jobId: string, public readonly currentStatus: string) {
    super(`Media generation job ${jobId} đã ở trạng thái terminal (${currentStatus}).`);
    this.name = "MediaJobTerminalError";
  }
}
