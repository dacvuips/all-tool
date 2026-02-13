import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import { CustomerModel } from "../../../libs/dal/customer";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Mutation {
      customerUpdateHasRewardPoint: Mixed
    }
  `,
  resolver: {
    Mutation: {
      customerUpdateHasRewardPoint: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);
        await CustomerModel.updateOne({ _id: context.id }, { $set: { hasReward: false } }).orFail(
          new Error(t("Không tìm thấy khách hàng"))
        );
        return true;
      },
    },
  },
};
