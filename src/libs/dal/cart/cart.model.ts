import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ICart } from "./cart.interface";

const Schema = mongoose.Schema;

const cartSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    sessionId: { type: String },

    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    productName: { type: String, required: true },

    thumbnail: { type: String },

    price: { type: Number, required: true },
    originalPrice: { type: Number },
    promotion: {
      promotionType: { type: String },
      discountAmount: { type: Number },
      startTime: { type: Date },
      endTime: { type: Date },
    },

    quantity: { type: Number, required: true, default: 1 },

    isSelected: { type: Boolean, default: true },
    isValid: { type: Boolean, default: true },

    stockCheckedAt: { type: Date },
    priceCheckedAt: { type: Date },
  },
  { timestamps: true }
);

cartSchema.index({ customerId: 1, productId: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ customerId: 1, isSelected: 1 });

export const CartModel = MainConnection.model<ICart>("Cart", cartSchema);

export const CartLoader = ModelLoader(CartModel);
