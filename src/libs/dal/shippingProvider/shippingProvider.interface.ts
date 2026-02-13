import { TimestampEntity } from "../../core";

/**
 * Interface cho nhà cung cấp vận chuyển
 * Định nghĩa cấu trúc dữ liệu cho các đơn vị vận chuyển như GHN, GHTK, v.v.
 */
export type IShippingProvider = TimestampEntity & {
  id: string;

  // Thông tin cơ bản
  code: IShippingProviderCodeEnum; // Mã định danh nhà cung cấp (VD: "GHN", "GHTK")
  name: string; // Tên nhà cung cấp (VD: "Giao Hàng Nhanh")
  isActive: boolean; // Trạng thái hoạt động của nhà cung cấp

  // Cấu hình API
  apiConfig: IApiConfig;

  // Danh sách dịch vụ vận chuyển
  services: IShippingService[];

  // Metadata bổ sung
  description?: string; // Mô tả về nhà cung cấp
  logo?: string; // Logo của nhà cung cấp
  priority?: number; // Độ ưu tiên hiển thị (số càng nhỏ càng ưu tiên)
};

/**
 * Interface cho cấu hình API của nhà cung cấp
 * Chứa thông tin kết nối và xác thực với API
 */
export interface IApiConfig {
  baseUrl: string; // URL gốc của API (VD: "https://online-gateway.ghn.vn")
  token: string; // Token xác thực (sẽ được mã hóa khi lưu)
  shopId?: string; // ID của shop trên hệ thống nhà cung cấp (nếu có)
  apiKey?: string; // API key bổ sung (nếu cần)
  metadata?: any; // Thông tin bổ sung khác
}

/**
 * Interface cho từng dịch vụ vận chuyển
 * Mỗi nhà cung cấp có thể có nhiều dịch vụ (nhanh, tiêu chuẩn, tiết kiệm...)
 */
export interface IShippingService {
  serviceCode: string; // Mã dịch vụ (VD: "EXPRESS", "STANDARD")
  serviceName: string; // Tên dịch vụ (VD: "GHN Nhanh", "GHN Tiêu chuẩn")
  isActive: boolean; // Trạng thái hoạt động của dịch vụ
  estimatedTime?: string; // Thời gian giao hàng ước tính (VD: "2-3 ngày")
  description?: string; // Mô tả dịch vụ
  metadata?: any; // Thông tin bổ sung
}

export enum IShippingProviderCodeEnum {
  GHN = "GHN",
  GHTK = "GHTK",
  VT_POST = "VT_POST",
  JT_EXPRESS = "JT_EXPRESS",
  SPX = "SPX",
}
