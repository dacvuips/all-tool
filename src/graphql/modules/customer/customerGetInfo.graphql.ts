import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { customerGetInfoUsecase } from "../../../libs/usecases";

export default {
  schema: gql`
    extend type Query {
      customerGetInfo: Mixed
    }
  `,
  resolver: {
    Query: {
      customerGetInfo: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER, TOKEN_ROLES.SHOP]);
        return await customerGetInfoUsecase.execute({
          customerId: context.isShop ? context.shopOwnerId : context.id,
        });
      },
    },
  },
};
