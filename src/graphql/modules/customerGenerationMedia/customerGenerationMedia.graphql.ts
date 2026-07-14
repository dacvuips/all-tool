import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { customerGenerationMediaService } from "../../../libs/dal/customerGenerationMedia";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Query {
      getAllCustomerGenerationMedia(q: QueryGetListInput): CustomerGenerationMediaPageData
      getOneCustomerGenerationMedia(id: ID!): CustomerGenerationMedia
    }

    extend type Mutation {
      updateCustomerGenerationMedia(
        id: ID!
        data: UpdateCustomerGenerationMediaInput!
      ): CustomerGenerationMedia
      deleteOneCustomerGenerationMedia(id: ID!): CustomerGenerationMedia
    }

    input UpdateCustomerGenerationMediaInput {
      type: String
      order: Int
    }

    type CustomerGenerationMedia {
      id: String
      createdAt: DateTime
      updatedAt: DateTime
      customerId: String
      productId: String
      nodeId: String
      runId: String
      type: String
      attachmentId: String
      url: String
      mimeType: String
      size: Int
      order: Int
      flow2RequestId: String
    }

    type CustomerGenerationMediaPageData {
      data: [CustomerGenerationMedia]
      total: Int
      pagination: Pagination
    }
  `,
  resolver: {
    Query: {
      getAllCustomerGenerationMedia: async (root: any, args: any, context: Context) => {
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        const customerId = context.isCustomer ? context.id : context.isShop ? context.shopOwnerId : null;
        if (customerId) {
          args.q = args.q || {};
          args.q.filter = { ...args.q.filter, customerId };
        }
        return customerGenerationMediaService.fetch(args.q);
      },
      getOneCustomerGenerationMedia: async (root: any, args: any, context: Context) => {
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        const { id } = args;
        const media = await customerGenerationMediaService.findOne({ _id: id });
        if (context.isCustomer && media?.customerId !== context.id) {
          throw new Error("Không có quyền truy cập");
        }
        return media;
      },
    },
    Mutation: {
      updateCustomerGenerationMedia: async (root: any, args: any, context: Context) => {
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        const { id, data } = args;
        const media = await customerGenerationMediaService.findOne({ _id: id });
        if (context.isCustomer && media?.customerId !== context.id) {
          throw new Error("Không có quyền truy cập");
        }
        return await customerGenerationMediaService.updateOne(id, data);
      },
      deleteOneCustomerGenerationMedia: async (root: any, args: any, context: Context) => {
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        const { id } = args;
        const media = await customerGenerationMediaService.findOne({ _id: id });
        if (context.isCustomer && media?.customerId !== context.id) {
          throw new Error("Không có quyền truy cập");
        }
        return await customerGenerationMediaService.deleteOne(id);
      },
    },
  },
};
