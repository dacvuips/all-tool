import { gql } from "apollo-server-express";
import { BannerActionType } from "../../../libs/dal/banner/banner.interface";

const schema = gql`
  extend type Query {
    getAllBanner(q: QueryGetListInput): BannerPageData
    getOneBanner(id: ID!): Banner
    # Add Query
  }

  extend type Mutation {
    createBanner(data: CreateBannerInput!): Banner
    updateBanner(id: ID!, data: UpdateBannerInput!): Banner
    deleteOneBanner(id: ID!): Banner
    # Add Mutation
  }

  input CreateBannerInput {
    "Hình ảnh"
    image: String
    "Tiêu đề"
    title: String
    "Mô tả tiêu đề"
    subtitle: String
    "Loại hành động ${Object.values(BannerActionType)}"
    actionType: String
    "Đường dẫn website"
    link: String
    "Mã sản phẩm"
    productId: ID
    "Mã voucher"
    voucherId: ID
    "Hiển thị công khai"
    isPublic: Boolean
    "Ưu tiên"
    priority: Int
    "Mã cửa hàng "
    memberId: ID
    "Vi tri banner"
    position: String
    "Loại banner"
    type:String
  }

  input UpdateBannerInput {
    "Hình ảnh"
    image: String
    "Tiêu đề"
    title: String
    "Mô tả tiêu đề"
    subtitle: String
    "Loại hành động ${Object.values(BannerActionType)}"
    actionType: String
    "Đường dẫn website"
    link: String
    "Mã sản phẩm"
    productId: ID
    "Mã voucher"
    voucherId: ID
    "Hiển thị công khai"
    isPublic: Boolean
    "Ưu tiên"
    priority: Int
    "Mã cửa hàng "
    memberId: ID
    "Vi tri banner"
    position: String
    "Loại banner"
    type:String
  }

  type Banner {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Hình ảnh"
    image: String
    "Tiêu đề"
    title: String
    "Mô tả tiêu đề"
    subtitle: String
    "Loại hành động ${Object.values(BannerActionType)}"
    actionType: String
    "Đường dẫn website"
    link: String
    "Mã sản phẩm"
    productId: ID
    "Mã voucher"
    voucherId: ID
    "Hiển thị công khai"
    isPublic: Boolean
    "Ưu tiên"
    priority: Int
    "Mã cửa hàng "
    memberId: ID
    "Vi tri banner"
    position: String

    # shop: Shop
    # product: Product
    # voucher: ShopVoucher
   "Loại banner"
   type: String
  }

  type BannerPageData {
    data: [Banner]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
