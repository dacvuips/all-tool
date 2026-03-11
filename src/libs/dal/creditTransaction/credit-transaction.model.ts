import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import {
  CreditTransactionTypeEnum,
  ICreditTransaction,
} from "./credit-transaction.interface";

const Schema = mongoose.Schema;

const creditTransactionSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(CreditTransactionTypeEnum),
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    runId: { type: String, required: true, index: true },
    productId: { type: String, required: true },
    nodeId: { type: String, required: true },
    description: { type: String, required: true },
    refTransactionId: { type: String },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ customerId: 1, createdAt: -1 });
creditTransactionSchema.index({ runId: 1 });

export const CreditTransactionModel = MainConnection.model<ICreditTransaction>(
  "CreditTransaction",
  creditTransactionSchema
);

export const CreditTransactionLoader = ModelLoader(CreditTransactionModel);
