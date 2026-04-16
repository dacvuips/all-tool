import { gql } from "apollo-server-express";

const schema = gql`
  enum SubscriptionPlanEnum {
    Free
    Trial
    Basic
    Standard
    Professional
    Unlimited
  }

  extend type Query {
    getAllCustomer(q: QueryGetListInput): CustomerPageData
    getOneCustomer(id: ID!): Customer
    # Add Query
  }

  extend type Mutation {
    updateCustomer(id: ID!, data: UpdateCustomerInput!): Customer
    deleteOneCustomer(id: ID!): Customer
    # Add Mutation
  }

  input UpdateCustomerInput {
    name: String
    status: String
    "Địa chỉ"
    address: String
    "Số điện thoại"
    phoneNumber: String
    "Email"
    email: String
    "Ảnh đại diện"
    avatarUrl: String
    "Ngày sinh"
    birthday: DateTime
    "Điểm thưởng"
    rewardPoint: Int

    "Tỉnh/Thành phố"
    province: String
    "Quận/Huyện"
    district: String
    "Phường/Xã"
    ward: String
    "Gói Google"
    googlePackage: GooglePackageInput
  }

  type Customer {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Mã khách hàng"
    code: String
    "Tên khách hàng"
    name: String
    "Mã UID Firebase"
    uid: String
    "Số điện thoại"
    phoneNumber: String
    "Email"
    email: String
    "Địa chỉ"
    address: String
    "Ảnh đại diện"
    avatarUrl: String
    "Trạng thái"
    status: String
    "Ngày sinh"
    birthday: DateTime
    "Lần mua hàng"
    times: CustomerTimes
    "Điểm thưởng"
    rewardPoint: Int
    "Ngân hàng đã xác thực"
    bankVerifiedId: String
    "Có thưởng"
    hasReward: Boolean
    "Giới thiệu"
    intro: CustomerIntro
    "Tỉnh/Thành phố"
    province: String
    "Quận/Huyện"
    district: String
    "Phường/Xã"
    ward: String
    "Gói Google"
    googlePackage: GooglePackage
  }
  type CustomerIntro {
    "Đơn hàng"
    order: Boolean
    "Thẻ game"
    card: Boolean
  }
  type CustomerTimes {
    "Thời gian đăng ký"
    registedAt: DateTime
    "Thời gian đăng nhập cuối"
    lastLoginAt: DateTime
    "Thời gian đặt hàng cuối"
    lastOrderAt: DateTime
    "Thời gian xác thực email"
    emailVerifiedAt: DateTime
    "Thời gian thay đổi mật khẩu"
    passwordChangedAt: DateTime
  }

  type GooglePackage {
    "Gói đăng ký"
    subscription: SubscriptionPlanEnum
    "Số video đã dùng"
    videoCount: Int
    "Giới hạn video"
    videoLimit: Int
    "Số ảnh đã dùng"
    imageCount: Int
    "Giới hạn ảnh"
    imageLimit: Int
    "Số luồng ảnh đồng thời"
    imageStreamCount: Int
    "Số luồng video đồng thời"
    videoStreamCount: Int
    "Ngày hết hạn gói"
    expiryPackageDate: DateTime
  }
  input GooglePackageInput {
    "Gói đăng ký"
    subscription: SubscriptionPlanEnum
    "Số video đã dùng"
    videoCount: Int
    "Giới hạn video"
    videoLimit: Int
    "Số ảnh đã dùng"
    imageCount: Int
    "Giới hạn ảnh"
    imageLimit: Int
    "Số luồng ảnh đồng thời"
    imageStreamCount: Int
    "Số luồng video đồng thời"
    videoStreamCount: Int
    "Ngày hết hạn gói"
    expiryPackageDate: DateTime
  }

  type CustomerPageData {
    data: [Customer]
    total: Int
    pagination: Pagination
  }
  type CustomerLoginData {
    customer: Customer
    accessToken: String
  }
`;

export default schema;
