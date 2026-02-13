import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IShippingProvider, IShippingProviderCodeEnum } from "./shippingProvider.interface";

const Schema = mongoose.Schema;

/**
 * Schema cho cấu hình API của nhà cung cấp vận chuyển
 */
const apiConfigSchema = new Schema({
  baseUrl: { type: String, required: true }, // URL API
  token: { type: String, required: true }, // Token xác thực (được mã hóa)
  shopId: { type: String }, // ID shop trên hệ thống nhà cung cấp
  apiKey: { type: String }, // API key bổ sung
  metadata: { type: Schema.Types.Mixed }, // Metadata linh hoạt
});

/**
 * Schema cho từng dịch vụ vận chuyển
 */
const shippingServiceSchema = new Schema({
  serviceCode: { type: String, required: true }, // Mã dịch vụ
  serviceName: { type: String, required: true }, // Tên dịch vụ
  isActive: { type: Boolean, default: true }, // Trạng thái hoạt động
  estimatedTime: { type: String }, // Thời gian ước tính
  description: { type: String }, // Mô tả dịch vụ
  metadata: { type: Schema.Types.Mixed }, // Metadata bổ sung
});

/**
 * Schema chính cho nhà cung cấp vận chuyển
 */
const shippingProviderSchema = new Schema(
  {
    // Thông tin cơ bản
    code: {
      type: String,
      enum: Object.values(IShippingProviderCodeEnum),
      required: true,
      unique: true, // Mã phải là duy nhất
      uppercase: true, // Tự động chuyển thành chữ hoa
    },
    name: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Cấu hình API
    apiConfig: {
      type: apiConfigSchema,
      required: true,
    },

    // Danh sách dịch vụ
    services: {
      type: [shippingServiceSchema],
      default: [],
    },

    // Thông tin bổ sung
    description: {
      type: String,
    },
    logo: {
      type: String,
    },
    priority: {
      type: Number,
      default: 0, // Mặc định ưu tiên thấp
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// Tạo index cho các trường thường xuyên tìm kiếm
shippingProviderSchema.index({ code: 1 });
shippingProviderSchema.index({ isActive: 1 });
shippingProviderSchema.index({ priority: -1 });

// Tạo và export model
export const ShippingProviderModel = MainConnection.model<IShippingProvider>(
  "ShippingProvider",
  shippingProviderSchema
);

// Đăng ký model với ModelLoader
export const ShippingProviderLoader = ModelLoader(ShippingProviderModel);
