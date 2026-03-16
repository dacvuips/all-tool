import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllAttachment(q: QueryGetListInput): AttachmentPageData
    getOneAttachment(id: ID!): Attachment
    # Add Query
  }

  extend type Mutation {
    deleteOneAttachment(id: ID!): Attachment
    # Add Mutation
  }
  type Attachment {
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    "Người tạo file"
    owner: Owner
    "Thư mục"
    bucket: String
    "Tên file"
    name: String
    "Loại file"
    mimetype: String
    "Kích thước"
    size: Int
    "etag"
    etag: String
    "file path"
    path: String
    "Đang xử lý"
    processing: Boolean

    downloadUrl: String
  }

  type AttachmentPageData {
    data: [Attachment]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
