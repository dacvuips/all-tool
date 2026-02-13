import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { shippingProviderService } from "../../../libs/dal/shippingProvider/shippingProvider.service";
import { Context } from "../../../libs/graphql";

/**
 * Resolver cho các Query liên quan đến nhà cung cấp vận chuyển
 */
const Query = {
  /**
   * Lấy danh sách tất cả nhà cung cấp với phân trang và tìm kiếm
   */
  getAllShippingProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["SP-1-1"]]);
    return shippingProviderService.fetch(args.q);
  },

  /**
   * Lấy chi tiết một nhà cung cấp theo ID
   */
  getOneShippingProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["SP-1-1"]]);
    const { id } = args;
    return await shippingProviderService.findOne({ _id: id });
  },

  /**
   * Lấy danh sách nhà cung cấp đang hoạt động
   */
  getActiveShippingProviders: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["SP-1-1"]]);
    return await shippingProviderService.getActiveProviders();
  },

  /**
   * Lấy nhà cung cấp theo mã code
   */
  getShippingProviderByCode: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["SP-1-1"]]);
    const { code } = args;
    return await shippingProviderService.getByCode(code);
  },
};

/**
 * Resolver cho các Mutation liên quan đến nhà cung cấp vận chuyển
 */
const Mutation = {
  /**
   * Tạo mới nhà cung cấp vận chuyển
   * Yêu cầu quyền SP-1-2
   */
  createShippingProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["SP-1-2"]]);
    const { data } = args;
    return await shippingProviderService.create(data);
  },

  /**
   * Cập nhật thông tin nhà cung cấp
   * Yêu cầu quyền SP-1-3
   */
  updateShippingProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["SP-1-3"]]);
    const { id, data } = args;
    return await shippingProviderService.updateOne(id, data);
  },

  /**
   * Xóa nhà cung cấp
   * Yêu cầu quyền SP-1-4
   */
  deleteOneShippingProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["SP-1-4"]]);
    const { id } = args;
    return await shippingProviderService.deleteOne(id);
  },
};

/**
 * Resolver cho type ShippingProvider
 * Xử lý ẩn thông tin nhạy cảm như token
 */
const ShippingProvider = {
  /**
   * Ẩn token khi trả về client để bảo mật
   * Chỉ hiển thị một phần token dưới dạng "****"
   */
  apiConfig: (root: any, args: any, context: Context) => {
    if (!root.apiConfig) {
      return null;
    }

    // Chuyển Mongoose subdocument thành plain object
    const apiConfig = root.apiConfig.toObject ? root.apiConfig.toObject() : root.apiConfig;

    // Trả về toàn bộ apiConfig nhưng mask token
    return {
      baseUrl: apiConfig.baseUrl,
      token: apiConfig.token ? "****" : null, // Ẩn token thực để bảo mật
      shopId: apiConfig.shopId,
      apiKey: apiConfig.apiKey,
      metadata: apiConfig.metadata,
    };
  },
};

export default {
  Query,
  Mutation,
  ShippingProvider,
};
