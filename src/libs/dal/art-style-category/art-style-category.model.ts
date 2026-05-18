import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IArtStyleCategory } from "./art-style-category.interface";

const Schema = mongoose.Schema;
const artStyleCategorySchema = new Schema(
  {
    name: { type: String, required: true },
    isHot: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    artStyleIds: { type: [{ type: Schema.Types.ObjectId, ref: "ArtStyle" }], default: [] },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

artStyleCategorySchema.index({ isActive: 1 });
artStyleCategorySchema.index({ isHot: 1 });
artStyleCategorySchema.index({ priority: -1 });

export const ArtStyleCategoryModel = MainConnection.model<IArtStyleCategory>(
  "ArtStyleCategory",
  artStyleCategorySchema
);

export const ArtStyleCategoryLoader = ModelLoader(ArtStyleCategoryModel);
