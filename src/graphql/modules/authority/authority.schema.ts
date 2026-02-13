import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllAuthority(q: QueryGetListInput): AuthorityPageData
    getOneAuthority(id: ID!): Authority
    # Add Query
  }

  extend type Mutation {
    createAuthority(data: CreateAuthorityInput!): Authority
    updateAuthority(id: ID!, data: UpdateAuthorityInput!): Authority
    deleteOneAuthority(id: ID!): Authority
    # Add Mutation
  }

  input CreateAuthorityInput {
    name: String!
    parentId: ID!
    code: String
    status: String
  }

  input UpdateAuthorityInput {
    name: String
    scopes: [String]
    code: String
    status: String
  }

  type Authority {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Tên phân quyền"
    name: String
    "Phạm vi phân quyền"
    scopes: [String]
    "Phân quyền gốc"
    root: Boolean
    "Phân quyền cha"
    parentIds: [ID]
    "ID người tạo phân quyền"
    creatorId: String
    "Người tạo phân quyền"
    creator: User
    "Trạng thái phân quyền"
    status: String
    "Mã phân quyền"
    code: String
  }

  type AuthorityPageData {
    data: [Authority]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
