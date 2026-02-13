import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IWallet } from "./wallet.interface";

const Schema = mongoose.Schema;

const walletSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    balance: { type: Number, default: 0 },
    totalIn: { type: Number, default: 0 },
    totalOut: { type: Number, default: 0 },
    times: {
      type: {
        lastIn: { type: Date },
        lastOut: { type: Date },
        lastLocked: { type: Date },
      },
    },
    isLocked: { type: Boolean, default: false },
    transactionNoun: { type: Number, default: 0 },
  },
  { timestamps: true }
);

walletSchema.index({ ownerId: 1 }, { unique: true });
// walletSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const WalletModel = MainConnection.model<IWallet>("Wallet", walletSchema);

export const WalletLoader = ModelLoader(WalletModel);
