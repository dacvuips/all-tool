import gql from "graphql-tag";

import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository, GetAllOptions, GetListData, QueryInput } from "../crud.repo";
import { ProductApp } from "../product/productApp.repo";

export interface OrderItem {
  productName: string;
  thumbnail?: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  subtotal: number;
}

export interface ShippingAddress {
  recipientName: string;
  phone: string;
  email?: string;
  address: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  note?: string;
}
export interface PaymentInfo {
  method: PaymentMethod;
  bankImage?: string;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
  metadata?: any;
}
export interface ShopAddress {
  name: string;
  phone: string;
  email?: string;
  address: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;
  postalCode?: string;
}

export enum PaymentMethod {
  COD = "COD",
  BANK = "BANK",
  MOMO = "MOMO",
  ZALO_PAY = "ZALO_PAY",
  CREDIT_CARD = "CREDIT_CARD",
  // Cổng thanh toán SePay PG
  SEPAY_PG = "SEPAY_PG",
}

export interface PaymentTimeRemaining {
  minutes: number;
  seconds: number;
  expired: boolean;
}

export enum OrderStatus {
  CREATED = "CREATED",
  STATUS_CHANGED = "STATUS_CHANGED",
  PAYMENT_UPDATED = "PAYMENT_UPDATED",
  PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED",
  SHIPPING_STARTED = "SHIPPING_STARTED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  CONFIRMED = "CONFIRMED",
  PROCESSING = "PROCESSING",
  ORDER_UPDATED = "ORDER_UPDATED",
}

export enum PaymentStatus {
  PAYMENT_INITIATED = "PAYMENT_INITIATED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_CANCELLED = "PAYMENT_CANCELLED",
  PAYMENT_REFUNDED = "PAYMENT_REFUNDED",
  PAYMENT_PARTIALLY_REFUNDED = "PAYMENT_PARTIALLY_REFUNDED",
  PAYMENT_TIMEOUT = "PAYMENT_TIMEOUT",
  PAYMENT_UNPAID = "PAYMENT_UNPAID",
}
export enum OrderChangeEventEnum {
  CREATED = "created",
  UPDATED = "updated",
  CANCELLED = "cancelled",
  STATUS_CHANGED = "status_changed",
  PAYMENT_CHANGED = "payment_changed",
}
export interface OrderLog {
  status: OrderStatus;
  des?: string;
  note?: string;
  meta?: any;
  createdAt: Date;
  creatorId?: string;
}

export interface PaymentLog {
  status: PaymentStatus;
  des?: string;
  note?: string;
  meta?: any;
  createdAt: Date;
  creatorId?: string;
  amount?: number;
  transactionId?: string;
}

export interface Order extends BaseModel {
  customerId?: string;
  sessionId?: string;

  orderNumber?: string;
  status?: OrderStatus;
  productId?: string;
  items?: OrderItem[];

  subtotal?: number;
  shippingFee?: number;
  tax?: number;
  discount?: number;
  totalAmount?: number;
  subscriptionPlan?: string;
  type?: "TOOL" | "RECAPTCHA";
  shippingAddress?: ShippingAddress;
  shopAddress?: ShopAddress;

  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentInfo?: PaymentInfo;

  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;

  customerNote?: string;
  adminNote?: string;

  orderLogs?: OrderLog[];
  paymentLogs?: PaymentLog[];
  shipmentIds?: string[]; // Danh sách ID của các shipment
  product?: ProductApp;
}

export interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  shipping: number;
  delivered: number;
  cancelled: number;
  totalSpent: number;
}

export interface ShippingResult {
  success: boolean;
  message: string;
  trackingNumber?: string;
  shippingLabel?: string;
}

export class OrderRepository extends CrudRepository<Order> {
  apiName: string = "Order";
  displayName: string = t("đơn hàng");
  shortFragment: string = this.parseFragment(`
    id
    orderNumber
    status
    paymentStatus
    totalAmount 
    subscriptionPlan
    type
    customerId  
     paymentInfo {
      method 
      bankImage 
      bankCode 
      bankName
      accountNumber
      accountName
      bin
      metadata
    }
    createdAt
    updatedAt
  `);
  fullFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt
    customerId
    sessionId 
    orderNumber
    status
    
