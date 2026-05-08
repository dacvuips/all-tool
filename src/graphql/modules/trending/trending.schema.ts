import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllTrending(q: QueryGetListInput): TrendingPageData
    getOneTrending(id: ID!): Trending
    # Add Query
  }

  extend type Mutation {
    createTrending(data: CreateTrendingInput!): Trending
    updateTrending(id: ID!, data: UpdateTrendingInput!): Trending
    deleteOneTrending(id: ID!): Trending
    # Add Mutation
  }

  input CreateTrendingInput {
    "Tên trending"
    name: String!
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Trạng thái hoạt động"
    isActive: Boolean
    "ID khách hàng sở hữu"
    customerId: ID
    "Số lượt sử dụng"
    count: Int
    "Danh sách ID danh mục trending"
    trendingCategoryIds: [ID]
    "Giá"
    price: Float
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Số lượt sử dụng theo tháng"
    monthlyCount: Int
    "Mô tả"
    des: String
  }

  input UpdateTrendingInput {
    "Tên trending"
    name: String
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Trạng thái hoạt động"
    isActive: Boolean
    "ID khách hàng sở hữu"
    customerId: ID
    "Số lượt sử dụng"
    count: Int
    "Danh sách ID danh mục trending"
    trendingCategoryIds: [ID]
    "Giá"
    price: Float
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Số lượt sử dụng theo tháng"
    monthlyCount: Int
    "Mô tả"
    des: String
  }

  type Trending {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Tên trending"
    name: String
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Trạng thái hoạt động"
    isActive: Boolean
    "ID khách hàng sở hữu"
    customerId: ID
    "Số lượt sử dụng"
    count: Int
    "Danh sách ID danh mục trending"
    trendingCategoryIds: [ID]
    "Giá"
    price: Float
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Số lượt sử dụng theo tháng"
    monthlyCount: Int
    "Mô tả"
    des: String
  }

  type TrendingPageData {
    data: [Trending]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
