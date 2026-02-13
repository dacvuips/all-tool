import { gql } from "apollo-server-express";
import { ThreadMessageType } from "../../../libs/dal/threadMessage";

const schema = gql`
  extend type Query {
    getAllThreadMessage(q: QueryGetListInput): ThreadMessagePageData
    getOneThreadMessage(id: ID!): ThreadMessage
    # Add Query
  }

  extend type Mutation {
    createThreadMessage(data: CreateThreadMessageInput!): ThreadMessage
    unsendMessage(id: ID!):ThreadMessage
    # updateThreadMessage(id: ID!, data: UpdateThreadMessageInput!): ThreadMessage
    # deleteOneThreadMessage(id: ID!): ThreadMessage
    # Add Mutation
  }

  input CreateThreadMessageInput {
     "Mã cuộc trao đổi"
     threadId: ID!
    "Loại tin nhắn ${Object.values(ThreadMessageType)}"
    type: String
    "Tin nhắn"
    text: String
    "Dữ liệu đính kèm"
    attachment: Mixed
  }

  # input UpdateThreadMessageInput {
  #   name: String
  # }

  type ThreadMessage {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

  "Mã cuộc trao đổi"
  threadId: ID
    "Loại tin nhắn ${Object.values(ThreadMessageType)}"
    type: String
    "Tin nhắn"
    text: String
    "Dữ liệu đính kèm"
    attachment: Mixed
    "Người gửi"
    sender: ThreadSender
    "Đã xem"
    seen: Boolean
    "Ngày xem"
    seenAt: DateTime
    "Đã thu hồi"
    isUnsend: Boolean
    "Trạng thái"
    isActive:Boolean
  }

  type ThreadMessagePageData {
    data: [ThreadMessage]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
