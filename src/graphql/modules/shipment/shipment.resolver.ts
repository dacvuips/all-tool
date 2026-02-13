import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { ShipmentModel } from "../../../libs/dal/shipment/shipment.model";
import { shipmentService } from "../../../libs/dal/shipment/shipment.service";
import { Context } from "../../../libs/graphql";

/**
 * Resolver cho Shipment GraphQL
 */
const resolvers = {
  Query: {
    /**
     * Lấy danh sách tất cả shipments với phân trang
     */
    getAllShipment: async (root: any, args: any, context: Context) => {
      await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);

      return shipmentService.fetch(args.q);
    },

    /**
     * Lấy chi tiết một shipment theo ID
     */
    getOneShipment: async (root: any, args: any, context: Context) => {
      await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
      const { id } = args;
      return await ShipmentModel.findById(id);
    },

    /**
     * Lấy danh sách shipments theo orderId
     */
    getShipmentsByOrderId: async (root: any, args: any, context: Context) => {
      await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
      const { orderId } = args;
      return await shipmentService.getShipmentsByOrderId(orderId);
    },

    /**
     * Lấy shipment theo tracking code
     */
    getShipmentByTrackingCode: async (root: any, args: any, context: Context) => {
      const { trackingCode } = args;
      return await shipmentService.getShipmentByTrackingCode(trackingCode);
    },
  },

  Mutation: {
    /**
     * Tạo shipment mới (draft)
     */
    createShipment: async (root: any, args: any, context: Context) => {
      await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
      const { data } = args;
      return await shipmentService.create(data);
    },

    /**
     * Cập nhật thông tin shipment
     */
    updateShipment: async (root: any, args: any, context: Context) => {
      await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
      const { id, data } = args;
      return await shipmentService.updateOne(id, data);
    },

    /**
     * Xóa shipment
     */
    deleteOneShipment: async (root: any, args: any, context: Context) => {
      await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
      const { id } = args;
      return await shipmentService.deleteOne(id);
    },

    /**
     * Cập nhật trạng thái shipment
     */
    updateShipmentStatus: async (root: any, args: any, context: Context) => {
      await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
      const { id, status, note } = args;
      return await shipmentService.updateShipmentStatus(id, status, note);
    },

    /**
     * Thêm log cho shipment
     */
    addShipmentLog: async (root: any, args: any, context: Context) => {
      await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
      const { id, log } = args;
      return await shipmentService.addShipmentLog(id, log);
    },
  },
};

export default resolvers;
