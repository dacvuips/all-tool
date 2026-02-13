import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../../constants/role.const";
import { t } from "../../../../helpers/functions/string";
import { Context } from "../../../../libs/graphql";
import { AccessCustomer } from "../../../../libs/usecases/customer/access-customer/access-customer.usecase";

export default {
  schema: gql`
    extend type Mutation {
      accessCustomer: Mixed
    }
  `,
  resolver: {
    Mutation: {
      accessCustomer: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.SHOP_SHOP_STAFF);

        const command = AccessCustomer.Command.create({
          shopToken: context.xToken,
        });

        const result = await AccessCustomer.usecase.execute(command);

        context.setAccessToken(result.accessToken);

        return {
          message: t("Thành công"),
        };
      },
    },
  },
};
