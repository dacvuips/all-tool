import { set } from "lodash";
import { CRUDService } from "../../../base/crudService";
import { encryptProviderSecret } from "../../../packages/encryption/encrypt-provider";
import { IShippingProvider } from "./shippingProvider.interface";
import { ShippingProviderModel } from "./shippingProvider.model";

/**
 * Service xử lý logic nghiệp vụ cho nhà cung cấp vận chuyển
 */
class ShippingProviderService extends CRUDService(ShippingProviderModel) {
  /**
   * Tạo mới nhà cung cấp vận chuyển
   * Token sẽ được mã hóa trước khi lưu vào database
   */
  async create(data: Partial<IShippingProvider>) {
    const encryptedData = { ...data };

    // Mã hóa token nếu có
    if (data.apiConfig?.token) {
      encryptedData.apiConfig = {
        ...data.apiConfig,
        token: encryptProviderSecret(data.apiConfig.token),
      };
    }

    return await super.create(encryptedData);
  }

  /**
   * Cập nhật thông tin nhà cung cấp vận chuyển
   * Token sẽ được mã hóa nếu có thay đổi
   */
  async updateOne(id: string, data: Partial<IShippingProvider>) {
    const encryptedData = { ...data };

    // Lấy thông tin nhà cung cấp hiện tại
    const currentProvider = await this.findOne({ _id: id });

    // Kiểm tra và mã hóa token nếu có thay đổi
    if (data.apiConfig?.token) {
      const isTokenChanged = this.checkValueChanged(data.apiConfig.token);

      set(
        encryptedData,
        "apiConfig.token",
        isTokenChanged
          ? encryptProviderSecret(data.apiConfig.token)
          : currentProvider?.apiConfig?.token
      );
    }

    return await super.updateOne(id, encryptedData);
  }

  /**
   * Kiểm tra giá trị có thay đổi không
   * Nếu giá trị là "****" hoặc rỗng thì coi như không thay đổi
   */
  private checkValueChanged(value: string): boolean {
    if (value === "****" || value === undefined || value === null || value === "") {
      return false;
    }
    return true;
  }

  /**
   * Lấy danh sách nhà cung cấp đang hoạt động
   */
  async getActiveProviders() {
    return await this.fetch({
      filter: { isActive: true },
      order: { priority: -1 }, // Sắp xếp theo độ ưu tiên
    });
  }

  /**
   * Lấy nhà cung cấp theo mã code
   */
  async getByCode(code: string) {
    return await this.findOne({ code: code.toUpperCase() });
  }
}

const shippingProviderService = new ShippingProviderService();
export { shippingProviderService };
