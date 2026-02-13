import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { GetAllThreadOpenUsecase } from "../../../libs/usecases/thread/get-all-thread-open.usecase";

export default {
  schema: gql`
    extend type Query {
      getAllThreadCustomer(q: QueryGetListInput): ThreadPageData
      getAllThreadShop(q: QueryGetListInput): ThreadPageData
      getAllThreadStaff(q: QueryGetListInput): ThreadPageData
      getAllThreadGameOrder(gameOrderId: String!, q: QueryGetListInput): ThreadPageData
    }
  `,
  resolver: {
    Query: {
      getAllThreadCustomer: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);

        const command = GetAllThreadOpenUsecase.Command.create({
          resource: "customer",
          customerId: context.id,
          query: args.q,
        });
        const result = await GetAllThreadOpenUsecase.usecase.execute(command);
        return result.data;
      },
      getAllThreadShop: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.SHOP_SHOP_STAFF);

        const command = GetAllThreadOpenUsecase.Command.create({
          resource: "shop",
          shopId: context.id,
          query: args.q,
        });
        const result = await GetAllThreadOpenUsecase.usecase.execute(command);
        return result.data;
      },
      getAllThreadStaff: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);

        const command = GetAllThreadOpenUsecase.Command.create({
          resource: "staff",
          staffId: context.id,
          query: args.q,
        });
        const result = await GetAllThreadOpenUsecase.usecase.execute(command);
        return result.data;
      },
      getAllThreadGameOrder: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);
        const command = GetAllThreadOpenUsecase.Command.create({
          resource: "game-order",
          gameOrderId: args.gameOrderId,
          query: args.q,
        });
        const result = await GetAllThreadOpenUsecase.usecase.execute(command);
        return result.data;
      },
    },
  },
};
