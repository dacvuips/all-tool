import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllArtStyle(q: QueryGetListInput): ArtStylePageData
    getOneArtStyle(id: ID!): ArtStyle
    "Lấy prompt của art style theo ID (dành cho customer)"
    getArtStylePromptById(id: ID!): ArtStylePromptResult
    "Lấy danh sách art style do chính customer hiện tại tạo"
    getCustomerArtStyleList(q: QueryGetListInput): ArtStylePageData
    # Add Query
  }

  extend type Mutation {
    createArtStyle(data: CreateArtStyleInput!): ArtStyle
    updateArtStyle(id: ID!, data: UpdateArtStyleInput!): ArtStyle
    deleteOneArtStyle(id: ID!): ArtStyle
    "Customer tạo art style mới (tự động gán customerId)"
    createCustomerArtStyle(data: CreateCustomerArtStyleInput!): ArtStyle
    "Customer sửa art style của mình"
    updateCustomerArtStyle(id: ID!, data: UpdateCustomerArtStyleInput!): ArtStyle
    "Customer xoá art style của mình"
    deleteCustomerArtStyle(id: ID!): ArtStyle
    # Add Mutation
  }

  input CreateCustomerArtStyleInput {
    "Tên art style"
    name: String!
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Mô tả"
    des: String
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Danh sách ID danh mục art style"
    artStyleCategoryIds: [ID]
    "Giá"
    price: Float
  }

  input UpdateCustomerArtStyleInput {
    "Tên art style"
    name: String
    "Danh sách URL ảnh"
    imageUrls: [String]
    "Prompt mô tả"
    prompt: String
    "Mô tả"
    des: String
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Danh sách ID danh mục art style"
    artStyleCategoryIds: [ID]
    "Giá"
    price: Float
  }

  input CreateArtStyleInput {
    "Tên art style"
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
    "Danh sách ID danh mục art style"
    artStyleCategoryIds: [ID]
    "Giá"
    price: Float
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Số lượt sử dụng theo tháng"
    monthlyCount: Int
    "Mô tả"
    des: String
  }

  input UpdateArtStyleInput {
    "Tên art style"
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
    "Danh sách ID danh mục art style"
    artStyleCategoryIds: [ID]
    "Giá"
    price: Float
    "Trạng thái xuất bản"
    isPublish: Boolean
    "Số lượt sử dụng theo tháng"
    monthlyCount: Int
    "Mô tả"
    des: String
  }

  type ArtStyle {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Tên art style"
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
    "Danh sách ID danh mục art style"
    artStyleCategoryIds: [ID]
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
  }

  type ArtStylePageData {
    data: [ArtStyle]
    total: Int
    pagination: Pagination
  }

  "Kết quả trả về prompt của art style"
  type ArtStylePromptResult {
    id: String
    prompt: String
  }
`;

export default schema;
