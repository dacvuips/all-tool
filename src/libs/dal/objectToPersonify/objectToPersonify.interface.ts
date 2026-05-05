import { TimestampEntity } from "../../core";

export type IObjectToPersonify = TimestampEntity & {
  /** Tên nhân vật nhân hoá */
  name?: string;
  /** Prompt mô tả nhân vật (chỉ admin/staff thấy) */
  prompt?: string;
  /** URL ảnh đại diện */
  imageUrl?: string;
  /** Mã code định danh (unique) */
  code?: string;
  /** Trạng thái hoạt động */
  isActive?: boolean;
  /** ID khách hàng sở hữu */
  customerId?: string;
};
