import { gql } from "apollo-server-express";
import { UserGender } from "../../../libs/dal/user/user.interface";
import { UserRoleEnum, UserScopeEnum } from "../../../libs/shared";

const schema = gql`
extend type Query {
  getAllUser(q: QueryGetListInput): UserPageData
  getOneUser(id: ID!): User
  userGetMe: User
}

extend type Mutation {
  createUser(data: CreateUserInput!): User
  updateUser(id: ID!, data: UpdateUserInput!): User
  deleteOneUser(id: ID!): User
  deleteManyUser(ids: [ID]): Int
  login(idToken: String!, deviceId: String, deviceToken: String): LoginData
  updateUserPassword(id: ID!, password: String!): User
  userUpdateMe(data: UserUpdateMeInput!): User
  # Add Mutation
}

input CreateUserInput {
  email: String!
  password: String!
  name: String
  phone: String
  address: String
  avatar: String
  provinceId: String
  districtId: String
  wardId: String
  """${Object.values(UserRoleEnum).join("|")}"""
  role: String
  "Phân quyền ${Object.values(UserScopeEnum)}"
  scopes: [String]
  status:String
  authorityId:String
  code:String
  gameIdsPermission:[String]
}

input UpdateUserInput {
  email:String
  name: String
  phone: String
  address: String
  avatar: String
  provinceId: String
  districtId: String
  wardId: String
  """${Object.values(UserRoleEnum).join("|")}"""
  role: String
  "Phân quyền ${Object.values(UserScopeEnum)}"
  scopes: [String]
  authorityId:String
  "Chức vụ"
  position: String
  "Ngày sinh"
  birthday: DateTime
  "Giới tính ${Object.values(UserGender)}"
  gender: String
  gameIdsPermission:[String]
}

input UserUpdateMeInput {
  name: String
  phone: String
  address: String
  avatar: String
  provinceId: String
  districtId: String
  wardId: String
  """${Object.values(UserRoleEnum).join("|")}"""
  role: String
  
  "Chức vụ"
  position: String
  "Ngày sinh"
  birthday: DateTime
  "Giới tính ${Object.values(UserGender)}"
  gender: String
}

type User {
  id: String
  uid: String
  email: String
  name: String
  phone: String
  address: String
  avatar: String
  province: String
  district: String
  ward: String
  provinceId: String
  districtId: String
  wardId: String
  """${Object.values(UserRoleEnum).join("|")}"""
  role: String
  unseenNotify: Int
  createdAt: DateTime
  updatedAt: DateTime
  "Phân quyền ${Object.values(UserScopeEnum)}"
  scopes: [String]
  authorityId:String
  authorityIds: [String]
  code:String
  "Ngày sinh"
  birthday: DateTime
  "Giới tính ${Object.values(UserGender)}"
  gender: String
  "Chức vụ"
  position: String
  status:String
  banks:Mixed
  logs: [Mixed]
  isPartnerGroupOwner:Boolean
  partnerGroupId:String
  gameIdsPermission:[String]
  root:Boolean
}

type LoginData {
  user: User
  token: String
}

type UserPageData {
  data: [User]
  total: Int
  pagination: Pagination
}
`;

export default schema;
