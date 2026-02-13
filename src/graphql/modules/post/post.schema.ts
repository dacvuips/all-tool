import { gql } from "apollo-server-express";
import { PostStatus } from "../../../libs/dal/post";

const schema = gql`
  extend type Query {
    getAllPost(q: QueryGetListInput): PostPageData
    getOnePost(id: ID!): Post
  }

  extend type Mutation {
    createPost(data: CreatePostInput!): Post
    updatePost(id: ID!, data: UpdatePostInput!): Post
    deleteOnePost(id: ID!): Post
  }

  input CreatePostInput {
    "Tiêu đề"
    title: String!
    "Đoạn trích"
    excerpt: String
    "từ khoá"
    slug: String
    "Trạng thái ${Object.values(PostStatus)}"
    status: String
    "Ngày công khai"
    publishedAt: DateTime
    "Hình đại diện"
    featureImage: String
    "Mô tả meta tag"
    metaDescription: String
    "Tiêu đề meta tag"
    metaTitle: String
    "Nội dung html"
    content: String
    "Danh sách tag"
    tagIds: [ID]
    "Mô tả open graph"
    ogDescription: String
    "Hình ảnh open graph"
    ogImage: String
    "Tiêu đề open graph"
    ogTitle: String
    "Mô tả twitter"
    twitterDescription: String
    "Hình ảnh twitter"
    twitterImage: String
    "Tiêu đề twitter"
    twitterTitle: String
    "Độ ưu tiên"
    priority: Int
    "Danh sách chủ đề"
    topicIds: [String]
    # "Danh sách file đính kèm"
    # attachmentIds: [ID]
    roleGroup:[String]
  }

  input UpdatePostInput {
    "Tiêu đề"
    title: String
    "Đoạn trích"
    excerpt: String
    "từ khoá"
    slug: String
    "Trạng thái ${Object.values(PostStatus)}"
    status: String
    "Ngày công khai"
    publishedAt: DateTime
    "Hình đại diện"
    featureImage: String
    "Mô tả meta tag"
    metaDescription: String
    "Tiêu đề meta tag"
    metaTitle: String
    "Nội dung html"
    content: String
    "Danh sách tag"
    tagIds: [ID]
    "Mô tả open graph"
    ogDescription: String
    "Hình ảnh open graph"
    ogImage: String
    "Tiêu đề open graph"
    ogTitle: String
    "Mô tả twitter"
    twitterDescription: String
    "Hình ảnh twitter"
    twitterImage: String
    "Tiêu đề twitter"
    twitterTitle: String
    "Độ ưu tiên"
    priority: Int
    "Danh sách chủ đề"
    topicIds: [String]
    # "Danh sách file đính kèm"
    # attachmentIds: [ID]
    roleGroup:[String]
  }

  type Post {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Tiêu đề"
    title: String
    "Đoạn trích"
    excerpt: String
    "từ khoá"
    slug: String
    "Trạng thái ${Object.values(PostStatus)}"
    status: String
    "Ngày công khai"
    publishedAt: DateTime
    "Hình đại diện"
    featureImage: String
    "Mô tả meta tag"
    metaDescription: String
    "Tiêu đề meta tag"
    metaTitle: String
    "Nội dung html"
    content: String
    "Danh sách tag"
    tagIds: [ID]
    "Mô tả open graph"
    ogDescription: String
    "Hình ảnh open graph"
    ogImage: String
    "Tiêu đề open graph"
    ogTitle: String
    "Mô tả twitter"
    twitterDescription: String
    "Hình ảnh twitter"
    twitterImage: String
    "Tiêu đề twitter"
    twitterTitle: String
    "Độ ưu tiên"
    priority: Int
    "Số lượt view"
    view: Int
    "Danh sách chủ đề"
    topicIds: [ID]
    # "Danh sách file đính kèm"
    # attachmentIds: [ID]

    tags: [PostTag]
    topics: [Topic]
    # attachments: [Attachment]
    roleGroup:[String]
  }

  type PostPageData {
    data: [Post]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
