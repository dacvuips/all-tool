import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    "Admin: lấy danh sách đơn mua trending item"
    getAllTrendingPurchaseOrder(q: QueryGetListInput): TrendingPurchaseOrderPageData
    "Admin: lấy chi tiết 1 đơn mua trending item"
    getOneTrendingPurchaseOrder(id: ID!): TrendingPurchaseOrder
    """
    Customer: batch lấy trạng thái mua cho nhiều trending item.
    Dùng khi render list card – biết item nào đã mua (PAID).
    """
    getMyTrendingPurchases(trendingIds: [ID!]!): [TrendingPurchaseStatus]
  }

  extend type Mutation {
    """
    Customer: mua (nếu chưa mua) + lấy prompt trong 1 lần gọi.
    - Item miễn phí hoặc do chính customer tạo → trả prompt ngay, không trừ tiền.
    - Đã mua trước đó → trả prompt, không trừ tiền thêm (one-time purchase).
    - Chưa mua + có giá → trừ mPoint, tạo đơn PAID, trả prompt.
    """
    useTrendingItem(trendingId: ID!): UseTrendingItemResult
    "Admin: hoàn tiền / thu hồi quyền sử dụng trending item"
    refundTrendingPurchaseOrder(orderId: ID!, reason: String!): Mixed
  }

  enum TrendingPurchaseOrderStatus {
    PAID
    REFUNDED
  }

  type TrendingPurchaseOrder {
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    "ID khách hàng mua"
    customerId: ID
    "ID trending item"
    trendingId: ID
    "Loại item tại thời điểm mua"
    trendingType: TrendingTypeEnum
    "Giá snapshot (mPoint)"
    price: Float
    "Tên item snapshot"
    itemName: String
    "ID giao dịch trừ mPoint"
    walletTransactionId: ID
    "Trạng thái đơn"
    status: TrendingPurchaseOrderStatus
    "Thời điểm thanh toán"
    paidAt: DateTime
    "Thời điểm hoàn tiền"
    refundedAt: DateTime
    "Lý do hoàn tiền"
    refundReason: String
  }

  type TrendingPurchaseOrderPageData {
    data: [TrendingPurchaseOrder]
    total: Int
    pagination: Pagination
  }

  "Trạng thái mua của customer cho 1 trending item (dùng trên UI card)"
  type TrendingPurchaseStatus {
    trendingId: ID
    orderId: ID
    status: TrendingPurchaseOrderStatus
    paidAt: DateTime
    price: Float
  }

  "Kết quả mutation useTrendingItem – gộp thanh toán + lấy prompt"
  type UseTrendingItemResult {
    id: String
    prompt: String
    orderId: String
    "Đã sở hữu từ trước (owner / miễn phí / đã mua)"
    alreadyOwned: Boolean
    "Có trừ mPoint trong lần gọi này"
    charged: Boolean
    "Số mPoint đã trừ (0 nếu không trừ)"
    chargedAmount: Float
  }
`;

export default schema;
