/**
 * Interface cho dữ liệu shipment đã được chuẩn hóa
 * Các provider sẽ transform response của họ về format này
 */
export interface StandardizedShipmentData {
  orderCode?: string; // Mã đơn hàng từ provider
  sortCode?: string; // Mã phân loại
  transType?: string; // Loại vận chuyển
  wardEncode?: string; // Mã phường/xã
  districtEncode?: string; // Mã quận/huyện

  // Chi tiết phí
  feeBreakdown?: {
    mainService?: number; // Phí dịch vụ chính
    insurance?: number; // Phí bảo hiểm
    stationDo?: number; // Phí giao hàng
    stationPu?: number; // Phí lấy hàng
    return?: number; // Phí hoàn hàng
    r2s?: number; // Phí gửi lại
    coupon?: number; // Giảm giá
    codFailedFee?: number; // Phí thu hộ thất bại
    [key: string]: number | undefined; // Cho phép thêm các phí khác
  };

  totalFee?: number; // Tổng phí
  estimatedDeliveryDate?: Date; // Ngày giao hàng dự kiến

  // Thêm các trường chung khác nếu cần
  [key: string]: any; // Flexible cho các trường đặc thù của provider
}

/**
 * Interface cho response khi tạo đơn hàng vận chuyển
 */
export interface CreateShippingOrderResponse {
  success: boolean; // Trạng thái thành công hay thất bại
  trackingCode?: string; // Mã vận đơn từ nhà cung cấp
  orderCode?: string; // Order code từ nhà cung cấp (nếu khác tracking code)
  message?: string; // Thông báo lỗi hoặc thông tin
  data?: any; // Dữ liệu raw từ nhà cung cấp
  standardizedData?: StandardizedShipmentData; // Dữ liệu đã chuẩn hóa
}

/**
 * Interface cho thông tin tạo đơn hàng
 */
export interface CreateShippingOrderData {
  // Thông tin người gửi
  fromName: string;
  fromPhone: string;
  fromAddress: string;
  fromWard?: string;
  fromDistrict?: string;
  fromProvince?: string;

  // Thông tin người nhận
  toName: string;
  toPhone: string;
  toAddress: string;
  toWard?: string;
  toDistrict?: string;
  toProvince?: string;

  // Thông tin gói hàng
  weight: number; // gram
  length?: number; // cm
  width?: number; // cm
  height?: number; // cm
  codAmount: number; // Số tiền thu hộ
  insuranceValue?: number; // Giá trị bảo hiểm

  // Dịch vụ
  serviceCode: string; // Mã dịch vụ (EXPRESS, STANDARD, etc.)
  serviceTypeId?: number; // 2: Hàng nhẹ, 5: Hàng nặng (GHN)
  packageWeight?: number; // Khối lượng thùng đóng gói (gram)
  // Thông tin bổ sung
  note?: string;
  items?: any[]; // Danh sách sản phẩm (format khác nhau cho từng provider)
}

/**
 * Abstract class định nghĩa pattern cho các nhà cung cấp vận chuyển
 * Tất cả nhà cung cấp phải implement class này
 */
export abstract class ShippingProviderAdapter {
  /**
   * Tên nhà cung cấp (GHN, GHTK, etc.)
   */
  abstract providerCode: string;

  /**
   * Cấu hình API của nhà cung cấp
   */
  protected apiConfig: {
    baseUrl: string;
    token: string;
    shopId?: number;
    apiKey?: string;
    metadata?: any;
  };

  constructor(apiConfig: any) {
    this.apiConfig = apiConfig;
  }

  /**
   * Tạo đơn hàng vận chuyển với nhà cung cấp
   * @param data - Thông tin tạo đơn hàng
   * @returns Response với tracking code và thông tin đơn hàng
   */
  abstract createShippingOrder(data: CreateShippingOrderData): Promise<CreateShippingOrderResponse>;

  /**
   * Hủy đơn hàng vận chuyển
   * @param trackingCode - Mã vận đơn cần hủy
   * @returns Response xác nhận hủy
   */
  abstract cancelShippingOrder(trackingCode: string): Promise<CreateShippingOrderResponse>;

  /**
   * Lấy thông tin đơn hàng từ tracking code
   * @param trackingCode - Mã vận đơn
   * @returns Thông tin chi tiết đơn hàng
   */
  abstract getShippingOrderInfo(trackingCode: string): Promise<any>;

  /**
   * Tính phí vận chuyển
   * @param data - Thông tin cơ bản để tính phí
   * @returns Phí vận chuyển
   */
  abstract calculateShippingFee(data: Partial<CreateShippingOrderData>): Promise<number>;

  /**
   * Transform response từ provider về format chuẩn
   * Mỗi provider sẽ implement cách transform riêng
   * @param rawData - Dữ liệu raw từ provider
   * @returns Dữ liệu đã chuẩn hóa
   */
  abstract transformToStandardFormat(rawData: any): StandardizedShipmentData;

  /**
   * Helper method: gọi API với fetch
   */
  protected async callApi(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
    body?: any,
    additionalHeaders?: Record<string, string>
  ): Promise<any> { 
    const url = `${this.apiConfig.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    return data;
  }
}
