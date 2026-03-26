import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IProductApp } from "./productApp.interface";

const Schema = mongoose.Schema;

const productAppSchema = new Schema(
  {
    name: { type: String, require: true },
    des: { type: String },
    coverImg: { type: String, require: true },
    categoryIds: { type: [String], default: [] },
    slug: { type: String, require: true },
    active: { type: Boolean, default: false },
    priority: { type: Number },
    creditCost: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productAppSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const ProductAppModel = MainConnection.model<IProductApp>("ProductApp", productAppSchema);

export const ProductAppLoader = ModelLoader(ProductAppModel);
