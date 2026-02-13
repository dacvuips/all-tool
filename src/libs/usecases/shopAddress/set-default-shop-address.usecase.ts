import { IsNotEmpty, IsString } from "class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import { IShopAddress } from "../../dal/shopAddress/shopAddress.interface";
import { shopAddressService } from "../../dal/shopAddress/shopAddress.service";

/**
 * Usecase: Set địa chỉ mặc định
 *
 * Flow:
 * 1. Validate input (id)
 * 2. Kiểm tra địa chỉ tồn tại
 * 3. Unset tất cả địa chỉ mặc định khác
 * 4. Set địa chỉ hiện tại làm mặc định
 * 5. Trả về kết quả
 */
export namespace SetDefaultShopAddress {
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
  class SetDefaultShopAddressUsecase extends BaseUsecase {
    async execute(cmd: Command): Promise<IShopAddress> {
      try {
        // Set địa chỉ mặc định
        const address = await shopAddressService.setDefaultAddress(cmd.id);

        return address;
      } catch (error: any) {
        throw new Error(error.message || "Có lỗi xảy ra khi set địa chỉ mặc định");
      }
    }
  }

  export const usecase = new SetDefaultShopAddressUsecase();
}
