import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import {
  ITrendingPurchaseOrder,
  TrendingPurchaseOrderStatusEnum,
} from "./trending-purchase-order.interface";
import { TrendingTypeEnum } from "../trending/trending.interface";

const Schema = mongoose.Schema;

const trendingPurchaseOrderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    trendingId: { type: Schema.Types.ObjectId, ref: "Trending", required: true, index: true },
    trendingType: { type: String, enum: Object.values(TrendingTypeEnum), required: true },
    price: { type: Number, default: 0 },
    itemName: { type: String, required: true },
    walletTransactionId: { type: Schema.Types.ObjectId, ref: "WalletTransaction" },
    status: {
      type: String,
      enum: Object.values(TrendingPurchaseOrderStatusEnum),
      default: TrendingPurchaseOrderStatusEnum.PAID,
      index: true,
    },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundReason: { type: String },
    refundedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Mỗi customer chỉ có 1 đơn PAID cho 1 trending item (chống double-charge)
trendingPurchaseOrderSchema.index(
  { customerId: 1, trendingId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: TrendingPurchaseOrderStatusEnum.PAID },
  }
);

trendingPurchaseOrderSchema.index({ customerId: 1, status: 1, createdAt: -1 });

export const TrendingPurchaseOrderModel = MainConnection.model<ITrendingPurchaseOrder>(
  "TrendingPurchaseOrder",
  trendingPurchaseOrderSchema
);

export const TrendingPurchaseOrderLoader = ModelLoader(TrendingPurchaseOrderModel);
