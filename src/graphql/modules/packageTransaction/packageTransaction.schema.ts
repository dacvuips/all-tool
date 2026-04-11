import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllPackageTransaction(q: QueryGetListInput): PackageTransactionPageData
    getOnePackageTransaction(id: ID!): PackageTransaction
    # Add Query
  }

  type PackageTransactionSnapshot {
    subscription: String
    videoCount: Int
    videoLimit: Int
    imageCount: Int
    imageLimit: Int
    imageStreamCount: Int
    videoStreamCount: Int
    expiryPackageDate: DateTime
  }

  type PackageTransaction {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "Id khách hàng"
    customerId: String
    "Mã khách hàng"
    customerCode: String
    "Loại giao dịch"
    type: String
    "Snapshot trước khi thay đổi"
    before: PackageTransactionSnapshot
    "Snapshot sau khi thay đổi"
    after: PackageTransactionSnapshot
    "Mô tả giao dịch"
    description: String
  }

  type PackageTransactionPageData {
    data: [PackageTransaction]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
