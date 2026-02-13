import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllCart(q: QueryGetListInput): CartPageData
    getOneCart(id: ID!): Cart
    getMyCart: [Cart]
    # Add Query
  }

  extend type Mutation {
    addToCart(data: AddToCartInput!): Cart
    updateCartItem(id: ID!, data: UpdateCartItemInput!): Cart
    removeCartItem(id: ID!): Cart
    toggleCartItemSelection(id: ID!): Cart
    syncCartFromSession(sessionId: String!): [Cart]
    clearCart: Mixed
    # Add Mutation
  }

  input AddToCartInput {
    sessionId: String
    productId: String!
    variantId: String
    sku: String
    productName: String!
    variantName: String
    thumbnail: String
    price: Float!
    originalPrice: Float
    promotion: PromotionInput
    quantity: Int!
    maxQuantity: Int
  }

  input UpdateCartItemInput {
    quantity: Int
    isSelected: Boolean
  }

  input PromotionInput {
    promotionType: String
    discountAmount: Float
    startTime: DateTime
    endTime: DateTime
  }

  input DimensionsInput {
    length: Float
    width: Float
    height: Float
  }

  type Cart {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    customerId: String
    sessionId: String

    productId: String
    variantId: String
    sku: String

    productName: String
    variantName: String

    thumbnail: String

    price: Float
    originalPrice: Float
    promotion: Promotion

    quantity: Int
    maxQuantity: Int

    isSelected: Boolean
    isValid: Boolean

    stockCheckedAt: DateTime
    priceCheckedAt: DateTime
  }

  type Promotion {
    promotionType: String
    discountAmount: Float
    startTime: DateTime
    endTime: DateTime
  }

  type CartPageData {
    data: [Cart]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
