import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import {
  IWalletTransaction,
  WalletInfoKeyEnum,
  WalletTransactionSideEnum,
  WalletTransactionTypeEnum,
  WalletTranscationStatusEnum,
} from "./walletTransaction.interface";

const Schema = mongoose.Schema;

const walletTransactionSchema = new Schema(
  {
    code: { type: String, required: true },
    walletId: { type: Schema.Types.ObjectId, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    side: { type: String, enum: Object.values(WalletTransactionSideEnum), required: true },
    type: { type: String, enum: Object.values(WalletTransactionTypeEnum), required: true },
    amount: { type: Number, required: true },
    balance: { type: Number, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(WalletTranscationStatusEnum),
      default: WalletTranscationStatusEnum.PENDING,
    },
    failedReason: { type: String },
    transactionNoun: { type: Number, require: true },
    specificInfo: [
      {
        type: {
          key: { type: String, required: true, enum: Object.values(WalletInfoKeyEnum) },
          value: { type: Schema.Types.Mixed, required: true },
        },
      },
    ],
  },
  { timestamps: true }
);

walletTransactionSchema.index({ code: 1 }, { unique: true });
walletTransactionSchema.index({ walletId: 1 });
walletTransactionSchema.index({ walletId: 1, transactionNoun: 1 }, { unique: true });
walletTransactionSchema.index({ "specificInfo.$**": 1 }, { sparse: true });
walletTransactionSchema.index({ code: "text" }, { weights: { name: 2 } } as any);

export const WalletTransactionModel = MainConnection.model<IWalletTransaction>(
  "WalletTransaction",
  walletTransactionSchema
);

export const WalletTransactionLoader = ModelLoader(WalletTransactionModel);
