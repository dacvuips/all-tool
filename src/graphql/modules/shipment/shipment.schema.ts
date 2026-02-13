import { gql } from "apollo-server-express";

/**
 * GraphQL Schema cho Shipment (đơn vận chuyển)
 */
const schema = gql`
  extend type Query {
    # Lấy danh sách tất cả shipments với phân trang
    getAllShipment(q: QueryGetListInput): ShipmentPageData

    # Lấy chi tiết một shipment theo ID
    getOneShipment(id: ID!): Shipment

    # Lấy danh sách shipments theo orderId
    getShipmentsByOrderId(orderId: ID!): [Shipment]

    # Lấy shipment theo tracking code
    getShipmentByTrackingCode(trackingCode: String!): Shipment
  }

  extend type Mutation {
    # Tạo shipment mới (draft)
    createShipment(data: CreateShipmentInput!): Shipment

    # Cập nhật thông tin shipment
    updateShipment(id: ID!, data: UpdateShipmentInput!): Shipment

    # Xóa shipment
    deleteOneShipment(id: ID!): Shipment

    # Cập nhật trạng thái shipment
    updateShipmentStatus(id: ID!, status: String!, note: String): Shipment

    # Thêm log cho shipment
    addShipmentLog(id: ID!, log: ShipmentLogInput!): Shipment
  }

  # Type cho Shipment
  type Shipment {
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    # Liên kết
    orderId: ID!

    # Nhà cung cấp
    provider: String! # GHN, GHTK, etc.
    serviceCode: String! # EXPRESS, STANDARD, etc.
    # Mã vận đơn và trạng thái
    trackingCode: String
    status: String!

    # Phí
    codAmount: Float!
    shippingFee: Float!
    insuranceValue: Float
    totalFee: Float
    feeBreakdown: FeeBreakdown

    # Thông tin từ nhà cung cấp
    orderCode: String
    sortCode: String
    transType: String
    wardEncode: String
    districtEncode: String

    # Thông tin gửi/nhận
    sender: Sender!
    receiver: Receiver!

    # Gói hàng
    package: Package!

    # Metadata
    providerResponse: Mixed
    logs: [ShipmentLog]
    note: String

    # Thời gian
    estimatedDeliveryDate: DateTime
    actualDeliveryDate: DateTime
  }

  # Type cho người gửi
  type Sender {
    name: String!
    phone: String!
    address: String!
    wardId: Int
    districtId: Int
    provinceId: Int
  }

  # Type cho người nhận
  type Receiver {
    name: String!
    phone: String!
    address: String!
    wardId: Int
    districtId: Int
    provinceId: Int
  }

  # Type cho gói hàng
  type Package {
    weight: Float! # gram
    length: Float # cm
    width: Float # cm
    height: Float # cm
    itemsCount: Int
    description: String
  }

  # Type cho chi tiết phí
  type FeeBreakdown {
    main_service: Float
    insurance: Float
    station_do: Float
    station_pu: Float
    return: Float
    r2s: Float
    coupon: Float
    cod_failed_fee: Float
  }

  # Type cho log
  type ShipmentLog {
    status: String!
    description: String
    location: String
    note: String
    metadata: Mixed
    createdAt: DateTime
  }

  # Type cho phân trang
  type ShipmentPageData {
    data: [Shipment]
    total: Int
    pagination: Pagination
  }

  # Input cho tạo shipment
  input CreateShipmentInput {
    orderId: ID!
    provider: String!
    serviceCode: String
    trackingCode: String
    status: String
    codAmount: Float!
    shippingFee: Float!
    insuranceValue: Float
    totalFee: Float
    feeBreakdown: FeeBreakdownInput
    orderCode: String
    sortCode: String
    transType: String
    wardEncode: String
    districtEncode: String
    sender: SenderInput!
    receiver: ReceiverInput!
    package: PackageInput!
    note: String
    estimatedDeliveryDate: DateTime
  }

  # Input cho cập nhật shipment
  input UpdateShipmentInput {
    provider: String
    serviceCode: String
    trackingCode: String
    status: String
    codAmount: Float
    shippingFee: Float
    insuranceValue: Float
    totalFee: Float
    feeBreakdown: FeeBreakdownInput
    orderCode: String
    sortCode: String
    transType: String
    wardEncode: String
    districtEncode: String
    sender: SenderInput
    receiver: ReceiverInput
    package: PackageInput
    providerResponse: Mixed
    note: String
    estimatedDeliveryDate: DateTime
    actualDeliveryDate: DateTime
  }

  # Input cho sender
  input SenderInput {
    name: String!
    phone: String!
    address: String!
    wardId: Int
    districtId: Int
    provinceId: Int
  }

  # Input cho receiver
  input ReceiverInput {
    name: String!
    phone: String!
    address: String!
    wardId: Int
    districtId: Int
    provinceId: Int
  }

  # Input cho package
  input PackageInput {
    weight: Float!
    length: Float
    width: Float
    height: Float
    itemsCount: Int
    description: String
  }

  # Input cho fee breakdown
  input FeeBreakdownInput {
    main_service: Float
    insurance: Float
    station_do: Float
    station_pu: Float
    return: Float
    r2s: Float
    coupon: Float
    cod_failed_fee: Float
  }

  # Input cho log
  input ShipmentLogInput {
    status: String!
    description: String
    location: String
    note: String
    metadata: Mixed
  }
`;

export default schema;
