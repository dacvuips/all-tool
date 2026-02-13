import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IPaypalTransactions, PaypalTransactionsStatusEnum } from "./paypalTransactions.interface";

const Schema = mongoose.Schema;

const paypalTransactionsSchema = new Schema(
  {
    orderId: { type: String },
    customerId: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PaypalTransactionsStatusEnum),
      default: PaypalTransactionsStatusEnum.PENDING,
    },
    code: { type: String, required: true },
    amount: { type: Number },
    paypalFee: { type: Number },
    paypalPercentFee: { type: Number },
    paymentId: { type: String },
    logs: [
      {
        status: { type: String, required: true },
        eventType: { type: String, required: true },
        createdAt: { type: Date, required: true },
        message: { type: String, required: true },
        meta: { type: Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true }
);

paypalTransactionsSchema.index({ code: "text" }, { weights: { code: 2 } });
paypalTransactionsSchema.index({ code: 1 }, { unique: true });

export const PaypalTransactionsModel = MainConnection.model<IPaypalTransactions>(
  "PaypalTransactions",
  paypalTransactionsSchema
);

export const PaypalTransactionsLoader = ModelLoader(PaypalTransactionsModel);
