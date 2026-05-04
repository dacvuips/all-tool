import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllObjectToPersonify(q: QueryGetListInput): ObjectToPersonifyPageData
    getOneObjectToPersonify(id: ID!): ObjectToPersonify
    "Lấy danh sách nhân vật nhân hoá đang active (dành cho customer)"
    getActiveObjectToPersonifyList: [ObjectToPersonifyPublic]
    # Add Query
  }

  extend type Mutation {
    createObjectToPersonify(data: CreateObjectToPersonifyInput!): ObjectToPersonify
    updateObjectToPersonify(id: ID!, data: UpdateObjectToPersonifyInput!): ObjectToPersonify
    deleteOneObjectToPersonify(id: ID!): ObjectToPersonify
    # Add Mutation
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
