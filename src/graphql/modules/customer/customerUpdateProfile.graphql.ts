import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { CustomerUpdateProfileCommand, customerUpdateProfileUsecase } from "../../../libs/usecases";

export default {
  schema: gql`
    extend type Mutation {
      customerUpdateProfile(input: CustomerUpdateProfileInput!): Mixed
    }

    input CustomerUpdateProfileInput {
      "Tên"
      name: String
      "Địa chỉ"
      address: String
      "Ảnh đại diện"
      avatarUrl: String
      "Tỉnh/Thành phố"
      province: String
      "Quận/Huyện"
      district: String
      "Phường/Xã"
      ward: String
    }
  `,
  resolver: {
    Mutation: {
      customerUpdateProfile: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);
        return await customerUpdateProfileUsecase.execute(
          CustomerUpdateProfileCommand.create({
            customerId: context.id,
            ...args.input,
          })
        );
      },
    },
  },
};
