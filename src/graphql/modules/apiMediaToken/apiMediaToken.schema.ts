import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllApiMediaToken(q: QueryGetListInput): ApiMediaTokenPageData
    getOneApiMediaToken(id: ID!): ApiMediaToken
    getMyApiMediaTokens(q: QueryGetListInput): ApiMediaTokenPageData
    # Add Query
  }

  extend type Mutation {
    createApiMediaToken(data: CreateApiMediaTokenInput!): ApiMediaToken
    updateApiMediaToken(id: ID!, data: UpdateApiMediaTokenInput!): ApiMediaToken
    deleteOneApiMediaToken(id: ID!): ApiMediaToken
    createMyApiMediaToken: ApiMediaToken
    toggleMyApiMediaTokenActive(id: ID!): ApiMediaToken
    # Add Mutation
  }

  input CreateApiMediaTokenInput {
    "API Key"
    key: String!
    "Số lượng request cho phép"
    requestQuantity: Int
    "Ngày hết hạn"
    expiredDate: DateTime
    "ID khách hàng"
    customerId: ID
    "Trạng thái kích hoạt"
    active: Boolean
    subscriptionPlan: String
    "Số luồng request đồng thời (-1 = không giới hạn)"
    streamCount: Int
  }

  input UpdateApiMediaTokenInput {
    "API Key"
    key: String
    "Số lượng request cho phép"
    requestQuantity: Int
    "Ngày hết hạn"
    expiredDate: DateTime
    "Trạng thái kích hoạt"
    active: Boolean
    "Số lượng đã sử dụng"
    usedQuantity: Int
    "Gói đăng ký"
    subscriptionPlan: String
    "Số luồng request đồng thời (-1 = không giới hạn)"
    streamCount: Int
  }

  type ApiMediaToken {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "API Key"
    key: String
    "Số lượng request cho phép"
    requestQuantity: Int
    "Ngày hết hạn"
    expiredDate: DateTime
    "ID khách hàng"
    customerId: String
    "Trạng thái kích hoạt"
    active: Boolean
    "Số lượng đã sử dụng"
    usedQuantity: Int
    "Gói đăng ký"
    subscriptionPlan: String
    "Số luồng request đồng thời (-1 = không giới hạn)"
    streamCount: Int
  }

  type ApiMediaTokenPageData {
    data: [ApiMediaToken]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
