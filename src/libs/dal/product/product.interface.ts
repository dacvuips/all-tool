import { TimestampEntity } from "../../core";

export enum PropertyTypeEnum {
  TEXT = "TEXT", // Text
  SELECT = "SELECT", // Select
  MULTI_SELECT = "MULTI_SELECT", // Multi select
  BOOLEAN = "BOOLEAN", // Boolean
  NUMBER = "NUMBER", // Number
  RADIO = "RADIO", // Radio
  CHECKBOX = "CHECKBOX", // Checkbox
  SWITCH = "SWITCH", // Switch

  TEXTAREA = "TEXTAREA", // Textarea
  IMAGE = "IMAGE", // Image
  FILE = "FILE", // File
}

export type PropertySelectOption = {
  key: string; // Id option
  label: string; // Nhãn hiển thị
};

export type Property = {
  type?: PropertyTypeEnum; // Kiểu thuộc tính, SELECT
  key?: string; // Tên thuộc tính, "Thuộc tính"
  label?: string; // Nhãn hiển thị, "Thuộc tính"
  placeholder?: string; // Placeholder, "Chọn thuộc tính"
  tooltip?: string; // Tooltip, "Chọn thuộc tính"
  required?: boolean; // Bắt buộc, true
  clearable?: boolean; // Cho phép xóa, true
  options?: PropertySelectOption[]; // Danh sách option, [{ id: "1", label: "Kim" }]
};

export type IProduct = TimestampEntity & {
  name?: string;
  des?: string;
  video?: string;
  coverImg?: string;
  categoryId?: string;
  active?: boolean;
  slug?: string;
  price?: number;
  priority?: number; // Độ ưu tiên hiển thị
  properties?: Property[]; // Thuộc tính danh mục
};
