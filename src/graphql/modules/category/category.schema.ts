import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllCategory(q: QueryGetListInput): CategoryPageData
    getOneCategory(id: ID!): Category
    getAllCategoryActive(q: QueryGetListInput): CategoryPageData
    getCategoryTree: [Category]
  }

  extend type Mutation {
    createCategory(data: CreateCategoryInput!): Category
    updateCategory(id: ID!, data: UpdateCategoryInput!): Category
    updateCategoryOrder(id: ID!, parentId: String, priority: Float): Category
    deleteOneCategory(id: ID!): Category
  }

  input CreateCategoryInput {
    name: String
    imgUrl: String
    description: String
    priority: Float
    active: Boolean
    parentId: String
  }

  input UpdateCategoryInput {
    name: String
    imgUrl: String
    description: String
    priority: Float
    active: Boolean
    parentId: String
  }

  type Category {
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    imgUrl: String
    description: String
    priority: Float
    active: Boolean
    parentId: String
    parent: Category
    children: [Category]
  }

  type CategoryPageData {
    data: [Category]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
