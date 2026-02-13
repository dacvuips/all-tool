import {
  CreateShippingOrderData,
  CreateShippingOrderResponse,
  ShippingProviderAdapter,
} from "./shipping-provider.adapter";

/**
 * Adapter cho Giao Hàng Tiết Kiệm (GHTK)
 * Tài liệu API: https://docs.giaohangtietkiem.vn/
 */
export class GHTKShippingAdapter extends ShippingProviderAdapter {
  providerCode = "GHTK";

  /**
   * Tạo đơn hàng với GHTK
   */
  async createShippingOrder(data: CreateShippingOrderData): Promise<CreateShippingOrderResponse> {
    try {
      const endpoint = "/services/shipment/order";

      // Map data sang format của GHTK
      const requestBody = {
        products: data.items || [
          {
            name: "Sản phẩm",
            weight: (data.weight / 1000).toFixed(2), // GHTK dùng kg
            quantity: 1,
          },
        ],
        order: {
          id: "", // Order ID từ hệ thống (optional)
          pick_name: data.fromName,
          pick_address: data.fromAddress,
          pick_province: "", // Tên tỉnh/thành
          pick_district: "", // Tên quận/huyện
          pick_tel: data.fromPhone,

          tel: data.toPhone,
          name: data.toName,
          address: data.toAddress,
          province: "", // Tên tỉnh/thành người nhận
          district: "", // Tên quận/huyện người nhận
          ward: "", // Tên phường/xã người nhận

          hamlet: "Khác", // Ấp/thôn (mặc định "Khác")
          is_freeship: "0", // 1: freeship, 0: người nhận trả

          pick_date: new Date().toISOString().split("T")[0], // Ngày lấy hàng
          pick_money: data.codAmount, // Số tiền thu hộ
          note: data.note || "",
          value: data.insuranceValue || data.codAmount, // Giá trị đơn hàng (để khai báo bảo hiểm)

          transport: this.getTransportType(data.serviceCode), // Loại vận chuyển
        },
      };

      // Gọi API GHTK
      const response = await this.callApi(endpoint, "POST", requestBody, {
        Token: this.apiConfig.token,
      });

      // Kiểm tra response
      if (response.success && response.order) {
        return {
          success: true,
          trackingCode: response.order.tracking_id,
          orderCode: response.order.label,
          message: "Tạo đơn GHTK thành công",
          data: response.order,
          standardizedData: this.transformToStandardFormat(response.order),
        };
      } else {
        return {
          success: false,
          message: response.message || "Lỗi khi tạo đơn GHTK",
          data: response,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Lỗi kết nối với GHTK",
      };
    }
  }

  /**
   * Transform response từ GHTK về format chuẩn
   */
  transformToStandardFormat(rawData: any): any {
    return {
      orderCode: rawData.label || rawData.partner_id,

      feeBreakdown: rawData.fee
        ? {
            mainService: rawData.fee.ship_fee_only,
            insurance: rawData.fee.insurance_fee,
            codFailedFee: rawData.fee.pick_fee,
          }
        : undefined,

      totalFee: rawData.fee ? parseFloat(rawData.fee.total || rawData.fee.fee) : undefined,
      estimatedDeliveryDate: rawData.estimated_deliver_time
        ? new Date(rawData.estimated_deliver_time)
        : undefined,
    };
  }

  /**
   * Hủy đơn hàng GHTK
   */
  async cancelShippingOrder(trackingCode: string): Promise<CreateShippingOrderResponse> {
    try {
      const endpoint = `/services/shipment/cancel/${trackingCode}`;

      const response = await this.callApi(
        endpoint,
        "POST",
        {},
        {
          Token: this.apiConfig.token,
        }
      );

      if (response.success) {
        return {
          success: true,
          message: "Hủy đơn GHTK thành công",
          data: response,
        };
      } else {
        return {
          success: false,
          message: response.message || "Lỗi khi hủy đơn GHTK",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Lỗi kết nối với GHTK",
      };
    }
  }

  /**
   * Lấy thông tin đơn hàng từ GHTK
   */
  async getShippingOrderInfo(trackingCode: string): Promise<any> {
    try {
      const endpoint = `/services/shipment/v2/${trackingCode}`;

      const response = await this.callApi(endpoint, "GET", undefined, {
        Token: this.apiConfig.token,
      });

      if (response.success) {
        return response.order;
      } else {
        throw new Error(response.message || "Không lấy được thông tin đơn hàng");
      }
    } catch (error: any) {
      throw new Error(error.message || "Lỗi kết nối với GHTK");
    }
  }

  /**
   * Tính phí vận chuyển GHTK
   */
  async calculateShippingFee(data: Partial<CreateShippingOrderData>): Promise<number> {
    try {
      const endpoint = "/services/shipment/fee";

      const params = new URLSearchParams({
        pick_province: "", // Tên tỉnh/thành lấy hàng
        pick_district: "", // Tên quận/huyện lấy hàng
        province: "", // Tên tỉnh/thành giao hàng
        district: "", // Tên quận/huyện giao hàng
        address: data.toAddress || "",
        weight: ((data.weight || 1000) / 1000).toString(), // kg
        value: (data.insuranceValue || 0).toString(),
        transport: this.getTransportType(data.serviceCode || "STANDARD"),
      });

      const url = `${this.apiConfig.baseUrl}${endpoint}?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Token: this.apiConfig.token,
        },
      });

      const result = await response.json();

      if (result.success && result.fee) {
        return result.fee.fee || 0;
      } else {
        throw new Error(result.message || "Không tính được phí vận chuyển");
      }
    } catch (error: any) {
      throw new Error(error.message || "Lỗi kết nối với GHTK");
    }
  }

  /**
   * Helper: Map service code sang transport type của GHTK
   */
  private getTransportType(serviceCode: string): string {
    const transportMap: Record<string, string> = {
      EXPRESS: "fly", // Hàng bay
      STANDARD: "road", // Đường bộ
    };
    return transportMap[serviceCode] || "road";
  }
}
