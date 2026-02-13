import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

/**
 * Interface cho địa chỉ cửa hàng
 */
export interface ShopAddress extends BaseModel {
  recipientName: string; // Tên người liên hệ/người gửi
  phone: string; // Số điện thoại
  email?: string; // Email (optional)
  address: string; // Địa chỉ chi tiết (số nhà, tên đường)
  ward?: string; // Phường/Xã
  district?: string; // Quận/Huyện
  province?: string; // Tỉnh/Thành phố
  country?: string; // Quốc gia
  postalCode?: string; // Mã bưu điện
  note?: string; // Ghi chú
  default: boolean; // Địa chỉ mặc định
  isActive: boolean; // Trạng thái hoạt động
}

/**
 * Repository xử lý các tương tác với API GraphQL cho địa chỉ cửa hàng
 */
export class ShopAddressRepository extends CrudRepository<ShopAddress> {
  apiName: string = "ShopAddress"; // Tên API trong GraphQL
  displayName: string = t("địa chỉ cửa hàng"); // Tên hiển thị

  // Fragment ngắn gọn - dùng cho danh sách
  shortFragment: string = this.parseFragment(`
    id: String
    recipientName: String
    phone: String
    address: String
    ward: String
    district: String
    province: String
    default: Boolean
    isActive: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  `);

  // Fragment đầy đủ - dùng cho chi tiết
  fullFragment: string = this.parseFragment(`
    id: String
    recipientName: String
    phone: String
    email: String
    address: String
    ward: String
    district: String
    province: String
    country: String
    postalCode: String
    note: String
    default: Boolean
    isActive: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  `);

  /**
   * Set địa chỉ làm mặc định
   */
  async setDefault(id: string): Promise<ShopAddress> {
    return this.mutate({
      mutation: `setDefaultShopAddress(id: "${id}") { ${this.fullFragment} }`,
    }).then((res) => res.data.g0);
  }

  /**
   * Lấy địa chỉ mặc định
   */
  async getDefault(): Promise<ShopAddress | null> {
    return this.query({
      query: `
        query {
          getDefaultShopAddress {
            ${this.fullFragment}
          }
        }
      `,
    }).then((res) => res.data.getDefaultShopAddress);
  }
}

// Export instance để sử dụng trong các component
export const ShopAddressService = new ShopAddressRepository();
