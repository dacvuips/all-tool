import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllArtStyleCategory(q: QueryGetListInput): ArtStyleCategoryPageData
    getOneArtStyleCategory(id: ID!): ArtStyleCategory
    "Lấy danh sách danh mục art style đang active (dành cho customer)"
    getActiveArtStyleCategoryList: [ArtStyleCategoryPublic]
    "Lấy danh sách art style theo category ID, có phân trang"
    getArtStylesByCategoryId(q: QueryGetListInput): ArtStylePageData
    # Add Query
  }

  extend type Mutation {
    createArtStyleCategory(data: CreateArtStyleCategoryInput!): ArtStyleCategory
    updateArtStyleCategory(id: ID!, data: UpdateArtStyleCategoryInput!): ArtStyleCategory
    deleteOneArtStyleCategory(id: ID!): ArtStyleCategory
    # Add Mutation
  }

  input CreateArtStyleCategoryInput {
    "Tên danh mục art style"
    name: String!
    "Đánh dấu HOT"
    isHot: Boolean
    "Trạng thái hoạt động"
    isActive: Boolean
    "Danh sách Art Style IDs"
    artStyleIds: [ID]
    "Thứ tự ưu tiên"
    priority: Int
  }

  input UpdateArtStyleCategoryInput {
    "Tên danh mục art style"
    name: String
    "Đánh dấu HOT"
    isHot: Boolean
    "Trạng thái hoạt động"
    isActive: Boolean
    "Danh sách Art Style IDs"
    artStyleIds: [ID]
    "Thứ tự ưu tiên"
    priority: Int
  }

  type ArtStyleCategory {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Tên danh mục art style"
    name: String
    "Đánh dấu HOT"
    isHot: Boolean
    "Trạng thái hoạt động"
    isActive: Boolean
    "Danh sách Art Style IDs"
    artStyleIds: [ID]
    "Thứ tự ưu tiên"
    priority: Int
  }

  type ArtStyleCategoryPageData {
    data: [ArtStyleCategory]
    total: Int
    pagination: Pagination
  }

  "Thông tin công khai cho customer"
  type ArtStyleCategoryPublic {
    id: String
    "Tên danh mục art style"
    name: String
    "Đánh dấu HOT"
    isHot: Boolean
    "Thứ tự ưu tiên"
    priority: Int
    "Danh sách art style đã resolve"
    artStyleItems: [ArtStylePublic]
  }

  "Thông tin art style công khai cho customer"
  type ArtStylePublic {
    id: String
    "Tên art style"
    name: String
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Số lượt sử dụng"
    count: Int
  }

  "Kết quả phân trang art style theo category"
  type ArtStylesByCategoryResult {
    data: [ArtStylePublic]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
