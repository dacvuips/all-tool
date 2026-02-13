import { gql } from "apollo-server-express";
import { ActionType } from "../../../libs/shared/interfaces/action.interface";

export default {
  schema: gql`
    type Action {
      "Loại hành động ${Object.values(ActionType)}"
      type: String
      "Đường dẫn website"
      link: String
      "Mã bài đăng"
      postId: ID
    }
    input ActionInput {
      "Loại hành động ${Object.values(ActionType)}"
      type: String!
      "Đường dẫn website"
      link: String
      "Mã bài đăng"
      postId: ID
    }
  `,
  resolver: {},
};
