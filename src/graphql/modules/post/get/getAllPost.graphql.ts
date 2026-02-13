import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../../constants/role.const";
import { Context } from "../../../../libs/graphql";
import { GetAllPostUsecase } from "../../../../libs/usecases/post/get/get-all-post.usecase";

export default {
  schema: gql`
    extend type Query {
      getAllCustomerPost(q: QueryGetListInput): PostPageData
      getAllPartnerPost(q: QueryGetListInput): PostPageData
      getAllShopPost(q: QueryGetListInput): PostPageData
      getAllStaffPost(q: QueryGetListInput): PostPageData
      getAllPosts(q: QueryGetListInput): PostPageData
    }
  `,
  resolver: {
    Query: {
      getAllCustomerPost: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);

        const command = GetAllPostUsecase.Command.create({
          resource: "customer",
          query: args.q,
        }) as GetAllPostUsecase.Command;
        const result = await GetAllPostUsecase.usecase.execute(command);
        return result.data;
      },
      getAllPartnerPost: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.PARTNER]);

        const command = GetAllPostUsecase.Command.create({
          resource: "partner",
          query: args.q,
        }) as GetAllPostUsecase.Command;
        const result = await GetAllPostUsecase.usecase.execute(command);
        return result.data;
      },
      getAllShopPost: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.SHOP_SHOP_STAFF);

        const command = GetAllPostUsecase.Command.create({
          resource: "shop",
          query: args.q,
        }) as GetAllPostUsecase.Command;
        const result = await GetAllPostUsecase.usecase.execute(command);
        return result.data;
      },
      getAllStaffPost: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);

        const command = GetAllPostUsecase.Command.create({
          resource: "staff",
          query: args.q,
        }) as GetAllPostUsecase.Command;
        const result = await GetAllPostUsecase.usecase.execute(command);
        return result.data;
      },
      getAllPosts: async (root: any, args: any, context: Context) => {
        const command = GetAllPostUsecase.Command.create({
          resource: "all",
          query: args.q,
        }) as GetAllPostUsecase.Command;
        const result = await GetAllPostUsecase.usecase.execute(command);
        return result.data;
      },
    },
  },
};
