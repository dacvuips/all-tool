import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllWalletTransaction(q: QueryGetListInput): WalletTransactionPageData
    getOneWalletTransaction(id: ID!): WalletTransaction
    # Add Query
  }

  type WalletTransaction {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Mã giao dịch"
    code: String
    "Mã mPoint"
    walletId: String
    "Mã tài khoản"
    ownerId: String
    "Hướng giao dịch"
    side: String
    "Loại giao dịch"
    type: String
    "Số tiền giao dịch"
    amount: Float
    "Số dư mPoint sau khi giao dịch"
    balance: Float
    "Mô tả giao dịch"
    description: String
    "Trạng thái giao dịch"
    status: String
    "Lý do thất bại"
    failedReason: String
    "Số lần giao dịch"
    transactionNoun: Int
    specificInfo: [Mixed]
    tranferFromUser: Mixed
    ownerCustomer: User
    ownerUser: User
  }

  type WalletTransactionPageData {
    data: [WalletTransaction]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
