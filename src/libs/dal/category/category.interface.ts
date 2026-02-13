import { TimestampEntity } from "../../core";
export enum PropertyTypeEnum {
  TEXT = "TEXT", // Text
  SELECT = "SELECT", // Select
  MULTI_SELECT = "MULTI_SELECT", // Multi select
  BOOLEAN = "BOOLEAN", // Boolean
  NUMBER = "NUMBER", // Number
}
export type PropertySelectOption = {
  key: string; // Id option
  label: string; // Nhãn hiển thị
};
export type CategoryConfig = {
  type?: PropertyTypeEnum; // Kiểu thuộc tính, SELECT
  key?: string; // Tên thuộc tính, "Thuộc tính"
  label?: string; // Nhãn hiển thị, "Thuộc tính"
  placeholder?: string; // Placeholder, "Chọn thuộc tính"
  tooltip?: string; // Tooltip, "Chọn thuộc tính"
  required?: boolean; // Bắt buộc, true
  clearable?: boolean; // Cho phép xóa, true
  options?: PropertySelectOption[]; // Danh sách option, [{ id: "1", label: "Kim" }]
};
export type ICategory = TimestampEntity & {
  name?: string; // Tên danh mục
  imgUrl?: string; // Logo danh mục
  description?: string; // Mô tả danh mục
  priority?: number; // Độ ưu tiên hiển thị
  active?: boolean; // Trạng thái hoạt động
  properties?: CategoryConfig[]; // Thuộc tính danh mục
};
