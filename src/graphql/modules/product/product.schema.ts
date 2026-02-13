import { gql } from "apollo-server-express";
import { OtherInfoStatus, PreOrder } from "../../../libs/dal/product/product.interface";

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
    imgs: [String]
    categoryId: String
    active:Boolean
    slug: String
    delivery: DeliveryInput
    otherInfo: OtherInfoInput
    categoryProperties: Mixed
    classification: ClassificationInput
  }

  input UpdateProductInput {
    name: String
    des: String
    video: String
    coverImg: String
    imgs: [String]
    categoryId: String
    active:Boolean
    slug: String
    delivery: DeliveryInput
    otherInfo: OtherInfoInput
    categoryProperties: Mixed
    classification: ClassificationInput
  }
 
 

  input DeliveryInput {
    weight: Float
    width: Float
    length: Float
    height: Float
    price: Float
  }

  input OtherInfoInput {
    """${Object.values(PreOrder).join("|")}"""
    preOrder: String
    preOrderDay: Float
    """${Object.values(OtherInfoStatus).join("|")}"""
    status: String
    sku: String
  }

  input ClassificationInput {
    tiers: [TierInput]
    variants: [VariantInput]
    originalPrice: Float
    totalStock: Float
  }

  input TierInput {
    code: String
    name: String
    options: [TierOptionInput]
  }

  input TierOptionInput {
    code: String
    name: String
    imageUrl: String
  }

  input VariantInput {
    code: String
    sku: String
    price: Float
    stock: Float
    optionCodes: [String]
  }

  type Product {
    id: String    
    createdAt: DateTime
    updatedAt: DateTime

    name: String
    des: String
    video: String
    coverImg: String
    imgs: [String]
    categoryId: String
    active:Boolean
    slug: String
    minPrice: Float
    maxPrice: Float
    categoryProperties: Mixed
    delivery: Delivery
    otherInfo: OtherInfo
    classification: Classification
  }

  type Delivery {
    weight: Float
    width: Float
    length: Float
    height: Float
    price: Float
  }

  type OtherInfo {
    """${Object.values(PreOrder).join("|")}"""
    preOrder: String
    preOrderDay: Float
    """${Object.values(OtherInfoStatus).join("|")}"""
    status: String
    sku: String
  }

  type Classification {
    tiers: [Tier]
    variants: [Variant]
    originalPrice: Float
    totalStock: Float
  }

  type Tier {
    code: String
    name: String
    options: [TierOption]
  }

  type TierOption {
    code: String
    name: String
    imageUrl: String
  }

  type Variant {
    code: String
    sku: String
    price: Float
    stock: Float
    optionCodes: [String]
  }
 

  type ProductPageData {
    data: [Product]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
