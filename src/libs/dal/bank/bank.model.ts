import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";

import { IBank, PaymentMethodEnum } from "./bank.interface";

const Schema = mongoose.Schema;

const bankSchema = new Schema(
  {
    method: { type: String, enum: Object.values(PaymentMethodEnum), require: true },
    bankImage: { type: String, require: true },
    bankCode: { type: String, require: true },
    bankName: { type: String, require: true },
    accountNumber: { type: String, require: true },
    accountName: { type: String, require: true },
    bin: { type: String, require: true },
    status: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// bankSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const BankModel = MainConnection.model<IBank>("Bank", bankSchema);

export const BankLoader = ModelLoader(BankModel);
