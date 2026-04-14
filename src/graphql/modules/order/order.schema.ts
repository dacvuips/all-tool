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
    createOrder(creditAmount: Float!): CreateOrderResult
    updateOrder(orderId: ID!, data: UpdateOrderInput!): Order
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order
    cancelOrder(orderId: ID!, reason: String): Order
    createShopeExpressShipping(orderId: ID!): ShippingResult
    createGiaoHangNhanhShipping(orderId: ID!): ShippingResult
    # Tạo form thanh toán qua cổng SePay PG, trả về dữ liệu để frontend auto-submit form
    # orderId: truyền khi muốn retry đơn PAYMENT_PENDING+SEPAY_PG đã có
    createSePayPGCheckout(subscriptionPlan: String!, orderId: ID): SePayPGCheckoutData
  }

  input CreateOrderInput {
    customerId: ID
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
    SEPAY_PG
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

    subtotal: Float
    tax: Float
    discount: Float
    totalAmount: Float
    subscriptionPlan: String

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
    subscriptionPlan: String

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

  """
  Dữ liệu form thanh toán SePay PG.
  Frontend dùng checkoutUrl làm form action (POST) và parse formFieldsJson
  thành object để render các hidden input rồi auto-submit form.
  """
  type SePayPGCheckoutData {
    """URL dùng làm action của form POST tới cổng SePay"""
    checkoutUrl: String!
    """JSON string chứa tất cả hidden field đã ký (merchant, operation, payment_method, order_invoice_number, order_amount, currency, order_description, customer_id, success_url, error_url, cancel_url, signature)"""
    formFieldsJson: String!
  }
`;

export default schema;
