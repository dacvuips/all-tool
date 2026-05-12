import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllTrendingCategory(q: QueryGetListInput): TrendingCategoryPageData
    getOneTrendingCategory(id: ID!): TrendingCategory
    "Lấy danh sách danh mục trending đang active (dành cho customer)"
    getActiveTrendingCategoryList: [TrendingCategoryPublic]
    "Lấy danh sách trending theo category ID, có phân trang"
    getTrendingsByCategoryId(q: QueryGetListInput): TrendingPageData
    # Add Query
  }

  extend type Mutation {
    createTrendingCategory(data: CreateTrendingCategoryInput!): TrendingCategory
    updateTrendingCategory(id: ID!, data: UpdateTrendingCategoryInput!): TrendingCategory
    deleteOneTrendingCategory(id: ID!): TrendingCategory
    # Add Mutation
  }

  input CreateTrendingCategoryInput {
    "Tên danh mục trending"
    name: String!
    "Đánh dấu HOT"
    isHot: Boolean
    "Trạng thái hoạt động"
    isActive: Boolean
    "Danh sách Trending IDs"
    trendingIds: [ID]
    "Thứ tự ưu tiên"
    priority: Int
  }

  input UpdateTrendingCategoryInput {
    "Tên danh mục trending"
    name: String
    "Đánh dấu HOT"
    isHot: Boolean
    "Trạng thái hoạt động"
    isActive: Boolean
    "Danh sách Trending IDs"
    trendingIds: [ID]
    "Thứ tự ưu tiên"
    priority: Int
  }

  type TrendingCategory {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Tên danh mục trending"
    name: String
    "Đánh dấu HOT"
    isHot: Boolean
    "Trạng thái hoạt động"
    isActive: Boolean
    "Danh sách Trending IDs"
    trendingIds: [ID]
    "Thứ tự ưu tiên"
    priority: Int
  }

  type TrendingCategoryPageData {
    data: [TrendingCategory]
    total: Int
    pagination: Pagination
  }

  "Thông tin công khai cho customer"
  type TrendingCategoryPublic {
    id: String
    "Tên danh mục trending"
    name: String
    "Đánh dấu HOT"
    isHot: Boolean
    "Thứ tự ưu tiên"
    priority: Int
    "Danh sách trending đã resolve"
    trendingItems: [TrendingPublic]
  }

  "Thông tin trending công khai cho customer"
  type TrendingPublic {
    id: String
    "Tên trending"
    name: String
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Số lượt sử dụng"
    count: Int
  }

  "Kết quả phân trang trending theo category"
  type TrendingsByCategoryResult {
    data: [TrendingPublic]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
