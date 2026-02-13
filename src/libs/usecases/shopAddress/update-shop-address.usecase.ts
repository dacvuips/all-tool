import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import { IShopAddress } from "../../dal/shopAddress/shopAddress.interface";
import { shopAddressService } from "../../dal/shopAddress/shopAddress.service";

/**
 * Usecase: Cập nhật thông tin địa chỉ cửa hàng
 *
 * Flow:
 * 1. Validate input data
 * 2. Kiểm tra địa chỉ tồn tại
 * 3. Nếu set làm default, unset các default khác
 * 4. Cập nhật thông tin
 * 5. Trả về kết quả
 */
export namespace UpdateShopAddress {
  /**
   * Command input cho usecase
   */
  export class Command extends BaseCommand {
    @IsNotEmpty({ message: "ID không được để trống" })
    @IsString({ message: "ID phải là string" })
    id: string;

    @IsOptional()
    @IsString({ message: "Tên người liên hệ phải là string" })
    recipientName?: string;

    @IsOptional()
    @IsString({ message: "Số điện thoại phải là string" })
    phone?: string;

    @IsOptional()
    @IsEmail({}, { message: "Email không hợp lệ" })
    email?: string;

    @IsOptional()
    @IsString({ message: "Địa chỉ phải là string" })
    address?: string;

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
  class UpdateShopAddressUsecase extends BaseUsecase {
    async execute(cmd: Command): Promise<IShopAddress> {
      try {
        // Kiểm tra địa chỉ tồn tại
        const existingAddress = await shopAddressService.findOne({ _id: cmd.id });
        if (!existingAddress) {
          throw new Error("Không tìm thấy địa chỉ cửa hàng");
        }

        /**
         * Logic xử lý default address khi update:
         * - Nếu update địa chỉ với default = true, set tất cả địa chỉ khác về default = false
         * - Nếu update địa chỉ với default = false mà địa chỉ đó đang là default, kiểm tra phải có địa chỉ default khác
         * - Đảm bảo chỉ có 1 địa chỉ mặc định duy nhất trong hệ thống
         */
        if (cmd.default === true) {
          await shopAddressService.model.updateMany(
            { _id: { $ne: cmd.id }, default: true },
            { $set: { default: false } }
          );
        } else if (cmd.default === false && existingAddress.default === true) {
          // Nếu đang set default = false cho địa chỉ hiện đang là default
          // Kiểm tra xem có địa chỉ default nào khác không
          const otherDefaultCount = await shopAddressService.model.countDocuments({
            _id: { $ne: cmd.id },
            default: true,
          });

          if (otherDefaultCount === 0) {
            throw new Error(
              "Không thể bỏ mặc định địa chỉ này vì phải có ít nhất một địa chỉ cửa hàng mặc định"
            );
          }
        }

        // Chuẩn bị dữ liệu cập nhật
        const updateData: Partial<IShopAddress> = {};
        if (cmd.recipientName !== undefined) updateData.recipientName = cmd.recipientName;
        if (cmd.phone !== undefined) updateData.phone = cmd.phone;
        if (cmd.email !== undefined) updateData.email = cmd.email;
        if (cmd.address !== undefined) updateData.address = cmd.address;
        if (cmd.ward !== undefined) updateData.ward = cmd.ward;
        if (cmd.district !== undefined) updateData.district = cmd.district;
        if (cmd.province !== undefined) updateData.province = cmd.province;
        if (cmd.country !== undefined) updateData.country = cmd.country;
        if (cmd.postalCode !== undefined) updateData.postalCode = cmd.postalCode;
        if (cmd.note !== undefined) updateData.note = cmd.note;
        if (cmd.default !== undefined) updateData.default = cmd.default;
        if (cmd.isActive !== undefined) updateData.isActive = cmd.isActive;
        if (cmd.default === true) updateData.isActive = true; // Nếu set làm default thì luôn active

        // Cập nhật địa chỉ
        const updatedAddress = await shopAddressService.updateOne(cmd.id, updateData);

        return updatedAddress;
      } catch (error: any) {
        throw new Error(error.message || "Có lỗi xảy ra khi cập nhật địa chỉ cửa hàng");
      }
    }
  }

  export const usecase = new UpdateShopAddressUsecase();
}
