import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import type { ITextCreditUsage } from "./text-credit-usage.interface";

const Schema = mongoose.Schema;

const textCreditUsageSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    customerCode: { type: String },
    jobId: { type: String, required: true },
    tool: { type: String, required: true },
    amount: { type: Number, required: true, default: 1 },
    microxAmount: { type: Number },
    textCreditCountAfter: { type: Number },
    textCreditLimit: { type: Number },
    description: { type: String },
  },
  { timestamps: true }
);

textCreditUsageSchema.index({ jobId: 1 }, { unique: true });
textCreditUsageSchema.index({ customerId: 1, createdAt: -1 });

export const TextCreditUsageModel = MainConnection.model<ITextCreditUsage>(
  "TextCreditUsage",
  textCreditUsageSchema
);
export const TextCreditUsageLoader = ModelLoader(TextCreditUsageModel);
