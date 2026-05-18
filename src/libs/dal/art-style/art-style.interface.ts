import { TimestampEntity } from "../../core";

export type IArtStyle = TimestampEntity & {
  /** Tên art style */
  name?: string;
  /** Danh sách URL ảnh */
  imageUrls?: string[];
  /** Prompt mô tả */
  prompt?: string;
  /** Trạng thái hoạt động */
  isActive?: boolean;
  /** ID khách hàng sở hữu */
  customerId?: string;
  /** Số lượt sử dụng */
  count?: number;
  /** Danh sách ID danh mục art style */
  artStyleCategoryIds?: string[];
  /** Giá */
  price?: number;
  /** Trạng thái xuất bản */
  isPublish?: boolean;
  /** Số lượt sử dụng theo tháng */
  monthlyCount?: number;
  /** Mô tả */
  des?: string;
  /** Prompt ngắn (150 ký tự đầu) */
  promptShort?: string;
};
