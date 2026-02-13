import { CRUDService } from "../../../base/crudService";
import { IShopAddress } from "./shopAddress.interface";
import { ShopAddressModel } from "./shopAddress.model";

/**
 * Service quản lý địa chỉ cửa hàng
 * Cung cấp các phương thức CRUD và business logic
 */
class ShopAddressService extends CRUDService(ShopAddressModel) {
  /**
   * Lấy địa chỉ mặc định
   */
  async getDefaultAddress(): Promise<IShopAddress | null> {
    return await ShopAddressModel.findOne({ default: true, isActive: true });
  }

  /**
   * Set địa chỉ mặc định
   * Tự động unset các địa chỉ mặc định khác
   */
  async setDefaultAddress(id: string): Promise<IShopAddress> {
    // Unset tất cả địa chỉ mặc định
    await ShopAddressModel.updateMany({ default: true }, { $set: { default: false } });

    // Set địa chỉ mới làm mặc định
    const address = await ShopAddressModel.findByIdAndUpdate(
      id,
      { $set: { default: true, isActive: true } },
      { new: true }
    );

    if (!address) {
      throw new Error("Không tìm thấy địa chỉ");
    }

    return address;
  }

  /**
   * Lấy danh sách địa chỉ active
   */
  async getActiveAddresses(): Promise<IShopAddress[]> {
    return await ShopAddressModel.find({ isActive: true }).sort({ default: -1, createdAt: -1 });
  }
}

export const shopAddressService = new ShopAddressService();
