import { gql } from "apollo-server-express";
import { Schema } from "mongoose";
import { CustomerLoader } from "../../../libs/dal/customer";
import { UserLoader } from "../../../libs/dal/user";
import { GraphqlResolver } from "../../graphqlResolver";

export const ThreadSenderSchema = new Schema({
  role: { type: String, required: true },
  staffId: { type: Schema.Types.ObjectId },
  shopId: { type: Schema.Types.ObjectId },
  customerId: { type: Schema.Types.ObjectId },
});
export default {
  schema: gql`
    type ThreadSender {
      "Loại người dùng"
      role: String
      "Mã quản lý"
      staffId: ID
      "Mã cửa hàng"
      shopId: ID
      "Mã khách hàng"
      customerId: ID

      staff: User
      customer: Customer
    }
  `,
  resolver: {
    ThreadSender: {
      staff: GraphqlResolver.loadById(UserLoader, "staffId"),
      customer: GraphqlResolver.loadById(CustomerLoader, "customerId"),
    },
  },
};
