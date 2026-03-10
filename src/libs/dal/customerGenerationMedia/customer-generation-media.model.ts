import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import type { ICustomerGenerationMedia } from "./customer-generation-media.interface";

const Schema = mongoose.Schema;

const customerGenerationMediaSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    nodeId: { type: String, required: true, index: true },
    runId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ["image", "video", "file", "audio"] },
    attachmentId: { type: String },
    url: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    order: { type: Number },
  },
  { timestamps: true }
);

customerGenerationMediaSchema.index({ customerId: 1, createdAt: -1 });
customerGenerationMediaSchema.index({ customerId: 1, productId: 1, createdAt: -1 });

export const CustomerGenerationMediaModel = MainConnection.model<ICustomerGenerationMedia>(
  "CustomerGenerationMedia",
  customerGenerationMediaSchema
);
export const CustomerGenerationMediaLoader = ModelLoader(CustomerGenerationMediaModel);
