import { Schema } from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import { IShopAddress } from "./shopAddress.interface";

/**
 * Schema cho địa chỉ cửa hàng
 */
const shopAddressSchema = new Schema<IShopAddress>(
  {
    // Thông tin người liên hệ/gửi hàng
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // Thông tin địa chỉ
    address: {
      type: String,
      required: true,
      trim: true,
    },
    ward: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    province: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: "Vietnam",
    },
    postalCode: {
      type: String,
      trim: true,
    },

    // Ghi chú và trạng thái
    note: {
      type: String,
      trim: true,
    },
    default: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Index để tìm kiếm nhanh
 */
shopAddressSchema.index({ default: 1, isActive: 1 });
shopAddressSchema.index({ province: 1, district: 1 });

export const ShopAddressModel = MainConnection.model<IShopAddress>(
  "ShopAddress",
  shopAddressSchema
);

export const ShopAddressLoader = ModelLoader(ShopAddressModel);
