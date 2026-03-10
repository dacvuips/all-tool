import { TimestampEntity } from "../../core";

export type ICategory = TimestampEntity & {
  name?: string; // Tên danh mục
  imgUrl?: string; // Logo danh mục
  description?: string; // Mô tả danh mục
  priority?: number; // Độ ưu tiên hiển thị (thứ tự trong cùng cấp)
  active?: boolean; // Trạng thái hoạt động
  parentId?: string; // ID danh mục cha (null/undefined = root như menu sidebar)
};
