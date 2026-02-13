import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { GameCardStatusEnum, IGameCard } from "./gameCard.interface";

const Schema = mongoose.Schema;

const gameCardSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    code: { type: String, required: true },
    serial: { type: String, required: true },
    codeId: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(GameCardStatusEnum),
      default: GameCardStatusEnum.ACTIVE,
    },
    activeDate: { type: String },
    inactiveAt: { type: Date },
    usedAt: { type: Date },
    orderId: { type: Schema.Types.ObjectId },
    importerId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

gameCardSchema.index({ codeId: 1 }, { unique: true });
gameCardSchema.index({ codeId: "text" }, { weights: { codeId: 2 } } as any);

export const GameCardModel = MainConnection.model<IGameCard>("GameCard", gameCardSchema);

export const GameCardLoader = ModelLoader(GameCardModel);
