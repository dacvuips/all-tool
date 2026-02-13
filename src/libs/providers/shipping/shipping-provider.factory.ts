import { IShippingProviderCodeEnum } from "../../dal/shippingProvider/shippingProvider.interface";
import { ShippingProviderModel } from "../../dal/shippingProvider/shippingProvider.model";
import { GHNShippingAdapter } from "./ghn.adapter";
import { GHTKShippingAdapter } from "./ghtk.adapter";
import { ShippingProviderAdapter } from "./shipping-provider.adapter";

/**
 * Factory để tạo adapter phù hợp với từng nhà cung cấp vận chuyển
 * Sử dụng Pattern Factory để quản lý việc tạo các adapter
 */
export class ShippingProviderFactory {
  /**
   * Tạo adapter dựa trên mã nhà cung cấp
   * @param providerCode - Mã nhà cung cấp (GHN, GHTK, etc.)
   * @returns Adapter instance tương ứng
   */
  static async createAdapter(providerCode: string): Promise<ShippingProviderAdapter> {
    // Lấy thông tin cấu hình từ database
    const provider = await ShippingProviderModel.findOne({
      code: providerCode,
      isActive: true,
    });

    if (!provider) {
      throw new Error(
        `Nhà cung cấp vận chuyển ${providerCode} không tồn tại hoặc chưa được kích hoạt`
      );
    }

    // Tạo adapter tương ứng
    switch (providerCode) {
      case IShippingProviderCodeEnum.GHN:
        return new GHNShippingAdapter(provider.apiConfig);

      case IShippingProviderCodeEnum.GHTK:
        return new GHTKShippingAdapter(provider.apiConfig);

      // Các provider khác có thể thêm vào đây
      case IShippingProviderCodeEnum.VT_POST:
        throw new Error("VT Post adapter chưa được implement");

      case IShippingProviderCodeEnum.JT_EXPRESS:
        throw new Error("JT Express adapter chưa được implement");

      case IShippingProviderCodeEnum.SPX:
        throw new Error("Shopee Express adapter chưa được implement");

      default:
        throw new Error(`Nhà cung cấp vận chuyển ${providerCode} chưa được hỗ trợ`);
    }
  }

  /**
   * Lấy danh sách tất cả providers đang active
   */
  static async getActiveProviders() {
    return await ShippingProviderModel.find({ isActive: true });
  }

  /**
   * Kiểm tra xem provider có được hỗ trợ không
   */
  static isSupportedProvider(providerCode: string): boolean {
    const supportedProviders = [
      IShippingProviderCodeEnum.GHN,
      IShippingProviderCodeEnum.GHTK,
      IShippingProviderCodeEnum.VT_POST,
      IShippingProviderCodeEnum.JT_EXPRESS,
      IShippingProviderCodeEnum.SPX,
      // Thêm các provider đã implement vào đây
    ];
    return supportedProviders.includes(providerCode as IShippingProviderCodeEnum);
  }
}