    subtotal 
    tax
    discount
    totalAmount
    subscriptionPlan
    type
    paymentMethod
    paymentStatus
    paymentInfo {
      method 
      bankImage 
      bankCode 
      bankName
      accountNumber
      accountName
      bin
      metadata
    }
    paidAt
    shippedAt
    deliveredAt
    cancelledAt
    customerNote
    adminNote
    orderLogs {
      status
      des
      note
      meta
      createdAt
      creatorId
    }
    paymentLogs {
      status
      des
      note
      meta
      createdAt
      creatorId
      amount
      transactionId
    }
    
    product{
      slug
    }
  `);

  async getMyOrders(limit: number = 20): Promise<Order[]> {
    return this.apollo
      .query({
        query: gql`
          query GetMyOrders($limit: Int) {
            getMyOrders(limit: $limit) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { limit },
        fetchPolicy: "no-cache",
      })
      .then((res) => res.data.getMyOrders as Order[]);
  }

  async getOrderByNumber(orderNumber: string): Promise<Order> {
    return this.apollo
      .query({
        query: gql`
          query GetOrderByNumber($orderNumber: String!) {
            getOrderByNumber(orderNumber: $orderNumber) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { orderNumber },
        fetchPolicy: "no-cache",
      })
      .then((res) => res.data.getOrderByNumber as Order);
  }

  async getMyOrderStats(): Promise<OrderStats> {
    return this.apollo
      .query({
        query: gql`
          query GetMyOrderStats {
            getMyOrderStats {
              total
              pending
              confirmed
              shipping
              delivered
              cancelled
              totalSpent
            }
          }
        `,
        fetchPolicy: "no-cache",
      })
      .then((res) => res.data.getMyOrderStats as OrderStats);
  }

  // async createOrder(creditAmount: number): Promise<{ order: Order }> {
  //   return this.apollo
  //     .mutate({
  //       mutation: gql`
  //         mutation CreateOrder($creditAmount: Float!) {
  //           createOrder(creditAmount: $creditAmount) {
  //             order {
  //               ${this.shortFragment}
  //             }
  //           }
  //         }
  //       `,
  //       variables: { creditAmount },
  //     })
  //     .then((res) => res.data.createOrder as { order: Order } | null);
  // }

  /**
   * Tạo form thanh toán qua cổng SePay PG.
   * Frontend dùng checkoutUrl làm form action (POST) và parse formFieldsJson
   * để render các hidden input rồi auto-submit form.
   */
  async createSePayPGCheckout(
    subscriptionPlan: string,
    orderId?: string,
    type?: "recaptcha" | "tool"
  ): Promise<SePayPGCheckoutData> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation CreateSePayPGCheckout($subscriptionPlan: String!, $orderId: ID, $type: String) {
            createSePayPGCheckout(
              subscriptionPlan: $subscriptionPlan
              orderId: $orderId
              type: $type
            ) {
              checkoutUrl
              formFieldsJson
            }
          }
        `,
        variables: { subscriptionPlan, orderId, type },
      })
      .then((res) => res.data.createSePayPGCheckout as SePayPGCheckoutData);
  }

  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation CancelOrder($orderId: ID!, $reason: String) {
            cancelOrder(orderId: $orderId, reason: $reason) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { orderId, reason },
      })
      .then((res) => res.data.cancelOrder as Order);
  }

  async updateOrder(orderId: string, data: Partial<Order>): Promise<Order> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation UpdateOrder($orderId: ID!, $data: UpdateOrderInput!) {
            updateOrder(orderId: $orderId, data: $data) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { orderId, data },
      })
      .then((res) => res.data.updateOrder as Order);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation UpdateOrderStatus($orderId: ID!, $status: OrderStatus!) {
            updateOrderStatus(orderId: $orderId, status: $status) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { orderId, status },
      })
      .then((res) => res.data.updateOrderStatus as Order);
  }

  async updatePaymentStatus(orderId: string, status: string, reason?: string): Promise<Order> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation UpdatePaymentStatus($orderId: ID!, $status: String!, $reason: String) {
            updatePaymentStatus(orderId: $orderId, status: $status, reason: $reason) {
              ${this.fullFragment}
            }
          }
        `,
        variables: { orderId, status, reason },
      })
      .then((res) => res.data.updatePaymentStatus as Order);
  }

  async createShopeExpressShipping(orderId: string): Promise<ShippingResult> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation CreateShopeExpressShipping($orderId: ID!) {
            createShopeExpressShipping(orderId: $orderId) {
              success
              message
              trackingNumber
              shippingLabel
            }
          }
        `,
        variables: { orderId },
      })
      .then((res) => res.data.createShopeExpressShipping as ShippingResult);
  }

  async createGiaoHangNhanhShipping(orderId: string): Promise<ShippingResult> {
    return this.apollo
      .mutate({
        mutation: gql`
          mutation CreateGiaoHangNhanhShipping($orderId: ID!) {
            createGiaoHangNhanhShipping(orderId: $orderId) {
              success
              message
              trackingNumber
              shippingLabel
            }
          }
        `,
        variables: { orderId },
      })
      .then((res) => res.data.createGiaoHangNhanhShipping as ShippingResult);
  }

  async getOneOrderByGuest(): Promise<Order> {
    return this.query({
      query: `getOneOrderByGuest{ id
    createdAt
    updatedAt
    customerId
    sessionId
   
    orderNumber
    paymentMethod
    paymentStatus
    subtotal
    shippingFee
    tax
    discount
    totalAmount
    subscriptionPlan
    shippingAddress {
      recipientName
      phone
      email
      address
      ward
      district
      province
      country
      postalCode
      note
    }
    paymentInfo {
      method 
      bankImage 
      bankCode
      bankName
      accountNumber
      accountName
      bin
      metadata
    }
    }`,
      variablesParams: "",
      options: {
        variables: {},
      },
    }).then((res) => res.data.g0);
  }
  async getOrdersByGuest({
    query = { limit: 10 },
    fragment = this.fullFragment,
    cache = true,
  }: GetAllOptions = {}): Promise<GetListData<Order>> {
    if ((query as QueryInput).limit == 0) {
      (query as QueryInput).limit = 1000;
    }
    return this.query({
      query: `getOrdersByGuest(q: $query) {data{${fragment}} total pagination { limit page total }  }`,
      variablesParams: `($query: QueryGetListInput)`,
      options: {
        variables: {
          query: query,
        },
        fetchPolicy: cache == false ? "no-cache" : "cache-first",
      },
    }).then((res) => res.data.g0);
  }

  subscribeOrderChanged(orderId?: string) {
    // console.log("subscribe order change", { orderId });
    const orderIdParam = orderId ? `orderId: "${orderId}"` : "";

    return this.subscribe({
      query: `orderChanged(${orderIdParam}) { orderId event data }`,
    }).map((res) => res.data.g0 as OrderChange);
  }

  /**
   * Tạo đơn vận chuyển với nhà cung cấp
   */
  async createShippingOrder(input: {
    orderId: string;
    shippingProviderId: string;
    serviceCode: string;
    insuranceValue?: number;
    shopAddressId?: string;
    note?: string;
  }): Promise<CreateShippingOrderResponse> {
    return await this.mutate({
      mutation: `createShippingOrder(input: $input)  { success message shipmentId trackingCode data
        }`,
      variablesParams: `($input: CreateShippingOrderInput!)`,
      options: {
        variables: {
          input,
        },
      },
    }).then((res) => res.data["g0"]);
  }
}

/**
 * Dữ liệu form thanh toán SePay PG trả về từ backend.
 * Frontend POST form tới checkoutUrl với các hidden field từ formFieldsJson.
 */
export interface SePayPGCheckoutData {
  /** URL dùng làm action của form POST tới cổng SePay */
  checkoutUrl: string;
  /** JSON string chứa tất cả hidden field đã ký (merchant, operation, payment_method, order_invoice_number, order_amount, currency, ..., signature) */
  formFieldsJson: string;
}

export interface CreateShippingOrderResponse {
  success: boolean;
  message?: string;
  shipmentId?: string;
  trackingCode?: string;
  data?: any;
}

export type OrderChange = {
  orderId: string;
  event: OrderChangeEventEnum;
  data: any;
};

export const orderService = new OrderRepository();
