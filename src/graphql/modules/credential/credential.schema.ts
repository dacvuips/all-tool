import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllCredential(q: QueryGetListInput): CredentialPageData
    getOneCredential(id: ID!): Credential
    getMyCredential: Credential
    # Add Query
  }

  extend type Mutation {
    createCredential(data: CreateCredentialInput!): Credential
    updateCredential(id: ID!, data: UpdateCredentialInput!): Credential
    deleteOneCredential(id: ID!): Credential
    # Add Mutation
  }

  type CredentialField {
    value: String
    active: Boolean
  }

  input CredentialFieldInput {
    value: String
    active: Boolean
  }

  input CreateCredentialInput {
    ghnToken: CredentialFieldInput
    googleAIStudio: CredentialFieldInput
    giaoHangTietKiem: CredentialFieldInput
    chatGPT: CredentialFieldInput
    spx: CredentialFieldInput
    jtExpress: CredentialFieldInput
  }

  input UpdateCredentialInput {
    ghnToken: CredentialFieldInput
    googleAIStudio: CredentialFieldInput
    giaoHangTietKiem: CredentialFieldInput
    chatGPT: CredentialFieldInput
    spx: CredentialFieldInput
    jtExpress: CredentialFieldInput
  }

  type Credential {
    id: ID
    createdAt: DateTime
    updatedAt: DateTime

    ghnToken: CredentialField
    googleAIStudio: CredentialField
    giaoHangTietKiem: CredentialField
    chatGPT: CredentialField
    spx: CredentialField
    jtExpress: CredentialField
  }

  type CredentialPageData {
    data: [Credential]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
