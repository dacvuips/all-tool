import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { CustomerModel } from "../../../libs/dal/customer";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Mutation {
      "Khách hàng xác nhận đã đọc và đồng ý điều khoản sử dụng dịch vụ"
      customerAcceptTermsOfService: Boolean
    }
  `,
  resolver: {
    Mutation: {
      customerAcceptTermsOfService: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);
        await CustomerModel.findByIdAndUpdate(context.id, {
          $set: {
            acceptedTermsOfService: true,
          },
        });
        return true;
      },
    },
  },
};
