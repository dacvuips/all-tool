import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllAddress(q: QueryGetListInput): AddressPageData
    getOneAddress(id: ID!): Address
    getProvince: [ProvinceData]
    getDistrict(provinceName: String!): [DistrictData]
    getWard(districtName: String!): [WardData]
  }

  extend type Mutation {
    createAddress(data: CreateAddressInput!): Address
    updateAddress(id: ID!, data: UpdateAddressInput!): Address
    deleteOneAddress(id: ID!): Address
    deleteManyAddress(ids: [ID]): Int
  }

  type ProvinceData {
    id: Int
    name: String
    code: String
  }
  type DistrictData {
    id: Int
    name: String
    provinceId: Int
    code: String
  }
  type WardData {
    id: String
    name: String
    districtId: Int
  }

  input CreateAddressInput {
    province: String
    provinceId: String
    district: String
    districtId: String
    ward: String
    wardId: String
  }

  input UpdateAddressInput {
    province: String
    provinceId: String
    district: String
    districtId: String
    ward: String
    wardId: String
  }

  type Address {
    id: String
    province: String
    provinceId: String
    district: String
    districtId: String
    ward: String
    wardId: String
    createdAt: DateTime
    updatedAt: DateTime
  }

  type AddressPageData {
    data: [Address]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
