import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ITrending } from "./trending.interface";

const Schema = mongoose.Schema;
const trendingSchema = new Schema(
  {
    name: { type: String, required: true },
    imageUrls: { type: [String], default: [] },
    prompt: { type: String },
    isActive: { type: Boolean, default: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    count: { type: Number, default: 0 },
    trendingCategoryIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "TrendingCategory" }],
      default: [],
    },
  },
  { timestamps: true }
);

trendingSchema.index({ isActive: 1 });
trendingSchema.index({ customerId: 1 });
trendingSchema.index({ count: -1 });

export const TrendingModel = MainConnection.model<ITrending>("Trending", trendingSchema);

export const TrendingLoader = ModelLoader(TrendingModel);
