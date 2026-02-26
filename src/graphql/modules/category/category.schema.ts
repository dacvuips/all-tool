import { gql } from "apollo-server-express";
import { PropertyTypeEnum } from "../../../libs/dal/category/category.interface";

const schema = gql`
  # extend type Query {
  #   getAllCategory(q: QueryGetListInput): CategoryPageData
  #   getOneCategory(id: ID!): Category
  #   getAllCategoryActive(q: QueryGetListInput): CategoryPageData
  #   # Add Query
  # }

  # extend type Mutation {
  #   createCategory(data: CreateCategoryInput!): Category
  #   updateCategory(id: ID!, data: UpdateCategoryInput!): Category
  #   deleteOneCategory(id: ID!): Category
  #   # Add Mutation
  # }

  # input CreateCategoryInput {
  #   name: String
  #   imgUrl: String
  #   description: String
  #   priority: Int
  #   active: Boolean
  #   properties: [PropertyInput]
  # }

  # input UpdateCategoryInput {
  #   name: String
  #   imgUrl: String
  #   description: String
  #   priority: Int
  #   active: Boolean
  #   properties: [PropertyInput]
  # }

  # input PropertyInput {
  #   """${Object.values(PropertyTypeEnum).join("|")}"""
  #   type: String
  #   key: String
  #   label: String
  #   placeholder: String
  #   tooltip: String
  #   required: Boolean
  #   clearable: Boolean
  #   options: [PropertySelectOptionInput]
  #   default: Boolean
  # }

  # input PropertySelectOptionInput {
  #   key: String
  #   label: String
  # }

  type Category {
    id: String    
    createdAt: DateTime
    updatedAt: DateTime

    name: String
    imgUrl: String
    description: String
    priority: Int
    active: Boolean
  #   properties: [Property]
  }

  # type Property {
  #   """${Object.values(PropertyTypeEnum).join("|")}"""
  #   type: String
  #   key: String
  #   label: String
  #   placeholder: String
  #   tooltip: String
  #   required: Boolean
  #   clearable: Boolean
  #   options: [PropertySelectOption]
  #   default: Boolean
  # }

  # type PropertySelectOption {
  #   key: String
  #   label: String
  # }

  type CategoryPageData {
    data: [Category]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
