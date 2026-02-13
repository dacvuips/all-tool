import { gql } from "apollo-server-express";
import { ThreadChannel, ThreadStatus } from "../../../libs/dal/thread";

const schema = gql`
  extend type Query {
    getAllThread(q: QueryGetListInput): ThreadPageData
    getOneThread(id: ID!): Thread
    # Add Query
  }

  extend type Mutation {
    createThread(data: CreateThreadInput!): Thread
    # updateThread(id: ID!, data: UpdateThreadInput!): Thread
    deleteOneThread(id: ID!): Thread
    # Add Mutation
  }

  input CreateThreadInput {
     "Kênh trao đổi ${Object.values(ThreadChannel)}"
     channel: String
    "Mã chủ shop"
    shopId: ID
    "Mã khách hàng"
    customerId: ID
    "Mã sản phẩm"
    shopProductId: ID
  }

  # input UpdateThreadInput {
   
  # }

  type Thread {
    id: String    
    createdAt: DateTime
    updatedAt: DateTime

   
    "Kênh trao đổi ${Object.values(ThreadChannel)}"
    channel: String 
    "Tin nhắn gần nhất"
    snippet: String
    "Thời điểm tin nhắn gần nhất"
    lastMessageAt: DateTime
    "Mã tin nhắn gần nhất"
    messageId: ID
    "Mã chủ shop"
    shopId: ID
    "Mã khách hàng"
    customerId: ID
    "Mã quản lý"
    staffId: ID
    "Mã đơn giao dịch game"
    gameOrderId:ID
    "Mã sản phẩm"
    shopProductId: ID
    "Trạng thái trao đổi ${Object.values(ThreadStatus)}"
    status: String
    "Khách hàng đã xem"
    seenCustomer: Boolean
    "Nhân viên đã xem"
    seenStaff: Boolean
    "Cửa hàng đã xem"
    seenShop: Boolean
    meta:Mixed

    "Danh sách mã nhãn"
    threadLabelIds: [ID]
    customer: Customer
    staff: User
    message: ThreadMessage
    
  }

  type ThreadPageData {
    data: [Thread]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
