import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllTopic(q: QueryGetListInput): TopicPageData
    getOneTopic(id: ID!): Topic
    # Add Query
  }

  extend type Mutation {
    createTopic(data: CreateTopicInput!): Topic
    updateTopic(id: ID!, data: UpdateTopicInput!): Topic
    deleteOneTopic(id: ID!): Topic
    # Add Mutation
  }

  input CreateTopicInput {
    "Tên chủ đề"
    name: String!
    "slug"
    slug: String
    "Hình ảnh"
    image: String
    "Nhóm"
    group: String
  }

  input UpdateTopicInput {
    "Tên chủ đề"
    name: String
    "slug"
    slug: String
    "Hình ảnh"
    image: String
    "Nhóm"
    group: String
  }

  type Topic {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Tên chủ đề"
    name: String
    "slug"
    slug: String
    "Hình ảnh"
    image: String
    "Nhóm"
    group: String
  }

  type TopicPageData {
    data: [Topic]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
