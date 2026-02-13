import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllBank(q: QueryGetListInput): BankPageData
    getOneBank(id: ID!): Bank
    # Add Query
  }

  extend type Mutation {
    createBank(data: CreateBankInput!): Bank
    updateBank(id: ID!, data: UpdateBankInput!): Bank
    deleteOneBank(id: ID!): Bank
    # Add Mutation
  }

  input CreateBankInput {
    method: String!
    bankImage: String!
    bankCode: String!
    bankName: String!
    accountNumber: String!
    accountName: String!
    bin: String!
    status: Boolean!
  }

  input UpdateBankInput {
    method: String
    bankImage: String
    bankCode: String
    bankName: String
    accountNumber: String
    accountName: String
    bin: String
    status: Boolean
  }

  type Bank {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    method: String
    bankImage: String
    bankCode: String
    bankName: String
    accountNumber: String
    accountName: String
    bin: String
    status: Boolean
  }

  type BankPageData {
    data: [Bank]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
