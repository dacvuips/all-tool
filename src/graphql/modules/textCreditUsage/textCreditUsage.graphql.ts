import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { textCreditUsageService } from "../../../libs/dal/textCreditUsage";
import { Context } from "../../../libs/graphql";
import { microxFetch } from "../../../routers/app/voice/_microx";

export default {
  schema: gql`
    extend type Query {
      getAllTextCreditUsage(q: QueryGetListInput): TextCreditUsagePageData
      getOneTextCreditUsage(id: ID!): TextCreditUsage
      getMicroxVoiceAccount: MicroxVoiceAccount
    }

    type TextCreditUsage {
      id: String
      createdAt: DateTime
      updatedAt: DateTime
      customerId: String
      customerCode: String
      jobId: String
      tool: String
      amount: Int
      microxAmount: Float
      textCreditCountAfter: Int
      textCreditLimit: Int
      description: String
    }

    type TextCreditUsagePageData {
      data: [TextCreditUsage]
      total: Int
      pagination: Pagination
    }

    type MicroxVoiceAccount {
      credits: Float
      email: String
      name: String
    }
  `,
  resolver: {
    Query: {
      getAllTextCreditUsage: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-1"]]);
        return textCreditUsageService.fetch(args.q, {
          disableTextSearch: true,
          textSearchField: "customerCode",
        });
      },
      getOneTextCreditUsage: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-1"]]);
        return textCreditUsageService.findOne({ _id: args.id });
      },
      getMicroxVoiceAccount: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-1"]]);
        const { data } = await microxFetch("/account");
        const account = data?.data && typeof data.data === "object" ? data.data : data;
        const credits = Number(account?.credits ?? account?.balance ?? account?.credit);
        return {
          credits: Number.isFinite(credits) ? credits : null,
          email: account?.email ? String(account.email) : null,
          name: account?.name ? String(account.name) : null,
        };
      },
    },
  },
};
