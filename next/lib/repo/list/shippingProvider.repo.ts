import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

/**
 * Interface cho cấu hình API của nhà cung cấp vận chuyển
 */
export interface ApiConfig {
  baseUrl: string; // URL gốc của API
  token: string; // Token xác thực
  shopId?: string; // ID shop trên hệ thống nhà cung cấp
  apiKey?: string; // API key bổ sung
  metadata?: any; // Metadata
}

/**
 * Interface cho dịch vụ vận chuyển
 */
export interface ShippingService {
  serviceCode: string; // Mã dịch vụ
  serviceName: string; // Tên dịch vụ
  isActive: boolean; // Trạng thái hoạt động
  estimatedTime?: string; // Thời gian ước tính
  description?: string; // Mô tả
  metadata?: any; // Metadata
}

/**
 * Interface cho nhà cung cấp vận chuyển
 */
export interface ShippingProvider extends BaseModel {
  code: ShippingProviderCodeEnum; // Mã nhà cung cấp (VD: GHN, GHTK)
  name: string; // Tên nhà cung cấp
  isActive: boolean; // Trạng thái hoạt động
  apiConfig: ApiConfig; // Cấu hình API
  services: ShippingService[]; // Danh sách dịch vụ
  description?: string; // Mô tả
  logo?: string; // Logo
  priority?: number; // Độ ưu tiên
}
export enum ShippingProviderCodeEnum {
  GHN = "GHN",
  GHTK = "GHTK",
  VT_POST = "VT_POST",
  JT_EXPRESS = "JT_EXPRESS",
  SPX = "SPX",
}

/**
 * Repository xử lý các tương tác với API GraphQL cho nhà cung cấp vận chuyển
 */
export class ShippingProviderRepository extends CrudRepository<ShippingProvider> {
  apiName: string = "ShippingProvider"; // Tên API trong GraphQL
  displayName: string = t("nhà cung cấp vận chuyển"); // Tên hiển thị

  // Fragment ngắn gọn - dùng cho danh sách
  shortFragment: string = this.parseFragment(`
    id: String
    code: String
    name: String
    isActive: Boolean
    priority: Int
    logo: String
    apiConfig {
      baseUrl
    }
    createdAt: DateTime
    updatedAt: DateTime
  `);

  // Fragment đầy đủ - dùng cho chi tiết
  fullFragment: string = this.parseFragment(`
    id: String
    code: String
    name: String
    isActive: Boolean
    apiConfig {
      baseUrl
      token
      shopId
      apiKey
      metadata
    }
    services {
      serviceCode
      serviceName
      isActive
      estimatedTime
      description
      metadata
    }
    description: String
    logo: String
    priority: Int
    createdAt: DateTime
    updatedAt: DateTime
  `);
}

// Export instance để sử dụng trong các component
export const ShippingProviderService = new ShippingProviderRepository();
