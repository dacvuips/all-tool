import { TimestampEntity } from "../../core";

export type IArtStyleCategory = TimestampEntity & {
  /** Tên danh mục art style */
  name?: string;
  /** Đánh dấu HOT */
  isHot?: boolean;
  /** Trạng thái hoạt động */
  isActive?: boolean;
  /** Danh sách Art Style IDs */
  artStyleIds?: string[];
  /** Thứ tự ưu tiên */
  priority?: number;
};
