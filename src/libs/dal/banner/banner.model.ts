import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { BannerActionType, BannerType, IBanner } from "./banner.interface";

const Schema = mongoose.Schema;
const bannerSchema = new Schema(
  {
    image: { type: String, required: true },
    title: { type: String },
    subtitle: { type: String },
    actionType: { type: String, enum: Object.values(BannerActionType), required: true },
    link: { type: String },
    productId: { type: String },
    voucherId: { type: String },
    isPublic: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },
    memberId: { type: Schema.Types.ObjectId, ref: "Member" },
    position: { type: String },
    type: { type: String, enum: Object.values(BannerType) },
  },
  { timestamps: true }
);

// bannerSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const BannerModel = MainConnection.model<IBanner>("Banner", bannerSchema);

export const BannerLoader = ModelLoader(BannerModel);
