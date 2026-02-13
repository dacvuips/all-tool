import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IProduct, OtherInfoStatus, PreOrder } from "./product.interface";

const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    name: { type: String, require: true },
    des: { type: String },
    video: { type: String },
    coverImg: { type: String, require: true },
    imgs: [{ type: String }],
    categoryId: { type: String, ref: "Category", require: true },
    categoryProperties: {
      type: Schema.Types.Mixed,
    },
    slug: { type: String, require: true },
    active: { type: Boolean, default: false },
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    delivery: {
      type: {
        weight: { type: Number, require: true },
        width: { type: Number },
        length: { type: Number },
        height: { type: Number },
        price: { type: Number },
      },
    },
    otherInfo: {
      type: {
        preOrder: { type: String, enum: Object.values(PreOrder), default: PreOrder.NO },
        preOrderDay: { type: Number },
        status: { type: String, enum: Object.values(OtherInfoStatus), required: true },
        sku: { type: String },
      },
    },
    classification: {
      type: {
        originalPrice: { type: Number, default: 0 },
        totalStock: { type: Number, default: 0 },

        tiers: [
          {
            code: { type: String },
            name: { type: String },
            options: [
              {
                code: { type: String },
                name: { type: String },
                imageUrl: { type: String },
              },
            ],
          },
        ],
        variants: [
          {
            code: { type: String },
            sku: { type: String },
            price: { type: Number, default: 0, require: true },
            stock: { type: Number, default: 0 },
            optionCodes: [{ type: String }],
          },
        ],
      },
    },
  },
  { timestamps: true }
);

productSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const ProductModel = MainConnection.model<IProduct>("Product", productSchema);

export const ProductLoader = ModelLoader(ProductModel);
