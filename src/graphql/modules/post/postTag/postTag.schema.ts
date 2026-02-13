import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllPostTag(q: QueryGetListInput): PostTagPageData
    getOnePostTag(id: ID!): PostTag
    # Add Query
  }

  extend type Mutation {
    createPostTag(data: CreatePostTagInput!): PostTag
    updatePostTag(id: ID!, data: UpdatePostTagInput!): PostTag
    deleteOnePostTag(id: ID!): PostTag
    # Add Mutation
  }

  input CreatePostTagInput {
    "Tên tag"
    name: String!
    "Từ khoá"
    slug: String
    "Mô tả"
    description: String
    "Mã màu"
    accentColor: String
    "Hình ảnh đại diện"
    featureImage: String
  }

  input UpdatePostTagInput {
    "Tên tag"
    name: String
    "Từ khoá"
    slug: String
    "Mô tả"
    description: String
    "Mã màu"
    accentColor: String
    "Hình ảnh đại diện"
    featureImage: String
  }

  type PostTag {
    id: String    
    createdAt: DateTime
    updatedAt: DateTime

    "Tên tag"
    name: String
    "Từ khoá"
    slug: String
    "Mô tả"
    description: String
    "Mã màu"
    accentColor: String
    "Hình ảnh đại diện"
    featureImage: String
  }

  type PostTagPageData {
    data: [PostTag]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
