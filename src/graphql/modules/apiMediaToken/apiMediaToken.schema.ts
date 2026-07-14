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
    rotateMyApiMediaToken(id: ID!): RotateApiMediaTokenResult
    toggleMyApiMediaTokenActive(id: ID!): ApiMediaToken
    # Add Mutation
  }

  input CreateApiMediaTokenInput {
    "API Key (để trống để hệ thống tự sinh)"
    key: String
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

    "API Key (null nếu đã hash — dùng rotate để lấy key mới)"
    key: String
    "Prefix hiển thị khi key đã hash"
    keyPrefix: String
    "Số lượng request cho phép"
    requestQuantity: Int
    "Ngày hết hạn"
    expiredDate: DateTime
    "ID khách hàng"
    customerId: String
    "Khách hàng"
    customer: Customer
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

  type RotateApiMediaTokenResult {
    "Key mới — chỉ hiển thị một lần, hãy lưu ngay"
    plainKey: String!
    token: ApiMediaToken!
  }
`;

export default schema;
