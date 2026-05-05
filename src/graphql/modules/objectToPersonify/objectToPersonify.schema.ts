import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllObjectToPersonify(q: QueryGetListInput): ObjectToPersonifyPageData
    getOneObjectToPersonify(id: ID!): ObjectToPersonify
    "Lấy danh sách nhân vật nhân hoá đang active (dành cho customer)"
    getActiveObjectToPersonifyList: [ObjectToPersonifyPublic]
    "Lấy danh sách nhân vật tùy chỉnh của customer hiện tại"
    getCustomerObjectToPersonifyList: [ObjectToPersonifyPublic]
    # Add Query
  }

  extend type Mutation {
    createObjectToPersonify(data: CreateObjectToPersonifyInput!): ObjectToPersonify
    updateObjectToPersonify(id: ID!, data: UpdateObjectToPersonifyInput!): ObjectToPersonify
    deleteOneObjectToPersonify(id: ID!): ObjectToPersonify
    "Customer tạo nhân vật tùy chỉnh (tự động gán customerId)"
    createCustomerObjectToPersonify(data: CreateCustomerObjectToPersonifyInput!): ObjectToPersonifyPublic
    "Customer xoá nhân vật tùy chỉnh của mình"
    deleteCustomerObjectToPersonify(id: ID!): ObjectToPersonifyPublic
    # Add Mutation
  }

  input CreateCustomerObjectToPersonifyInput {
    "Tên nhân vật nhân hoá"
    name: String!
    "Prompt mô tả nhân vật"
    prompt: String
    "URL ảnh đại diện"
    imageUrl: String
  }

  input CreateObjectToPersonifyInput {
    "Tên nhân vật nhân hoá"
    name: String!
    "Prompt mô tả nhân vật"
    prompt: String
    "URL ảnh đại diện"
    imageUrl: String
    "Mã code định danh (unique)"
    code: String!
    "Trạng thái hoạt động"
    isActive: Boolean
    "ID khách hàng sở hữu"
    customerId: ID
  }

  input UpdateObjectToPersonifyInput {
    "Tên nhân vật nhân hoá"
    name: String
    "Prompt mô tả nhân vật"
    prompt: String
    "URL ảnh đại diện"
    imageUrl: String
    "Mã code định danh (unique)"
    code: String
    "Trạng thái hoạt động"
    isActive: Boolean
    "ID khách hàng sở hữu"
    customerId: ID
  }

  "Đầy đủ thông tin (admin/staff)"
  type ObjectToPersonify {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Tên nhân vật nhân hoá"
    name: String
    "Prompt mô tả nhân vật"
    prompt: String
    "URL ảnh đại diện"
    imageUrl: String
    "Mã code định danh"
    code: String
    "Trạng thái hoạt động"
    isActive: Boolean
    "ID khách hàng sở hữu"
    customerId: ID
  }

  "Thông tin công khai cho customer (KHÔNG có prompt)"
  type ObjectToPersonifyPublic {
    id: String
    "Tên nhân vật nhân hoá"
    name: String
    "URL ảnh đại diện"
    imageUrl: String
    "Mã code định danh"
    code: String
    "Trạng thái hoạt động"
    isActive: Boolean
  }

  type ObjectToPersonifyPageData {
    data: [ObjectToPersonify]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
