import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ICounter } from "./counter.interface";

const Schema = mongoose.Schema;

const counterSchema = new Schema(
  {
    name: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.index({ name: 1 }, { unique: true });
counterSchema.index({ name: "text" }, { weights: { name: 2 } });

export const CounterModel = MainConnection.model<ICounter>("Counter", counterSchema);

export const CounterLoader = ModelLoader(CounterModel);
