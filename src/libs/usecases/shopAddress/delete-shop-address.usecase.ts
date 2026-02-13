import { IsNotEmpty, IsString } from "class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import { shopAddressService } from "../../dal/shopAddress/shopAddress.service";

/**
 * Usecase: Xóa địa chỉ cửa hàng
 *
 * Flow:
 * 1. Validate input (id)
 * 2. Kiểm tra địa chỉ tồn tại
 * 3. Validate trước khi xóa (không cho xóa default nếu còn địa chỉ khác)
 * 4. Xóa địa chỉ
 * 5. Trả về kết quả
 */
export namespace DeleteShopAddress {
  /**
   * Command input cho usecase
   */
  export class Command extends BaseCommand {
    @IsNotEmpty({ message: "ID không được để trống" })
    @IsString({ message: "ID phải là string" })
    id: string;
  }

  /**
   * Usecase implementation
   */
  class DeleteShopAddressUsecase extends BaseUsecase {
    async execute(cmd: Command): Promise<{ success: boolean; message: string }> {
      try {
        // Kiểm tra địa chỉ tồn tại
        const address = await shopAddressService.findOne({ _id: cmd.id });
        if (!address) {
          throw new Error("Không tìm thấy địa chỉ cửa hàng");
        }

        /**
         * Logic xử lý default address khi delete:
         * - Nếu xóa địa chỉ có default = true:
         *   + Tìm địa chỉ đầu tiên khác trong collection (isActive = true)
         *   + Set địa chỉ đó thành default = true
         * - Nếu xóa địa chỉ có default = false hoặc undefined:
         *   + Xóa bình thường, không cần xử lý gì thêm
         */
        const isDefaultAddress = address.default === true;

        // Xóa địa chỉ (soft delete bằng cách set isActive = false)
        await shopAddressService.updateOne(cmd.id, { isActive: false } as any);

        // Nếu địa chỉ vừa xóa là default, set địa chỉ đầu tiên còn lại thành default
        if (isDefaultAddress) {
          const firstActiveAddress = await shopAddressService.model
            .findOne({ isActive: true })
            .sort({ createdAt: 1 }); // Lấy địa chỉ cũ nhất (được tạo đầu tiên)

          if (firstActiveAddress) {
            await shopAddressService.updateOne(firstActiveAddress._id.toString(), {
              default: true,
            } as any);
          }
        }

        return {
          success: true,
          message: "Xóa địa chỉ cửa hàng thành công",
        };
      } catch (error: any) {
        throw new Error(error.message || "Có lỗi xảy ra khi xóa địa chỉ cửa hàng");
      }
    }
  }

  export const usecase = new DeleteShopAddressUsecase();
}
