import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import {
  IPackageTransaction,
  PackageTransactionTypeEnum,
} from "./package-transaction.interface";

const Schema = mongoose.Schema;

const snapshotSchema = {
  subscription: { type: String },
  videoCount: { type: Number },
  videoLimit: { type: Number },
  imageCount: { type: Number },
  imageLimit: { type: Number },
  imageStreamCount: { type: Number },
  videoStreamCount: { type: Number },
  expiryPackageDate: { type: Date },
};

const packageTransactionSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    customerCode: { type: String },
    type: {
      type: String,
      required: true,
      enum: Object.values(PackageTransactionTypeEnum),
    },
    before: { type: snapshotSchema, required: true },
    after: { type: snapshotSchema, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

packageTransactionSchema.index({ customerId: 1, createdAt: -1 });

export const PackageTransactionModel = MainConnection.model<IPackageTransaction>(
  "PackageTransaction",
  packageTransactionSchema
);

export const PackageTransactionLoader = ModelLoader(PackageTransactionModel);
