import { decryptProviderSecret } from "../../../packages/encryption";
import {
  CreateShippingOrderData,
  CreateShippingOrderResponse,
  ShippingProviderAdapter,
} from "./shipping-provider.adapter";

/**
 * Adapter cho Giao Hàng Nhanh (GHN)
 * Tài liệu API: https://api.ghn.vn/home/docs/detail
 */
export class GHNShippingAdapter extends ShippingProviderAdapter {
  providerCode = "GHN";

  /**
   * Tạo đơn hàng với GHN
   */
  async createShippingOrder(data: CreateShippingOrderData): Promise<CreateShippingOrderResponse> {
    try {
      const endpoint = `/shiip/public-api/v2/shipping-order/create`;

      // Map data sang format của GHN
      const requestBody = {
        payment_type_id: 2, // 1: Người gửi trả, 2: Người nhận trả (COD)
        note: data.note || "",
        required_note: "KHONGCHOXEMHANG", // Yêu cầu không cho xem hàng

        // Thông tin người gửi
        from_name: data.fromName,
        from_phone: data.fromPhone,
        from_address: data.fromAddress,
        from_ward_name: data.fromWard, // GHN cần ward name, không phải ID
        from_district_name: data.fromDistrict, // GHN cần district name
        from_province_name: data.fromProvince, // GHN cần province name

        // Thông tin người nhận
        to_name: data.toName,
        to_phone: data.toPhone,
        to_address: data.toAddress,
        to_ward_name: data.toWard?.toString() || "",
        to_district_name: data.toDistrict || "",
        to_province_name: data.toProvince || "",

        // Thông tin gói hàng
        cod_amount: 0,
        content: data.note || "",
        weight: data.weight,
        length: data.length || 0,
        width: data.width || 0,
        height: data.height || 0, 

        // Dịch vụ (sử dụng serviceTypeId từ data, mặc định là 2 nếu không có)
        service_type_id: data.serviceTypeId || 2,

        // Bảo hiểm
        insurance_value: 0,

        // Items (nếu có)
        items: data.items || [],
      };

      // Gọi API GHN
      const response = await this.callApi(endpoint, "POST", requestBody, {
        Token: decryptProviderSecret(this.apiConfig.token),
        ShopId: this.apiConfig.shopId?.toString() || "",
      });

      // Kiểm tra response
      if (response.code === 200 && response.data) {
        return {
          success: true,
          trackingCode: response.data.order_code,
          orderCode: response.data.order_code,
          message: "Tạo đơn GHN thành công",
          data: response.data,
          standardizedData: this.transformToStandardFormat(response.data),
        };
      } else {
        return {
          success: false,
          message: response.message || "Lỗi khi tạo đơn GHN",
          data: response,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Lỗi kết nối với GHN",
      };
    }
  }

  /**
   * Transform response từ GHN về format chuẩn
   */
  transformToStandardFormat(rawData: any): any {
    return {
      orderCode: rawData.order_code,
      sortCode: rawData.sort_code,
      transType: rawData.trans_type,
      wardEncode: rawData.ward_encode,
      districtEncode: rawData.district_encode,

      feeBreakdown: rawData.fee
        ? {
            mainService: rawData.fee.main_service,
            insurance: rawData.fee.insurance,
            stationDo: rawData.fee.station_do,
            stationPu: rawData.fee.station_pu,
            return: rawData.fee.return,
            r2s: rawData.fee.r2s,
            coupon: rawData.fee.coupon,
            codFailedFee: rawData.fee.cod_failed_fee,
          }
        : undefined,

      totalFee: rawData.total_fee ? parseFloat(rawData.total_fee) : undefined,
      estimatedDeliveryDate: rawData.expected_delivery_time
        ? new Date(rawData.expected_delivery_time)
        : undefined,
    };
  }

  /**
   * Hủy đơn hàng GHN
   */
  async cancelShippingOrder(trackingCode: string): Promise<CreateShippingOrderResponse> {
    try {
      const endpoint = "/shiip/public-api/v2/switch-status/cancel";

      const requestBody = {
        order_codes: [trackingCode],
      };

      const response = await this.callApi(endpoint, "POST", requestBody, {
        Token: decryptProviderSecret(this.apiConfig.token),
      });

      if (response.code === 200) {
        return {
          success: true,
          message: "Hủy đơn GHN thành công",
          data: response.data,
        };
      } else {
        return {
          success: false,
          message: response.message || "Lỗi khi hủy đơn GHN",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Lỗi kết nối với GHN",
      };
    }
  }

  /**
   * Lấy thông tin đơn hàng từ GHN
   */
  async getShippingOrderInfo(trackingCode: string): Promise<any> {
    try {
      const endpoint = "/shiip/public-api/v2/shipping-order/detail";

      const requestBody = {
        order_code: trackingCode,
      };

      const response = await this.callApi(endpoint, "POST", requestBody, {
        Token: decryptProviderSecret(this.apiConfig.token),
      });

      if (response.code === 200) {
        return response.data;
      } else {
        throw new Error(response.message || "Không lấy được thông tin đơn hàng");
      }
    } catch (error: any) {
      throw new Error(error.message || "Lỗi kết nối với GHN");
    }
  }

  /**
   * Tính phí vận chuyển GHN
   */
  async calculateShippingFee(data: Partial<CreateShippingOrderData>): Promise<number> {
    try {
      const endpoint = "/shiip/public-api/v2/shipping-order/fee";

      const requestBody = {
        service_type_id: data.serviceTypeId || 2,
        to_district_id: data.toDistrict,
        to_ward_code: data.toWard?.toString(),
        weight: data.weight || 1000,
        length: data.length || 10,
        width: data.width || 10,
        height: data.height || 10,
        insurance_value: data.insuranceValue || 0,
        cod_failed_amount: 0,
      };

      const response = await this.callApi(endpoint, "POST", requestBody, {
        Token: decryptProviderSecret(this.apiConfig.token),
        ShopId: this.apiConfig.shopId?.toString() || "",
      });

      if (response.code === 200 && response.data) {
        return response.data.total || 0;
      } else {
        throw new Error(response.message || "Không tính được phí vận chuyển");
      }
    } catch (error: any) {
      throw new Error(error.message || "Lỗi kết nối với GHN");
    }
  }

  /**
   * Helper: Map service code sang service_type_id của GHN
   */
  private getServiceTypeId(serviceCode: string): number {
    const serviceMap: Record<string, number> = {
      EXPRESS: 2, // Hỏa tốc
      STANDARD: 1, // Tiêu chuẩn
    };
    return serviceMap[serviceCode] || 2;
  }
}
