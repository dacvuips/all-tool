import { TimestampEntity } from "../../core";

export type IAgendaJob = TimestampEntity & {
  name?: string; // Tên job
  data?: any; // Dữ liệu kèm theo
  type?: string; // Loại job
  priority?: number; // Độ ưu tiên
  nextRunAt?: Date; // Lần chạy tiếp theo
  lastModifiedBy?: null; // Người câp nhật
  lockedAt?: Date; // Ngày khoá
  lastRunAt?: Date; // Ngày chạy lần cuối
  lastFinishedAt?: Date; // Kết thúc gần nhất
  disabled?: boolean; // Tắt job
};
