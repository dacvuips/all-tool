import config from "config";
import crypto from "crypto";
import axios from "axios";

/**
 * Cấu hình SePay Payment Gateway
 */
interface SePayPGConfig {
  merchantId: string;
  secretKey: string;
  sandboxMode: boolean;
}

/**
 * Dữ liệu trả về khi tạo form thanh toán
 */
export interface SePayPGCheckoutFormData {
  merchant: string;
  currency: string;
  orderAmount: string;
  operation: string;
  orderDescription: string;
  orderInvoiceNumber: string;
  customerId?: string;
  paymentMethod?: string;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
  signature: string;
  checkoutUrl: string;
}

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
  paymentMethod?: string;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

/**
 * Danh sách field cần ký theo đúng thứ tự quy định của SePay PG
 * QUAN TRỌNG: Không thay đổi thứ tự này, sẽ dẫn đến sai chữ ký
 */
const SIGNED_FIELDS_ORDER = [
  "merchant",
  "operation",
  "payment_method",
  "order_amount",
  "currency",
  "order_invoice_number",
  "order_description",
  "customer_id",
  "success_url",
  "error_url",
  "cancel_url",
];

/**
 * SePay Payment Gateway Service
 * Cung cấp các chức năng:
 * - Tạo chữ ký HMAC-SHA256 cho form thanh toán
 * - Tạo dữ liệu form checkout
 * - Gọi API SePay PG (lấy danh sách đơn, chi tiết đơn, hủy đơn)
 */
class SePayPGService {
  /**
   * Lấy cấu hình SePay PG từ node-config
   */
  private get cfg(): SePayPGConfig {
    return {
      merchantId: config.get<string>("sepayPG.merchantId"),
      secretKey: config.get<string>("sepayPG.secretKey"),
      sandboxMode: config.get<boolean>("sepayPG.sandboxMode"),
    };
  }

  /**
   * URL submit form checkout (POST)
   * Sandbox: https://pay-sandbox.sepay.vn/v1/checkout/init
   * Production: https://pay.sepay.vn/v1/checkout/init
   */
  get checkoutUrl(): string {
    return this.cfg.sandboxMode
      ? "https://pay-sandbox.sepay.vn/v1/checkout/init"
      : "https://pay.sepay.vn/v1/checkout/init";
  }

  /**
   * Base URL gọi REST API của SePay PG
   * Sandbox: https://pgapi-sandbox.sepay.vn
   * Production: https://pgapi.sepay.vn (TODO: xác nhận URL production)
   */
  get apiBaseUrl(): string {
    return this.cfg.sandboxMode
      ? "https://pgapi-sandbox.sepay.vn"
      : "https://pgapi.sepay.vn";
  }

  /**
   * Tạo chữ ký HMAC-SHA256 theo quy tắc SePay PG:
   * 1. Lọc các field có giá trị theo đúng thứ tự SIGNED_FIELDS_ORDER
   * 2. Ghép thành chuỗi: "field1=value1,field2=value2,..."
   * 3. HMAC-SHA256(chuỗi, secretKey) → binary → base64
   */
  generateSignature(fields: Record<string, string>): string {
    const { secretKey } = this.cfg;

    // Xây dựng chuỗi ký theo đúng thứ tự, chỉ lấy field có giá trị
    const signedParts: string[] = [];
    for (const fieldName of SIGNED_FIELDS_ORDER) {
      const value = fields[fieldName];
      if (value !== undefined && value !== null && value !== "") {
        signedParts.push(`${fieldName}=${value}`);
      }
    }

    const signedString = signedParts.join(",");

    // Tính HMAC-SHA256 dạng binary rồi encode base64
    return crypto.createHmac("sha256", secretKey).update(signedString).digest("base64");
  }

