import { gql } from "apollo-server-express";
import { PropertyTypeEnum } from "../../../libs/dal/product/product.interface";

const schema = gql`
  extend type Query {
    getAllProduct(q: QueryGetListInput): ProductPageData
    getOneProduct(id: ID!): Product
    getActiveProducts(q: QueryGetListInput): ProductPageData
    getProductSlug(slug: String!): Product
    # Add Query
  }

  extend type Mutation {
    createProduct(data: CreateProductInput!): Product
    updateProduct(id: ID!, data: UpdateProductInput!): Product
    deleteOneProduct(id: ID!): Product
    toggleActiveProduct(id: ID!): Product
    # Add Mutation
  }

  input CreateProductInput {
    name: String
    des: String
    video: String
    coverImg: String
    categoryId: String
    active: Boolean
    slug: String
    price: Float
    priority: Float
    properties: [PropertyInput]
  }

  input UpdateProductInput {
    name: String
    des: String
    video: String
    coverImg: String
    categoryId: String
    active: Boolean
    slug: String
    price: Float
    priority: Float
    properties: [PropertyInput]
  }

  input PropertySelectOptionInput {
    key: String
    label: String
  }

  input PropertyInput {
    """${Object.values(PropertyTypeEnum).join("|")}"""
    type: String
    key: String
    label: String
    placeholder: String
    tooltip: String
    required: Boolean
    clearable: Boolean
    options: [PropertySelectOptionInput]
  }

  type Product {
    id: String    
    createdAt: DateTime
    updatedAt: DateTime

    name: String
    des: String
    video: String
    coverImg: String
    categoryId: String
    active: Boolean
    slug: String
    price: Float
    priority: Float
    properties: [Property]
  }

  type PropertySelectOption {
    key: String
    label: String
  }

  type Property {
    """${Object.values(PropertyTypeEnum).join("|")}"""
    type: String
    key: String
    label: String
    placeholder: String
    tooltip: String
    required: Boolean
    clearable: Boolean
    options: [PropertySelectOption]
  }

  type ProductPageData {
    data: [Product]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
