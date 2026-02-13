import { Types } from "mongoose";
import { TimestampEntity } from "../../core";
import { IShippingProviderCodeEnum } from "../shippingProvider/shippingProvider.interface";

/**
 * Interface cho bên gửi hàng (shop/kho)
 */
export interface ISender {
  name: string; // Tên người gửi/shop
  phone: string; // Số điện thoại
  address: string; // Địa chỉ chi tiết
  wardId?: number; // Mã phường/xã
  districtId?: number; // Mã quận/huyện
  provinceId?: number; // Mã tỉnh/thành phố
}

/**
 * Interface cho bên nhận hàng (khách)
 */
export interface IReceiver {
  name: string; // Tên người nhận
  phone: string; // Số điện thoại
  address: string; // Địa chỉ chi tiết
  wardId?: number; // Mã phường/xã
  districtId?: number; // Mã quận/huyện
  provinceId?: number; // Mã tỉnh/thành phố
}

/**
 * Interface cho thông tin gói hàng
 */
export interface IPackage {
  weight: number; // Khối lượng (gram)
  length?: number; // Chiều dài (cm)
  width?: number; // Chiều rộng (cm)
  height?: number; // Chiều cao (cm)
  itemsCount?: number; // Số lượng sản phẩm
  description?: string; // Mô tả hàng hóa
}

/**
 * Interface cho chi tiết phí vận chuyển
 */
export interface IFeeBreakdown {
  main_service?: number; // Phí vận chuyển chính
  insurance?: number; // Phí bảo hiểm
  station_do?: number; // Phí gửi hàng tại bưu cục
  station_pu?: number; // Phí lấy hàng tại bưu cục
  return?: number; // Phí hoàn hàng
  r2s?: number; // Phí giao lại hàng
  coupon?: number; // Giá trị khuyến mãi
  cod_failed_fee?: number; // Phí COD thất bại
}

/**
 * Enum cho trạng thái shipment
 */
export enum ShipmentStatusEnum {
  DRAFT = "draft", // Bản nháp, chưa tạo đơn
  CREATED = "created", // Đã tạo đơn thành công
  PICKED = "picked", // Đã lấy hàng
  SHIPPING = "shipping", // Đang vận chuyển
  DELIVERED = "delivered", // Đã giao hàng
  RETURNED = "returned", // Đã hoàn
  CANCELLED = "cancelled", // Đã hủy
  FAILED = "failed", // Tạo đơn thất bại
}

/**
 * Interface cho log lịch sử shipment
 */
export interface IShipmentLog {
  status: ShipmentStatusEnum; // Trạng thái
  description?: string; // Mô tả
  location?: string; // Vị trí (nếu có)
  note?: string; // Ghi chú
  metadata?: any; // Metadata bổ sung
  createdAt: Date; // Thời gian
}

/**
 * Interface chính cho Shipment (đơn vận chuyển)
 */
export type IShipment = TimestampEntity & {
  id: string;

  // Liên kết với order
  orderId: Types.ObjectId; // ID của đơn hàng

  // Nhà cung cấp và dịch vụ
  provider: IShippingProviderCodeEnum; // Mã nhà cung cấp (GHN, GHTK...)
  serviceCode: string; // Mã dịch vụ (EXPRESS, STANDARD...)

  // Mã vận đơn và trạng thái
  trackingCode?: string; // Mã tracking từ nhà vận chuyển (được cập nhật sau khi tạo đơn)
  status: ShipmentStatusEnum; // Trạng thái hiện tại

  // Phí vận chuyển
  codAmount: number; // Số tiền thu hộ COD
  shippingFee: number; // Phí vận chuyển
  insuranceValue?: number; // Giá trị bảo hiểm
  totalFee?: number; // Tổng phí dịch vụ
  feeBreakdown?: IFeeBreakdown; // Chi tiết các khoản phí

  // Thông tin từ nhà cung cấp
  orderCode?: string; // Mã đơn hàng từ provider (có thể khác trackingCode)
  sortCode?: string; // Mã phân loại
  transType?: string; // Loại vận chuyển (truck, bike, etc.)
  wardEncode?: string; // Mã encode phường/xã
  districtEncode?: string; // Mã encode quận/huyện

  // Thông tin gửi/nhận
  sender: ISender; // Thông tin bên gửi
  receiver: IReceiver; // Thông tin bên nhận

  // Thông tin gói hàng
  package: IPackage; // Thông tin gói hàng

  // Metadata và logs
  providerResponse?: any; // Response từ API nhà cung cấp (order_code, v.v.)
  logs?: IShipmentLog[]; // Lịch sử cập nhật trạng thái
  note?: string; // Ghi chú

  // Thời gian dự kiến và thực tế
  estimatedDeliveryDate?: Date; // Ngày giao hàng dự kiến
  actualDeliveryDate?: Date; // Ngày giao hàng thực tế
};