  /**
   * Tạo toàn bộ dữ liệu cần thiết để render và submit form thanh toán
   * Trả về object chứa tất cả các hidden field và URL checkout
   */
  createCheckoutFormData(params: CreateCheckoutParams): SePayPGCheckoutFormData {
    const { merchantId } = this.cfg;

    // Chuẩn bị object field để ký (key theo chuẩn snake_case của SePay)
    const fields: Record<string, string> = {
      merchant: merchantId,
      currency: "VND",
      order_amount: String(Math.round(params.orderAmount)),
      operation: "PURCHASE",
      order_description: params.orderDescription,
      order_invoice_number: params.orderInvoiceNumber,
      success_url: params.successUrl,
      error_url: params.errorUrl,
      cancel_url: params.cancelUrl,
    };

    // Thêm các field tuỳ chọn nếu được cung cấp
    if (params.customerId) {
      fields.customer_id = params.customerId;
    }
    if (params.paymentMethod) {
      fields.payment_method = params.paymentMethod;
    }

    const signature = this.generateSignature(fields);

    return {
      merchant: merchantId,
      currency: "VND",
      orderAmount: fields.order_amount,
      operation: "PURCHASE",
      orderDescription: params.orderDescription,
      orderInvoiceNumber: params.orderInvoiceNumber,
      customerId: params.customerId,
      paymentMethod: params.paymentMethod,
      successUrl: params.successUrl,
      errorUrl: params.errorUrl,
      cancelUrl: params.cancelUrl,
      signature,
      checkoutUrl: this.checkoutUrl,
    };
  }

  /**
   * Tạo Authorization header để gọi REST API của SePay PG
   * Format: Basic base64(merchantId:secretKey)
   */
  private getAuthHeader(): string {
    const { merchantId, secretKey } = this.cfg;
    const credentials = Buffer.from(`${merchantId}:${secretKey}`).toString("base64");
    return `Basic ${credentials}`;
  }

  /**
   * Lấy chi tiết một đơn hàng từ SePay PG theo orderId (ID của SePay, ví dụ SEPAY-68BA83CE637C1)
   */
  async getOrderDetail(sePayOrderId: string): Promise<any> {
    const response = await axios.get(`${this.apiBaseUrl}/v1/order/detail/${sePayOrderId}`, {
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  /**
   * Lấy danh sách đơn hàng từ SePay PG với các bộ lọc tùy chọn
   */
  async getOrders(filters?: {
    page?: number;
    perPage?: number;
    q?: string;
    orderStatus?: "CAPTURED" | "CANCELLED" | "AUTHENTICATION_NOT_NEEDED";
    customerId?: string;
    createdAt?: string;
    fromCreatedAt?: string;
    endCreatedAt?: string;
    sort?: string;
  }): Promise<any> {
    const params: Record<string, any> = {};
    if (filters?.page) params.page = filters.page;
    if (filters?.perPage) params.per_page = filters.perPage;
    if (filters?.q) params.q = filters.q;
    if (filters?.orderStatus) params.order_status = filters.orderStatus;
    if (filters?.customerId) params.customer_id = filters.customerId;
    if (filters?.createdAt) params.created_at = filters.createdAt;
    if (filters?.fromCreatedAt) params.from_created_at = filters.fromCreatedAt;
    if (filters?.endCreatedAt) params.end_created_at = filters.endCreatedAt;
    if (filters?.sort) params.sort = filters.sort;

    const response = await axios.get(`${this.apiBaseUrl}/v1/order`, {
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
      },
      params,
    });
    return response.data;
  }

  /**
   * Hủy đơn hàng trên SePay PG
   * Lưu ý: Chỉ áp dụng cho BANK_TRANSFER/NAPAS_BANK_TRANSFER và khi chưa CAPTURED/CANCELED
   */
  async cancelOrder(orderInvoiceNumber: string): Promise<any> {
    const response = await axios.post(
      `${this.apiBaseUrl}/v1/order/cancel`,
      { order_invoice_number: orderInvoiceNumber },
      {
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  }
}

export const sePayPGService = new SePayPGService();
