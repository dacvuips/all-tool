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
    flow: ProductFlowInput
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
    flow: ProductFlowInput
  }

  input NodeConfigInput {
    outputType: String
    provider: String
    model: String
    baseUrl: String
    endpoint: String
    method: String
    headers: String
    bodyTemplate: String
    responsePath: String
  }

  input FlowNodeDataInput {
    label: String
    properties: [PropertyInput]
    config: NodeConfigInput
  }

  input FlowNodePositionInput {
    x: Float!
    y: Float!
  }

  input FlowNodeInput {
    id: String!
    type: String
    position: FlowNodePositionInput!
    data: FlowNodeDataInput
  }

  input FlowEdgeInput {
    id: String!
    source: String!
    target: String!
    sourceHandle: String
    targetHandle: String
  }

  input ProductFlowInput {
    nodes: [FlowNodeInput]
    edges: [FlowEdgeInput]
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
    flow: ProductFlow
  }

  type NodeConfig {
    outputType: String
    provider: String
    model: String
    baseUrl: String
    endpoint: String
    method: String
    headers: String
    bodyTemplate: String
    responsePath: String
  }

  type FlowNodeData {
    label: String
    properties: [Property]
    config: NodeConfig
  }

  type FlowNodePosition {
    x: Float
    y: Float
  }

  type ProductFlowNode {
    id: String
    type: String
    position: FlowNodePosition
    data: FlowNodeData
  }

  type ProductFlowEdge {
    id: String
    source: String
    target: String
    sourceHandle: String
    targetHandle: String
  }

  type ProductFlow {
    nodes: [ProductFlowNode]
    edges: [ProductFlowEdge]
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
