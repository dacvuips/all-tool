import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllPopupNotify(q: QueryGetListInput): PopupNotifyPageData
    getOnePopupNotify(id: ID!): PopupNotify
    # Add Query
  }

  extend type Mutation {
    createPopupNotify(data: CreatePopupNotifyInput!): PopupNotify
    updatePopupNotify(id: ID!, data: UpdatePopupNotifyInput!): PopupNotify
    deleteOnePopupNotify(id: ID!): PopupNotify
    # Add Mutation
  }

  input CreatePopupNotifyInput {
    "Tên popup"
    name: String
    "Mô tả"
    description: String
    "Loại popup"
    type: String
    "Trạng thái"
    status: String
    "Dữ liệu"
    data: Mixed
    "Ngày bắt đầu"
    startDate: DateTime
    "Ngày kết thúc"
    endDate: DateTime
    "Ưu tiên"
    priority: Float
    "Hành động"
    action: String
    "Đường dẫn website"
    link: String
  }

  input UpdatePopupNotifyInput {
    "Tên popup"
    name: String
    "Mô tả"
    description: String
    "Loại popup"
    type: String
    "Trạng thái"
    status: String
    "Dữ liệu"
    data: Mixed
    "Ngày bắt đầu"
    startDate: DateTime
    "Ngày kết thúc"
    endDate: DateTime
    "Ưu tiên"
    priority: Float
    "Hành động"
    action: String
    "Đường dẫn website"
    link: String
  }

  type PopupNotify {
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    "Tên popup"
    name: String
    "Mô tả"
    description: String
    "Loại popup"
    type: String
    "Trạng thái"
    status: String
    "Dữ liệu"
    data: Mixed
    "Ngày bắt đầu"
    startDate: DateTime
    "Ngày kết thúc"
    endDate: DateTime
    "Ưu tiên"
    priority: Float
    "Hành động"
    action: String
    "Đường dẫn website"
    link: String
  }

  type PopupNotifyPageData {
    data: [PopupNotify]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
