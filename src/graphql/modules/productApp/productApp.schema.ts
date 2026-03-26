import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllProductApp(q: QueryGetListInput): ProductAppPageData
    getOneProductApp(id: ID!): ProductApp
    getActiveProductApps(q: QueryGetListInput): ProductAppPageData
    getProductAppSlug(slug: String!): ProductApp
    # Add Query
  }

  extend type Mutation {
    createProductApp(data: CreateProductAppInput!): ProductApp
    updateProductApp(id: ID!, data: UpdateProductAppInput!): ProductApp
    deleteOneProductApp(id: ID!): ProductApp
    toggleActiveProductApp(id: ID!): ProductApp
    # Add Mutation
  }

  input CreateProductAppInput {
    name: String
    des: String
    coverImg: String
    categoryIds: [String]
    active: Boolean
    slug: String
    priority: Float
    creditCost: Float
  }

  input UpdateProductAppInput {
    name: String
    des: String
    coverImg: String
    categoryIds: [String]
    active: Boolean
    slug: String
    priority: Float
    creditCost: Float
  }

  type ProductApp {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    name: String
    des: String
    coverImg: String
    categoryIds: [String]
    active: Boolean
    slug: String
    priority: Float
    creditCost: Float
  }

  type ProductAppPageData {
    data: [ProductApp]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
