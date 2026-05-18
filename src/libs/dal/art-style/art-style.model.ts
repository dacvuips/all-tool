import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IArtStyle } from "./art-style.interface";

const Schema = mongoose.Schema;
const artStyleSchema = new Schema(
  {
    name: { type: String, required: true },
    imageUrls: { type: [String], default: [] },
    prompt: { type: String },
    isActive: { type: Boolean, default: false },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    count: { type: Number, default: 0 },
    artStyleCategoryIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "ArtStyleCategory" }],
      default: [],
    },
    price: { type: Number, default: 0 },
    isPublish: { type: Boolean, default: false },
    monthlyCount: { type: Number, default: 0 },
    des: { type: String },
    promptShort: { type: String },
  },
  { timestamps: true }
);

artStyleSchema.index({ isActive: 1 });
artStyleSchema.index({ customerId: 1 });
artStyleSchema.index({ count: -1 });
artStyleSchema.index({ name: "text" });

export const ArtStyleModel = MainConnection.model<IArtStyle>("ArtStyle", artStyleSchema);

export const ArtStyleLoader = ModelLoader(ArtStyleModel);
