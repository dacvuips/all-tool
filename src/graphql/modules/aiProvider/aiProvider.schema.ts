import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllAiProvider(q: QueryGetListInput): AiProviderPageData
    getOneAiProvider(id: ID!): AiProvider
    # Add Query
  }

  extend type Mutation {
    createAiProvider(data: CreateAiProviderInput!): AiProvider
    updateAiProvider(id: ID!, data: UpdateAiProviderInput!): AiProvider
    deleteOneAiProvider(id: ID!): AiProvider
    # Add Mutation
  }

  input CreateAiProviderInput {
    name: String
    imgUrl: String
    website: String
    active: Boolean
    key: String
  }

  input UpdateAiProviderInput {
    name: String
    imgUrl: String
    website: String
    active: Boolean
    key: String
  }

  type AiProvider {
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    imgUrl: String
    website: String
    active: Boolean
    key: String
  }

  type AiProviderPageData {
    data: [AiProvider]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
