import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllPostViewLog(q: QueryGetListInput): PostViewLogPageData
    # Add Query
  }

  type PostViewLog {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Mã post"
    postId: ID
    "Mã người dùng"
    userId: ID
    "Lượt view"
    view: Int
  }

  type PostViewLogPageData {
    data: [PostViewLog]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
