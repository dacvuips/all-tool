import { TOKEN_ROLES } from "../../../constants/role.const";
import { shopAddressService } from "../../../libs/dal/shopAddress/shopAddress.service";
import { Context } from "../../../libs/graphql";

import { CreateShopAddress } from "../../../libs/usecases/shopAddress/create-shop-address.usecase";
import { DeleteShopAddress } from "../../../libs/usecases/shopAddress/delete-shop-address.usecase";
import { SetDefaultShopAddress } from "../../../libs/usecases/shopAddress/set-default-shop-address.usecase";
import { UpdateShopAddress } from "../../../libs/usecases/shopAddress/update-shop-address.usecase";

/**
 * GraphQL Resolver cho ShopAddress
 * Xử lý các query và mutation liên quan đến địa chỉ cửa hàng
 */
export default {
  Query: {
    /**
     * Lấy danh sách địa chỉ cửa hàng với phân trang
     */
    getAllShopAddress: async (root: any, args: any, context: Context) => {
      context.auth(TOKEN_ROLES.ADMIN_STAFF);
      return shopAddressService.fetch(args.q);
    },

    /**
     * Lấy thông tin một địa chỉ cửa hàng
     */
    getOneShopAddress: async (root: any, args: any, context: Context) => {
      context.auth(TOKEN_ROLES.ADMIN_STAFF);
      const { id } = args;
      return await shopAddressService.findOne({ _id: id });
    },

    /**
     * Lấy địa chỉ mặc định
     */
    getDefaultShopAddress: async (root: any, args: any, context: Context) => {
      context.auth(TOKEN_ROLES.ADMIN_STAFF);
      return await shopAddressService.getDefaultAddress();
    },
  },

  Mutation: {
    /**
     * Tạo địa chỉ cửa hàng mới
     */
    createShopAddress: async (root: any, args: any, context: Context) => {
      context.auth(TOKEN_ROLES.ADMIN_STAFF);
      const { data } = args;

      // Tạo command từ input
      const command = new CreateShopAddress.Command();
      Object.assign(command, data);

      // Execute usecase
      return await CreateShopAddress.usecase.execute(command);
    },

    /**
     * Cập nhật địa chỉ cửa hàng
     */
    updateShopAddress: async (root: any, args: any, context: Context) => {
      context.auth(TOKEN_ROLES.ADMIN_STAFF);
      const { id, data } = args;

      // Tạo command từ input
      const command = new UpdateShopAddress.Command();
      command.id = id;
      Object.assign(command, data);

      // Execute usecase
      return await UpdateShopAddress.usecase.execute(command);
    },

    /**
     * Xóa địa chỉ cửa hàng (soft delete)
     */
    deleteOneShopAddress: async (root: any, args: any, context: Context) => {
      context.auth(TOKEN_ROLES.ADMIN_STAFF);
      const { id } = args;

      // Tạo command
      const command = new DeleteShopAddress.Command();
      command.id = id;

      // Execute usecase
      await DeleteShopAddress.usecase.execute(command);

      // Trả về địa chỉ đã xóa
      return await shopAddressService.deleteOne(id);
    },

    /**
     * Set địa chỉ làm mặc định
     */
    setDefaultShopAddress: async (root: any, args: any, context: Context) => {
      context.auth(TOKEN_ROLES.ADMIN_STAFF);
      const { id } = args;

      // Tạo command
      const command = new SetDefaultShopAddress.Command();
      command.id = id;

      // Execute usecase
      return await SetDefaultShopAddress.usecase.execute(command);
    },
  },
};
