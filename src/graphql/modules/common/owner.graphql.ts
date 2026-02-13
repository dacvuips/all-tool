import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { OwnerType } from "../../../libs/shared/interfaces/owner.interface";

export default {
  schema: gql`
    type Owner {
      "Mã người dùng"
      id: ID
      "Loại người dùng ${Object.values(OwnerType)}",
      type: String
      "Tên"
      name: String
      "Email"
      email: String
      "Điện thoại"
      phone: String
      "Vai trò"
      role: String
    }
  `,
  resolver: {
    Owner: {
      id: (root: any, args: any, context: Context) => root._id.toString(),
    },
  },
};
