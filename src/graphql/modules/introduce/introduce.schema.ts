import { gql } from "apollo-server-express";

const schema = gql`
  extend type Query {
    getAllIntroduce(q: QueryGetListInput): IntroducePageData
    getOneIntroduce(id: ID!): Introduce
    getMyIntroduces(q: QueryGetListInput): IntroducePageData
    "Lấy thông tin người đã giới thiệu mình"
    getMyReferrer: Introduce
    # Add Query
  }

  extend type Mutation {
    createIntroduce(data: CreateIntroduceInput!): Introduce
    updateIntroduce(id: ID!, data: UpdateIntroduceInput!): Introduce
    deleteOneIntroduce(id: ID!): Introduce
    "Cập nhật người giới thiệu theo mã giới thiệu"
    updateMyReferrer(introduceCode: String!): Introduce
    # Add Mutation
  }

  input CreateIntroduceInput {
    "ID người giới thiệu"
    referrerId: String!
    "ID người được giới thiệu"
    refereeId: String!
  }

  input UpdateIntroduceInput {
    "Trạng thái khoá"
    blocked: Boolean
  }

  type IntroduceOrder {
    orderId: String
    discountPrice: Float
  }

  type Introduce {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    "ID người giới thiệu"
    referrerId: String
    "ID người được giới thiệu"
    refereeId: String
    "Trạng thái khoá"
    blocked: Boolean
    "Danh sách đơn hàng liên quan"
    orders: [IntroduceOrder]

    "Thông tin người giới thiệu"
    referrer: Customer
    "Thông tin người được giới thiệu"
    referee: Customer
  }

  type IntroducePageData {
    data: [Introduce]
    total: Int
    pagination: Pagination
  }
`;

export default schema;
