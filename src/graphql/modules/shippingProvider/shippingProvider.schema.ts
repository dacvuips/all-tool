import { gql } from "apollo-server-express";

/**
 * GraphQL Schema cho nhà cung cấp vận chuyển
 */
const schema = gql`
  extend type Query {
    # Lấy danh sách tất cả nhà cung cấp vận chuyển với phân trang
    getAllShippingProvider(q: QueryGetListInput): ShippingProviderPageData

    # Lấy chi tiết một nhà cung cấp theo ID
    getOneShippingProvider(id: ID!): ShippingProvider

    # Lấy danh sách nhà cung cấp đang hoạt động
    getActiveShippingProviders: [ShippingProvider]

    # Lấy nhà cung cấp theo mã code
    getShippingProviderByCode(code: String!): ShippingProvider
  }

  extend type Mutation {
    # Tạo mới nhà cung cấp vận chuyển
    createShippingProvider(data: CreateShippingProviderInput!): ShippingProvider

    # Cập nhật thông tin nhà cung cấp
    updateShippingProvider(id: ID!, data: UpdateShippingProviderInput!): ShippingProvider

    # Xóa nhà cung cấp
    deleteOneShippingProvider(id: ID!): ShippingProvider
  }

  # Input cho tạo mới nhà cung cấp
  input CreateShippingProviderInput {
    code: String! # Mã nhà cung cấp (VD: GHN, GHTK)
    name: String! # Tên nhà cung cấp
    isActive: Boolean # Trạng thái hoạt động
    apiConfig: ApiConfigInput! # Cấu hình API
    services: [ShippingServiceInput!] # Danh sách dịch vụ
    description: String # Mô tả
    logo: String # Logo
    priority: Int # Độ ưu tiên
  }

  # Input cho cập nhật nhà cung cấp
  input UpdateShippingProviderInput {
    code: String
    name: String
    isActive: Boolean
    apiConfig: ApiConfigInput
    services: [ShippingServiceInput!]
    description: String
    logo: String
    priority: Int
  }

  # Input cho cấu hình API
  input ApiConfigInput {
    baseUrl: String! # URL gốc của API
    token: String! # Token xác thực
    shopId: String # ID shop
    apiKey: String # API key bổ sung
    metadata: Mixed # Metadata
  }

  # Input cho dịch vụ vận chuyển
  input ShippingServiceInput {
    serviceCode: String # Mã dịch vụ
    serviceName: String! # Tên dịch vụ
    isActive: Boolean # Trạng thái
    estimatedTime: String # Thời gian ước tính
    description: String # Mô tả
    metadata: Mixed # Metadata
  }

  # Type cho nhà cung cấp vận chuyển
  type ShippingProvider {
    id: String
    code: String # Mã nhà cung cấp
    name: String # Tên nhà cung cấp
    isActive: Boolean # Trạng thái hoạt động
    apiConfig: ApiConfig # Cấu hình API
    services: [ShippingService] # Danh sách dịch vụ
    description: String # Mô tả
    logo: String # Logo
    priority: Int # Độ ưu tiên
    createdAt: DateTime # Ngày tạo
    updatedAt: DateTime # Ngày cập nhật
  }

  # Type cho cấu hình API
  type ApiConfig {
    baseUrl: String # URL gốc
    token: String # Token (được ẩn bớt khi trả về)
    shopId: String # ID shop
    apiKey: String # API key
    metadata: Mixed # Metadata
  }

  # Type cho dịch vụ vận chuyển
  type ShippingService {
    serviceCode: String # Mã dịch vụ
    serviceName: String # Tên dịch vụ
    isActive: Boolean # Trạng thái
    estimatedTime: String # Thời gian ước tính
    description: String # Mô tả
    metadata: Mixed # Metadata
  }

  # Type cho phân trang
  type ShippingProviderPageData {
    data: [ShippingProvider]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
