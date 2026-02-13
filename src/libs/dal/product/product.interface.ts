import { TimestampEntity } from "../../core";

export enum PreOrder {
  YES = "YES", // Có
  NO = "NO", // Không
}

export enum OtherInfoStatus {
  NEW = "NEW", // MỚI
  USED = "USED", // Đã sử dụng
}

/**
 * Interface cho một tùy chọn phân loại (Ví dụ: "Xanh", "Đỏ", "S", "M")
 */
export interface ITierOption {
  code?: string; // Có thể dùng string UUID từ frontend hoặc ObjectId từ Mongo
  name: string;
  imageUrl?: string; // URL ảnh (lưu ý: nên upload ảnh lên S3/Cloudinary lấy URL trước khi lưu vào DB)
}

/**
 * Interface cho một nhóm phân loại (Ví dụ: "Màu sắc", "Kích thước")
 */
export interface ITier {
  code?: string;
  name: string;
  options: ITierOption[];
}

/**
 * Interface cho một biến thể cụ thể (SKU)
 * Kết hợp giữa các option. Ví dụ: Màu Xanh + Size S
 */
export interface IVariant {
  code?: string;
  sku: string;
  price: number;
  stock: number;

  /**
   * Mảng chứa ID của các option tạo nên biến thể này.
   * Ví dụ: [id_cua_mau_xanh, id_cua_size_s]
   * Thứ tự trong mảng này khớp với thứ tự của mảng `tiers` bên dưới.
   */
  optionCodes: string[];
}

export type IProduct = TimestampEntity & {
  name?: string;
  des?: string;
  video?: string;
  coverImg?: string;
  imgs?: string[];
  categoryId?: string;
  categoryProperties?: any; // Thuộc tính danh mục
  active?: boolean;
  slug?: string;
  minPrice?: number;
  maxPrice?: number;
  delivery?: {
    weight?: number;
    width?: number;
    length?: number;
    height?: number;
    price?: number;
  };
  otherInfo?: {
    preOrder?: PreOrder;
    preOrderDay?: number;
    status: OtherInfoStatus;
    sku: string;
  };
  classification?: {
    tiers: ITier[]; // Danh sách các nhóm phân loại
    variants: IVariant[]; // Danh sách các biến thể đã sinh ra
    originalPrice?: number;
    totalStock?: number;
  };
};
