import gql from "graphql-tag";
import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

/**
 * Interface cho người gửi
 */
export interface Sender {
  name: string;
  phone: string;
  address: string;
  wardId?: number;
  districtId?: number;
  provinceId?: number;
}

/**
 * Interface cho người nhận
 */
export interface Receiver {
  name: string;
  phone: string;
  address: string;
  wardId?: number;
  districtId?: number;
  provinceId?: number;
}

/**
 * Interface cho gói hàng
 */
export interface Package {
  weight: number; // gram
  length?: number; // cm
  width?: number; // cm
  height?: number; // cm
  itemsCount?: number;
  description?: string;
}

/**
 * Interface cho log shipment
 */
export interface ShipmentLog {
  status: string;
  description?: string;
  location?: string;
  note?: string;
  metadata?: any;
  createdAt: Date;
}

/**
 * Enum trạng thái shipment
 */
export enum ShipmentStatusEnum {
  DRAFT = "draft",
  CREATED = "created",
  PICKED = "picked",
  SHIPPING = "shipping",
  DELIVERED = "delivered",
  RETURNED = "returned",
  CANCELLED = "cancelled",
  FAILED = "failed",
}

/**
 * Interface chính cho Shipment
 */
export interface Shipment extends BaseModel {
  orderId: string;
  provider: string; // GHN, GHTK, etc.
  serviceCode: string; // EXPRESS, STANDARD, etc.
  trackingCode?: string;
  status: ShipmentStatusEnum;
  codAmount: number;
  shippingFee: number;
  insuranceValue?: number;
  sender: Sender;
  receiver: Receiver;
  package: Package;
  providerResponse?: any;
  logs?: ShipmentLog[];
  note?: string;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
}

/**
 * Repository xử lý các tương tác với API GraphQL cho Shipment
 */
export class ShipmentRepository extends CrudRepository<Shipment> {
  apiName: string = "Shipment";
  displayName: string = t("đơn vận chuyển");

  // Fragment ngắn gọn - dùng cho danh sách
  shortFragment: string = this.parseFragment(`
    id: String
    orderId: ID
    provider: String
    serviceCode: String
    trackingCode: String
    status: String
    codAmount: Float
    shippingFee: Float
    totalFee: Float
    orderCode: String
    sortCode: String
    transType: String
    createdAt: DateTime
    updatedAt: DateTime
     logs {
      status
      description
      location
      note
      metadata
      createdAt
    }
  `);

  // Fragment đầy đủ - dùng cho chi tiết
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    orderId: ID
    provider: String
    serviceCode: String
    trackingCode: String
    status: String
    codAmount: Float
    shippingFee: Float
    insuranceValue: Float
    totalFee: Float
    feeBreakdown {
      main_service
      insurance
      station_do
      station_pu
      return
      r2s
      coupon
      cod_failed_fee
    }
    orderCode: String
    sortCode: String
    transType: String
    wardEncode: String
    districtEncode: String
    sender {
      name
      phone
      address
      wardId
      districtId
      provinceId
    }
    receiver {
      name
      phone
      address
      wardId
      districtId
      provinceId
    }
    package {
      weight
      length
      width
      height
      itemsCount
      description
    }
    providerResponse
    logs {
      status
      description
      location
      note
      metadata
      createdAt
    }
    note
    estimatedDeliveryDate: DateTime
    actualDeliveryDate: DateTime
  `);

  /**
   * Lấy danh sách shipments theo orderId
   */
  async getShipmentsByOrderId(orderId: string): Promise<Shipment[]> {
    return this.apollo
      .query({
        query: gql`
          query GetShipmentsByOrderId($orderId: ID!) {
            getShipmentsByOrderId(orderId: $orderId) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { orderId },
        fetchPolicy: "no-cache",
      })
      .then((res) => res.data.getShipmentsByOrderId as Shipment[]);
  }

  /**
   * Lấy shipment theo tracking code
   */
  async getShipmentByTrackingCode(trackingCode: string): Promise<Shipment> {
    return this.apollo
      .query({
        query: gql`
          query GetShipmentByTrackingCode($trackingCode: String!) {
            getShipmentByTrackingCode(trackingCode: $trackingCode) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { trackingCode },
        fetchPolicy: "no-cache",
      })
      .then((res) => res.data.getShipmentByTrackingCode as Shipment);
  }

  /**
   * Cập nhật trạng thái shipment
   */
  async updateShipmentStatus(
    id: string,
    status: ShipmentStatusEnum,
    note?: string
  ): Promise<Shipment> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation UpdateShipmentStatus($id: ID!, $status: String!, $note: String) {
            updateShipmentStatus(id: $id, status: $status, note: $note) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { id, status, note },
      })
      .then((res) => res.data.updateShipmentStatus as Shipment);
  }

  /**
   * Thêm log cho shipment
   */
  async addShipmentLog(id: string, log: Omit<ShipmentLog, "createdAt">): Promise<Shipment> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation AddShipmentLog($id: ID!, $log: ShipmentLogInput!) {
            addShipmentLog(id: $id, log: $log) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { id, log },
      })
      .then((res) => res.data.addShipmentLog as Shipment);
  }
}

// Export instance để sử dụng trong các component
export const shipmentService = new ShipmentRepository();
