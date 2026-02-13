import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IShippingProviderCodeEnum } from "../shippingProvider/shippingProvider.interface";
import { IShipment, ShipmentStatusEnum } from "./shipment.interface";

const Schema = mongoose.Schema;

/**
 * Schema cho thông tin người gửi
 */
const senderSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  wardId: { type: Number },
  districtId: { type: Number },
  provinceId: { type: Number },
});

/**
 * Schema cho thông tin người nhận
 */
const receiverSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  wardId: { type: Number },
  districtId: { type: Number },
  provinceId: { type: Number },
});

/**
 * Schema cho thông tin gói hàng
 */
const packageSchema = new Schema({
  weight: { type: Number, required: true }, // Khối lượng (gram)
  length: { type: Number }, // Chiều dài (cm)
  width: { type: Number }, // Chiều rộng (cm)
  height: { type: Number }, // Chiều cao (cm)
  itemsCount: { type: Number }, // Số lượng sản phẩm
  description: { type: String }, // Mô tả hàng hóa
});

/**
 * Schema cho chi tiết phí
 */
const feeBreakdownSchema = new Schema({
  main_service: { type: Number }, // Phí vận chuyển chính
  insurance: { type: Number }, // Phí bảo hiểm
  station_do: { type: Number }, // Phí gửi hàng tại bưu cục
  station_pu: { type: Number }, // Phí lấy hàng tại bưu cục
  return: { type: Number }, // Phí hoàn hàng
  r2s: { type: Number }, // Phí giao lại hàng
  coupon: { type: Number }, // Giá trị khuyến mãi
  cod_failed_fee: { type: Number }, // Phí COD thất bại
});

/**
 * Schema cho log lịch sử shipment
 */
const shipmentLogSchema = new Schema({
  status: {
    type: String,
    enum: Object.values(ShipmentStatusEnum),
    required: true,
  },
  description: { type: String },
  location: { type: String },
  note: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

/**
 * Schema chính cho Shipment
 */
const shipmentSchema = new Schema(
  {
    // Liên kết với order
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    // Nhà cung cấp và dịch vụ
    provider: {
      type: String,
      enum: Object.values(IShippingProviderCodeEnum),
      required: true,
    },
    serviceCode: {
      type: String,
    },

    // Mã vận đơn và trạng thái
    trackingCode: { type: String }, // Được cập nhật sau khi tạo đơn thành công
    status: {
      type: String,
      enum: Object.values(ShipmentStatusEnum),
      default: ShipmentStatusEnum.DRAFT,
      required: true,
    },

    // Phí vận chuyển
    codAmount: { type: Number, required: true }, // Số tiền thu hộ COD
    shippingFee: { type: Number, required: true }, // Phí vận chuyển
    insuranceValue: { type: Number }, // Giá trị bảo hiểm
    totalFee: { type: Number }, // Tổng phí dịch vụ
    feeBreakdown: { type: feeBreakdownSchema }, // Chi tiết các khoản phí

    // Thông tin từ nhà cung cấp
    orderCode: { type: String }, // Mã đơn hàng từ provider
    sortCode: { type: String }, // Mã phân loại
    transType: { type: String }, // Loại vận chuyển
    wardEncode: { type: String }, // Mã encode phường/xã
    districtEncode: { type: String }, // Mã encode quận/huyện

    // Thông tin gửi/nhận
    sender: { type: senderSchema, required: true },
    receiver: { type: receiverSchema, required: true },

    // Thông tin gói hàng
    package: { type: packageSchema, required: true },

    // Metadata và logs
    providerResponse: { type: Schema.Types.Mixed }, // Response từ API nhà cung cấp
    logs: [shipmentLogSchema], // Lịch sử cập nhật trạng thái
    note: { type: String },

    // Thời gian
    estimatedDeliveryDate: { type: Date }, // Ngày giao dự kiến
    actualDeliveryDate: { type: Date }, // Ngày giao thực tế
  },
  { timestamps: true }
);

// Indexes để tối ưu hóa query
shipmentSchema.index({ orderId: 1 }); // Tìm shipments theo orderId
shipmentSchema.index({ trackingCode: 1 }); // Tìm shipment theo mã vận đơn
shipmentSchema.index({ status: 1 }); // Lọc theo trạng thái
shipmentSchema.index({ provider: 1 }); // Lọc theo nhà cung cấp
shipmentSchema.index({ createdAt: -1 }); // Sắp xếp theo thời gian

// Thêm log khi thay đổi trạng thái
shipmentSchema.pre("save", function (next) {
  // Nếu trạng thái thay đổi, tự động thêm log
  if (this.isModified("status")) {
    const log = {
      status: this.status,
      description: `Trạng thái chuyển sang ${this.status}`,
      createdAt: new Date(),
    };
    if (!this.logs || this.logs.length === 0) {
      this.logs = [log] as any;
    } else {
      this.logs.push(log);
    }
  }
  next();
});

export const ShipmentModel = MainConnection.model<IShipment>("Shipment", shipmentSchema);

export const ShipmentLoader = ModelLoader(ShipmentModel);
