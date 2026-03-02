import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllCredential(q: QueryGetListInput): CredentialPageData
    getOneCredential(id: ID!): Credential
    getMyCredential: Credential
    getAllCredentialCustomer(q: QueryGetListInput): CredentialPageData
    getOneCredentialCustomer(id: ID!): Credential
    # Add Query
  }

  extend type Mutation {
    createCredential(data: CreateCredentialInput!): Credential
    updateCredential(id: ID!, data: UpdateCredentialInput!): Credential
    deleteOneCredential(id: ID!): Credential
    createCredentialCustomer(data: CreateCredentialCustomerInput!): Credential
    updateCredentialCustomer(id: ID!, data: UpdateCredentialCustomerInput!): Credential
    deleteOneCredentialCustomer(id: ID!): Credential
    # Add Mutation
  }

  input CreateCredentialInput {
    key: AiProviderKeyEnum
    value: String
    active: Boolean
    customerId: String
    isCustomerCredential: Boolean
    isAdminCredential: Boolean
  }

  input UpdateCredentialInput {
    key: AiProviderKeyEnum
    value: String
    active: Boolean
    customerId: String
    isCustomerCredential: Boolean
    isAdminCredential: Boolean
  }
  input CreateCredentialCustomerInput {
    key: AiProviderKeyEnum
    value: String
    active: Boolean
    isCustomerCredential: Boolean
  }
  input UpdateCredentialCustomerInput {
    key: AiProviderKeyEnum
    value: String
    active: Boolean
    isCustomerCredential: Boolean
  }

  type Credential {
    id: ID
    createdAt: DateTime
    updatedAt: DateTime

    key: AiProviderKeyEnum
    value: String
    active: Boolean
    customerId: String
    isCustomerCredential: Boolean
    isAdminCredential: Boolean
  }

  enum AiProviderKeyEnum {
    OPENAI_KEY
    CLAUDE_KEY
    ANTHROPIC_KEY
    GOOGLE_GEMINI_KEY
    DEEP_SEEK_KEY
    KLING_KEY
    SORA_KEY
    SEE_DANCE_KEY
  }

  type CredentialPageData {
    data: [Credential]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
