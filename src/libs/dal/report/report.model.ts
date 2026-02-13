import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IReport, ReportStatusEnum, ReportTypeEnum } from "./report.interface";

const Schema = mongoose.Schema;

const reportSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "ShopProduct",
    },
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "Thread",
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "AffiliateOrder",
    },
    type: {
      type: String,
      required: true,
      enum: ReportTypeEnum,
    },
    content: {
      type: {
        title: { type: String, required: true },
        description: { type: String, required: true },
        imageUrls: { type: [String] },
      },
    },
    status: {
      type: String,
      default: ReportStatusEnum.PENDING,
      enum: ReportStatusEnum,
    },
    times: {
      type: {
        processingAt: { type: Date },
        doneAt: { type: Date },
      },
    },
    note: {
      type: String,
    },
  },
  { timestamps: true }
);

// reportSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const ReportModel = MainConnection.model<IReport>("Report", reportSchema);

export const ReportLoader = ModelLoader(ReportModel);
