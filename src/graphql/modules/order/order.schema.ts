import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllOrder(q: QueryGetListInput): OrderPageData
    getOneOrder(id: ID!): Order
    getOrderByNumber(orderNumber: String!): Order
    getMyOrders(limit: Int): [Order]
    getMyOrderStats: OrderStats
    getOneOrderByGuest: CheckoutOrder
    getOrdersByGuest(q: QueryGetListInput): OrderPageData
  }

  extend type Mutation {
    createOrder(data: CreateOrderInput!): CreateOrderResult
    updateOrder(orderId: ID!, data: UpdateOrderInput!): Order
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order
    cancelOrder(orderId: ID!, reason: String): Order
    createShopeExpressShipping(orderId: ID!): ShippingResult
    createGiaoHangNhanhShipping(orderId: ID!): ShippingResult
  }

  input CreateOrderInput {
    sessionId: String
    productId: ID!
    items: [OrderItemInput!]!
    shippingAddress: ShippingAddressInput!

    paymentMethod: PaymentMethod!

    shippingFee: Float
    tax: Float
    discount: Float

    customerNote: String

    cartIds: [String!]
  }

  input UpdateOrderInput {
    status: OrderStatus
    shippingFee: Float
    adminNote: String
    customerNote: String
    shippingAddress: ShippingAddressInput
  }

  input OrderItemInput {
    productName: String!
    thumbnail: String
    price: Float!
    originalPrice: Float
    quantity: Int!
    subtotal: Float
  }

  input ShippingAddressInput {
    recipientName: String!
    phone: String!
    email: String
    address: String!
    ward: String
    district: String
    province: String
    country: String
    postalCode: String
    note: String
  }

  enum OrderStatus {
    CREATED
    STATUS_CHANGED
    PAYMENT_UPDATED
    PAYMENT_CONFIRMED
    SHIPPING_STARTED
    DELIVERED
    CANCELLED
    CONFIRMED
    PROCESSING
    ORDER_UPDATED
  }

  enum PaymentMethod {
    COD
    BANK
    MOMO
    ZALO_PAY
    CREDIT_CARD
  }

  enum PaymentStatus {
    PAYMENT_INITIATED
    PAYMENT_PENDING
    PAYMENT_PROCESSING
    PAYMENT_SUCCESS
    PAYMENT_FAILED
    PAYMENT_CANCELLED
    PAYMENT_REFUNDED
    PAYMENT_PARTIALLY_REFUNDED
    PAYMENT_VERIFIED
    PAYMENT_TIMEOUT
    PAYMENT_UNPAID
  }

  type Order {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    customerId: ID
    sessionId: String

    orderNumber: String
    status: OrderStatus
    productId: ID
    items: [OrderItem]

    subtotal: Float
    shippingFee: Float
    tax: Float
    discount: Float
    totalAmount: Float

    shippingAddress: ShippingAddress

    paymentMethod: String
    paymentStatus: PaymentStatus
    paymentInfo: PaymentInfo

    paidAt: DateTime
    shippedAt: DateTime
    deliveredAt: DateTime
    cancelledAt: DateTime

    customerNote: String
    adminNote: String

    orderLogs: [OrderLog]
    paymentLogs: [PaymentLog]
    product: Product
    shipmentIds: [String]
  }

  type OrderLog {
    status: OrderStatus
    des: String
    note: String
    meta: Mixed
    createdAt: DateTime
    creatorId: ID
  }

  type OrderItem {
    productName: String
    thumbnail: String
    price: Float
    originalPrice: Float
    quantity: Int
    subtotal: Float
  }

  type ShippingAddress {
    recipientName: String
    phone: String
    email: String
    address: String
    ward: String
    district: String
    province: String
    country: String
    postalCode: String
    note: String
  }

  type PaymentInfo {
    method: String
    bankImage: String
    bankCode: String
    bankName: String
    accountNumber: String
    accountName: String
    bin: String
    metadata: Mixed
  }

  type OrderStats {
    total: Int
    pending: Int
    confirmed: Int
    shipping: Int
    delivered: Int
    cancelled: Int
    totalSpent: Float
  }

  type CreateOrderResult {
    order: Order
    paymentUrl: String
    message: String
  }

  type CheckoutOrder {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    customerId: ID
    sessionId: String

    orderNumber: String
    status: OrderStatus

    subtotal: Float
    shippingFee: Float
    tax: Float
    discount: Float
    totalAmount: Float

    shippingAddress: ShippingAddress

    paymentMethod: PaymentMethod
    paymentStatus: PaymentStatus
    paymentInfo: PaymentInfo
    customerNote: String
  }

  type OrderPageData {
    data: [Order]
    total: Int
    pagination: Pagination
  }

  type ShippingResult {
    success: Boolean
    message: String
    trackingNumber: String
    shippingLabel: String
  }

  type PaymentLog {
    status: PaymentStatus
    des: String
    note: String
    meta: Mixed
    createdAt: DateTime
    creatorId: ID
    amount: Float
    transactionId: String
  }
`;

export default schema;
