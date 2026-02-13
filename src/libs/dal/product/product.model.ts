import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IProduct, PropertyTypeEnum } from "./product.interface";

const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    name: { type: String, require: true },
    des: { type: String },
    video: { type: String },
    coverImg: { type: String, require: true },
    categoryId: { type: String, ref: "Category", require: true },
    slug: { type: String, require: true },
    active: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    priority: { type: Number },
    properties: [
      {
        type: { type: String, enum: Object.values(PropertyTypeEnum) },
        key: { type: String },
        label: { type: String },
        placeholder: { type: String },
        tooltip: { type: String },
        required: { type: Boolean },
        clearable: { type: Boolean },
        options: [
          {
            key: { type: String },
            label: { type: String },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

productSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const ProductModel = MainConnection.model<IProduct>("Product", productSchema);

export const ProductLoader = ModelLoader(ProductModel);
