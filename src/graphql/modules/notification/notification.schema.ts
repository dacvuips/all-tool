import { gql } from "apollo-server-express";
import { NotificationTarget, NotificationType } from "../../../libs/dal/notification";

const schema = gql`
  extend type Query {
    getAllNotification(q: QueryGetListInput): NotificationPageData
    getOneNotification(id: ID!): Notification
    # Add Query
  }

  extend type Mutation {
    testFCM(deviceToken: String, title: String, body: String, data: Mixed): Mixed
    readAllNotification: Boolean
    readNotification(notificationId: ID!): Notification
    # Add Mutation
  }
  type Notification {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Gửi tới ${Object.values(NotificationTarget)}"
    target: String
    "Mã nhân viên"
    userId: ID
    "Mã chủ shop"
    shopId: ID
    "Mã khách hàng"
    customerId: ID
   
    "Tiêu đề thông báo"
    title: String
    "Nội dung thông báo"
    body: String
    "Loại thông báo ${Object.values(NotificationType)}"
    type: String
    "Đã xem"
    seen: Boolean
    "Ngày xem"
    seenAt: DateTime
    "Hình ảnh"
    image: String
    "Ngày gửi"
    sentAt: DateTime
    "Mã đơn hàng"
    orderId: ID
    "Mã sản phẩm"
    productId: ID
    "Đơn sản phẩm"
    gameOrderId:ID
    "Link website"
    link: String
    "Mã yêu cầu hỗ trợ"
    ticketId: ID
    "Link giao dịch"
    transactLink: String
    "Link mPoint"
    walletLink: String

    user: User
    customer: Customer
  }

  type NotificationPageData {
    data: [Notification]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
