import { TimestampEntity } from "../../core";

export type IProductApp = TimestampEntity & {
  name?: string;
  des?: string; 
  coverImg?: string;
  categoryIds?: string[]; // Nhiều danh mục để hiển thị (click categoryId bên ngoài)
  active?: boolean;
  slug?: string;
  priority?: number; // Độ ưu tiên hiển thị
  creditCost?: number;
};
