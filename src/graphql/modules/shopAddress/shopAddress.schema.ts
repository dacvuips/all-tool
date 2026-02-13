import { gql } from "apollo-server-express";

/**
 * GraphQL Schema cho ShopAddress
 * Định nghĩa các type, query, mutation cho địa chỉ cửa hàng
 */
export default gql`
  extend type Query {
    """
    Lấy danh sách tất cả địa chỉ cửa hàng
    """
    getAllShopAddress(q: QueryGetListInput): ShopAddressPageData

    """
    Lấy thông tin một địa chỉ cửa hàng
    """
    getOneShopAddress(id: ID!): ShopAddress

    """
    Lấy địa chỉ mặc định
    """
    getDefaultShopAddress: ShopAddress
  }

  extend type Mutation {
    """
    Tạo địa chỉ cửa hàng mới
    """
    createShopAddress(data: CreateShopAddressInput!): ShopAddress

    """
    Cập nhật địa chỉ cửa hàng
    """
    updateShopAddress(id: ID!, data: UpdateShopAddressInput!): ShopAddress

    """
    Xóa địa chỉ cửa hàng (soft delete)
    """
    deleteOneShopAddress(id: ID!): ShopAddress

    """
    Set địa chỉ làm mặc định
    """
    setDefaultShopAddress(id: ID!): ShopAddress
  }

  """
  Type cho địa chỉ cửa hàng
  """
  type ShopAddress {
    id: String
    recipientName: String
    phone: String
    email: String
    address: String
    ward: String
    district: String
    province: String
    country: String
    postalCode: String
    note: String
    default: Boolean
    isActive: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }

  """
  Input cho việc tạo địa chỉ cửa hàng
  """
  input CreateShopAddressInput {
    recipientName: String!
    phone: String!
    email: String
    address: String!
    ward: String
    district: String
    province: String
    country: String
    postalCode: String
    note: String
    default: Boolean
    isActive: Boolean
  }

  """
  Input cho việc cập nhật địa chỉ cửa hàng
  """
  input UpdateShopAddressInput {
    recipientName: String
    phone: String
    email: String
    address: String
    ward: String
    district: String
    province: String
    country: String
    postalCode: String
    note: String
    default: Boolean
    isActive: Boolean
  }

  """
  Pagination data cho danh sách địa chỉ cửa hàng
  """
  type ShopAddressPageData {
    data: [ShopAddress]
    total: Int
    pagination: Pagination
  }
`;
