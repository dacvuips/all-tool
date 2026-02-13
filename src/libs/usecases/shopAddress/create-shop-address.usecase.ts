import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import { IShopAddress } from "../../dal/shopAddress/shopAddress.interface";
import { shopAddressService } from "../../dal/shopAddress/shopAddress.service";

/**
 * Usecase: Tạo địa chỉ cửa hàng mới
 *
 * Flow:
 * 1. Validate input data
 * 2. Check nếu set làm default, unset các default khác
 * 3. Tạo địa chỉ mới trong database
 * 4. Trả về kết quả
 */
export namespace CreateShopAddress {
  /**
   * Command input cho usecase
   */
  export class Command extends BaseCommand {
    @IsNotEmpty({ message: "Tên người liên hệ không được để trống" })
    @IsString({ message: "Tên người liên hệ phải là string" })
    recipientName: string;

    @IsNotEmpty({ message: "Số điện thoại không được để trống" })
    @IsString({ message: "Số điện thoại phải là string" })
    phone: string;

    @IsOptional()
    @IsEmail({}, { message: "Email không hợp lệ" })
    email?: string;

    @IsNotEmpty({ message: "Địa chỉ không được để trống" })
    @IsString({ message: "Địa chỉ phải là string" })
    address: string;

    @IsOptional()
    @IsString({ message: "Phường/Xã phải là string" })
    ward?: string;

    @IsOptional()
    @IsString({ message: "Quận/Huyện phải là string" })
    district?: string;

    @IsOptional()
    @IsString({ message: "Tỉnh/Thành phố phải là string" })
    province?: string;

    @IsOptional()
    @IsString({ message: "Quốc gia phải là string" })
    country?: string;

    @IsOptional()
    @IsString({ message: "Mã bưu điện phải là string" })
    postalCode?: string;

    @IsOptional()
    @IsString({ message: "Ghi chú phải là string" })
    note?: string;

    @IsOptional()
    @IsBoolean({ message: "Default phải là boolean" })
    default?: boolean;

    @IsOptional()
    @IsBoolean({ message: "IsActive phải là boolean" })
    isActive?: boolean;
  }

  /**
   * Usecase implementation
   */
  class CreateShopAddressUsecase extends BaseUsecase {
    async execute(cmd: Command): Promise<IShopAddress> {
      try {
        /**
         * Logic xử lý default address:
         * - Nếu tạo địa chỉ với default = true, set tất cả địa chỉ khác về default = false
         * - Đảm bảo chỉ có 1 địa chỉ mặc định duy nhất trong hệ thống
         */
        if (cmd.default === true) {
          await shopAddressService.model.updateMany(
            { default: true },
            { $set: { default: false } }
          );
        }

        // Tạo địa chỉ mới với thông tin đã validate
        const shopAddress = await shopAddressService.create({
          recipientName: cmd.recipientName,
          phone: cmd.phone,
          email: cmd.email,
          address: cmd.address,
          ward: cmd.ward,
          district: cmd.district,
          province: cmd.province,
          country: cmd.country || "Vietnam",
          postalCode: cmd.postalCode,
          note: cmd.note,
          default: cmd.default || false,
          isActive: cmd.default === true ? true : cmd.isActive !== false, // Nếu là default thì luôn active
        } as IShopAddress);

        return shopAddress;
      } catch (error: any) {
        throw new Error(error.message || "Có lỗi xảy ra khi tạo địa chỉ cửa hàng");
      }
    }
  }

  export const usecase = new CreateShopAddressUsecase();
}
