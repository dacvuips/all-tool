import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ITrendingCategory } from "./trending-category.interface";

const Schema = mongoose.Schema;
const trendingCategorySchema = new Schema(
  {
    name: { type: String, required: true },
    isHot: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    trendingIds: { type: [{ type: Schema.Types.ObjectId, ref: "Trending" }], default: [] },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

trendingCategorySchema.index({ isActive: 1 });
trendingCategorySchema.index({ isHot: 1 });
trendingCategorySchema.index({ priority: -1 });

export const TrendingCategoryModel = MainConnection.model<ITrendingCategory>(
  "TrendingCategory",
  trendingCategorySchema
);

export const TrendingCategoryLoader = ModelLoader(TrendingCategoryModel);
