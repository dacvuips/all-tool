import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllRecaptchaToken(q: QueryGetListInput): RecaptchaTokenPageData
    getOneRecaptchaToken(id: ID!): RecaptchaToken
    getMyRecaptchaTokens(q: QueryGetListInput): RecaptchaTokenPageData
    # Add Query
  }

  extend type Mutation {
    createRecaptchaToken(data: CreateRecaptchaTokenInput!): RecaptchaToken
    updateRecaptchaToken(id: ID!, data: UpdateRecaptchaTokenInput!): RecaptchaToken
    deleteOneRecaptchaToken(id: ID!): RecaptchaToken
    createMyRecaptchaToken: RecaptchaToken
    # Add Mutation
  }

  input CreateRecaptchaTokenInput {
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
  }

  input UpdateRecaptchaTokenInput {
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
  }

  type RecaptchaToken {
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
  }

  type RecaptchaTokenPageData {
    data: [RecaptchaToken]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
