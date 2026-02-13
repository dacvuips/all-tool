import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllWallet(q: QueryGetListInput): WalletPageData
    getOneWallet(id: ID!): Wallet
    # Add Query
  }

  type Wallet {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Mã tài khoản"
    ownerId: ID
    "Tài khoản"
    owner: User
    "Số dư mPoint"
    balance: Float
    "Tổng tiền đã nạp"
    totalIn: Float
    "Tổng tiền đã rút"
    totalOut: Float
    "Thời gian"
    times: Mixed
    "mPoint đã bị khóa"
    isLocked: Boolean
    "Số lần giao dịch"
    transactionNoun: Int
  }

  type WalletPageData {
    data: [Wallet]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
