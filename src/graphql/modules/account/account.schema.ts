import { gql } from "apollo-server-express";

const schema = gql`
  type Account {
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    accountName: String
    pw: String
    secondAccountName: String
    secondPw: String
    duplicateKey: String
    shopId: String
    affiliateProductId: String
    customerId: String
    affiliateCategoriesId: String
    status: Boolean
    isNotDuplicate: Boolean
    isSold: Boolean
    affiliateProductAccountsId: String
  }

  type AccountPageData {
    data: [Account]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
