import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllTrending(q: QueryGetListInput): TrendingPageData
    getOneTrending(id: ID!): Trending
    "Lấy prompt của trending theo ID (dành cho customer)"
    getTrendingPromptById(id: ID!): TrendingPromptResult
    "Lấy danh sách trending do chính customer hiện tại tạo (type PROMPT)"
    getCustomerTrendingList(q: QueryGetListInput): TrendingPageData
    "Lấy danh sách chatbot do chính customer hiện tại tạo (type CHATBOT)"
    getCustomerChatbotList(q: QueryGetListInput): TrendingPageData
    # Add Query
  }

  extend type Mutation {
    createTrending(data: CreateTrendingInput!): Trending
    updateTrending(id: ID!, data: UpdateTrendingInput!): Trending
    deleteOneTrending(id: ID!): Trending
    "Customer tạo trending mới (tự động gán customerId, type PROMPT)"
    createCustomerTrending(data: CreateCustomerTrendingInput!): Trending
    "Customer sửa trending của mình (type PROMPT)"
    updateCustomerTrending(id: ID!, data: UpdateCustomerTrendingInput!): Trending
    "Customer xoá trending của mình (type PROMPT)"
    deleteCustomerTrending(id: ID!): Trending
    "Customer tạo chatbot mới (tự động gán customerId, type CHATBOT)"
    createCustomerChatbot(data: CreateCustomerChatbotInput!): Trending
    "Customer sửa chatbot của mình (type CHATBOT)"
    updateCustomerChatbot(id: ID!, data: UpdateCustomerChatbotInput!): Trending
    "Customer xoá chatbot của mình (type CHATBOT)"
    deleteCustomerChatbot(id: ID!): Trending
    # Add Mutation
  }

  input CreateCustomerTrendingInput {
    "Tên trending"
    name: String!
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Mô tả"
    des: String
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Danh sách ID danh mục trending"
    trendingCategoryIds: [ID]
    "Giá"
    price: Float
  }

  input UpdateCustomerTrendingInput {
    "Tên trending"
    name: String
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Mô tả"
    des: String
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Danh sách ID danh mục trending"
    trendingCategoryIds: [ID]
    "Giá"
    price: Float
  }

  input CreateCustomerChatbotInput {
    "Tên chatbot"
    name: String!
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Mô tả"
    des: String
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Danh sách ID danh mục trending"
    trendingCategoryIds: [ID]
    "Giá"
    price: Float
  }

  input UpdateCustomerChatbotInput {
    "Tên chatbot"
    name: String
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Mô tả"
    des: String
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Danh sách ID danh mục trending"
    trendingCategoryIds: [ID]
    "Giá"
    price: Float
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
    "Loại"
    type: TrendingTypeEnum
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
    "Loại"
    type: TrendingTypeEnum
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
    "Prompt ngắn (150 ký tự đầu)"
    promptShort: String
    "Loại"
    type: TrendingTypeEnum
  }

  enum TrendingTypeEnum {
    CHATBOT
    PROMPT
  }
  type TrendingPageData {
    data: [Trending]
    total: Int
    pagination: Pagination
  }

  "Kết quả trả về prompt của trending"
  type TrendingPromptResult {
    id: String
    prompt: String
  }
`;

export default schema;
