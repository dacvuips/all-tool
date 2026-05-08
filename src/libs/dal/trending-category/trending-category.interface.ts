import { TimestampEntity } from "../../core";

export type ITrendingCategory = TimestampEntity & {
  /** Tên danh mục trending */
  name?: string;
  /** Đánh dấu HOT */
  isHot?: boolean;
  /** Trạng thái hoạt động */
  isActive?: boolean;
  /** Danh sách Trending IDs */
  trendingIds?: string[];
  /** Thứ tự ưu tiên */
  priority?: number;
};
