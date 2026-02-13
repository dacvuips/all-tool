import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { Context } from "../../../libs/graphql";
import { CreateShippingOrder } from "../../../libs/usecases/order/create-shipping-order.usecase";

/**
 * GraphQL Mutation cho việc tạo đơn vận chuyển
 */
export default {
  schema: gql`
    extend type Mutation {
      """
      Tạo đơn vận chuyển với nhà cung cấp (GHN, GHTK, etc.)
      Yêu cầu quyền ADMIN
      """
      createShippingOrder(input: CreateShippingOrderInput!): CreateShippingOrderResponse
    }

    """
    Response trả về khi tạo đơn vận chuyển
    """
    type CreateShippingOrderResponse {
      success: Boolean!
      message: String
      shipmentId: String
      trackingCode: String
      data: Mixed
    }
    input CreateShippingOrderInput {
      "Mã đơn hàng cần tạo đơn vận chuyển"
      orderId: ID!
      "Nhà cung cấp vận chuyển (VD: GHN, GHTK)"
      shippingProviderId: String!
      "Mã địa chỉ cửa hàng"
      shopAddressId: String!
      "Mã dịch vụ vận chuyển (VD: GHN: STANDARD, GHTK: ECONOMY)"
      serviceCode: String
      "Hàng nhẹ (≤ 20kg) hoặc Hàng nặng (≥ 20kg)"
      serviceTypeId: Int!
      "Giá trị bảo hiểm (nếu có)"
      insuranceValue: Float
      "Ghi chú cho đơn vận chuyển"
      note: String
      "Tổng khối lượng sản phẩm (gram)"
      totalItemsWeight: Float
      "Khối lượng thùng đóng gói (gram)"
      packageWeight: Float
      "Dài (cm)"
      length: Float
      "Rộng (cm)"
      width: Float
      "Cao (cm)"
      height: Float
    }
  `,

  resolver: {
    Mutation: {
      /**
       * Resolver cho createShippingOrder mutation
       */
      createShippingOrder: async (root: any, args: any, context: Context) => {
        // Chỉ cho phép ADMIN tạo đơn vận chuyển
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-5"]]);

        const input = args.input;
        // Tạo command từ arguments
        const command = CreateShippingOrder.Command.create({
          orderId: input.orderId,
          shippingProviderId: input.shippingProviderId,
          shopAddressId: input.shopAddressId,
          serviceCode: input.serviceCode,
          serviceTypeId: input.serviceTypeId,
          insuranceValue: input.insuranceValue,
          note: input.note,
          totalItemsWeight: input.totalItemsWeight,
          packageWeight: input.packageWeight,
          length: input.length,
          width: input.width,
          height: input.height,
        });

        // Thực thi usecase
        return await CreateShippingOrder.usecase.execute(command);
      },
    },
  },
};
