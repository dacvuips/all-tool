import config from "config";
import { SePayPgClient } from "sepay-pg-node";

/**
 * Payload IPN gửi từ SePay PG tới server của chúng ta
 */
export interface SePayPGIPNPayload {
  timestamp: number;
  notification_type: "ORDER_PAID" | "TRANSACTION_VOID";
  order: {
    id: string;
    order_id: string;
    order_status: "CAPTURED" | "CANCELLED" | "AUTHENTICATION_NOT_NEEDED";
    order_currency: string;
    order_amount: string;
    order_invoice_number: string;
    custom_data: any;
    user_agent: string;
    ip_address: string;
    order_description: string;
  };
  transaction: {
    id: string;
    payment_method: string;
    transaction_id: string;
    transaction_type: string;
    transaction_date: string;
    transaction_status: string;
    transaction_amount: string;
    transaction_currency: string;
    authentication_status: string;
    card_number: string | null;
    card_holder_name: string | null;
    card_expiry: string | null;
    card_funding_method: string | null;
    card_brand: string | null;
  };
  customer: { id: string; customer_id: string } | null;
  agreement: any | null;
}

/**
 * Tham số tạo form checkout
 */
export interface CreateCheckoutParams {
  orderInvoiceNumber: string;
  orderAmount: number;
  orderDescription: string;
  customerId?: string;
  /** BANK_TRANSFER | NAPAS_BANK_TRANSFER */
  paymentMethod?: "BANK_TRANSFER" | "NAPAS_BANK_TRANSFER";
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

/**
 * Dữ liệu trả về khi tạo form thanh toán.
 * Frontend dùng checkoutUrl làm form action (POST),
 * parse formFieldsJson thành object rồi render hidden inputs.
 */
export interface SePayPGCheckoutFormData {
  /** URL dùng làm action của form POST */
  checkoutUrl: string;
  /** JSON string chứa tất cả hidden field (key-value) đã có chữ ký */
  formFieldsJson: string;
}

/**
 * SePay Payment Gateway Service
 * Sử dụng SDK chính thức `sepay-pg-node`.
 *
 * Tài liệu: https://developer.sepay.vn/vi/cong-thanh-toan/sdk/nodejs
 */
class SePayPGService {
  /**
   * Khởi tạo SePayPgClient với config từ node-config.
   * Tạo mới mỗi lần gọi để đảm bảo luôn dùng config mới nhất.
   */
  private getClient(): SePayPgClient {
    return new SePayPgClient({
      env: config.get<boolean>("sepayPG.sandboxMode") ? "sandbox" : "production",
      merchant_id: config.get<string>("sepayPG.merchantId"),
      secret_key: config.get<string>("sepayPG.secretKey"),
    });
  }

  /**
   * Tạo dữ liệu form thanh toán SePay PG.
   * SDK tự động:
   *   - Sinh chữ ký HMAC-SHA256 theo đúng thứ tự field
   *   - Tạo URL checkout đúng cho từng môi trường (sandbox/production)
   */
  createCheckoutFormData(params: CreateCheckoutParams): SePayPGCheckoutFormData {
    const client = this.getClient();

    const formFields = client.checkout.initOneTimePaymentFields({
      operation: "PURCHASE",
      payment_method: params.paymentMethod ?? "BANK_TRANSFER",
      order_invoice_number: params.orderInvoiceNumber,
      order_amount: Math.round(params.orderAmount),
      currency: "VND",
      order_description: params.orderDescription,
      customer_id: params.customerId,
      success_url: params.successUrl,
      error_url: params.errorUrl,
      cancel_url: params.cancelUrl,
    });

    const checkoutUrl = client.checkout.initCheckoutUrl();

    return {
      checkoutUrl,
      formFieldsJson: JSON.stringify(formFields),
    };
  }

  /**
   * Lấy chi tiết đơn hàng từ SePay PG theo order_invoice_number
   */
  async getOrderDetail(orderInvoiceNumber: string): Promise<any> {
    const client = this.getClient();
    const res = await client.order.retrieve(orderInvoiceNumber);
    return res.data;
  }

  /**
   * Lấy danh sách đơn hàng từ SePay PG
   */
  async getOrders(filters?: {
    perPage?: number;
    q?: string;
    orderStatus?: string;
    customerId?: string;
    createdAt?: string;
    fromCreatedAt?: string;
    toCreatedAt?: string;
    sort?: { created_at?: string };
  }): Promise<any> {
    const client = this.getClient();
    const res = await client.order.all({
      per_page: filters?.perPage,
      q: filters?.q,
      order_status: filters?.orderStatus,
      customer_id: filters?.customerId ?? null,
      created_at: filters?.createdAt,
      from_created_at: filters?.fromCreatedAt,
      to_created_at: filters?.toCreatedAt,
      sort: filters?.sort,
    });
    return res.data;
  }

  /**
   * Hủy đơn hàng trên SePay PG (dành cho thanh toán bằng quét mã QR)
   */
  async cancelOrder(orderInvoiceNumber: string): Promise<any> {
    const client = this.getClient();
    const res = await client.order.cancel(orderInvoiceNumber);
    return res.data;
  }

  /**
   * Hủy giao dịch (dành cho thanh toán bằng thẻ tín dụng)
   */
  async voidTransaction(orderInvoiceNumber: string): Promise<any> {
    const client = this.getClient();
    const res = await client.order.voidTransaction(orderInvoiceNumber);
    return res.data;
  }
}

export const sePayPGService = new SePayPGService();
