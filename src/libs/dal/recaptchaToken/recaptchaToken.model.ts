import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IRecaptchaToken, RecaptchaSubscriptionPlanEnum } from "./recaptchaToken.interface";

const Schema = mongoose.Schema;

const recaptchaTokenSchema = new Schema(
  {
    key: { type: String, required: true },
    requestQuantity: { type: Number, default: 0 },
    expiredDate: { type: Date },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    active: { type: Boolean, default: true },
    usedQuantity: { type: Number, default: 0 },
    subscriptionPlan: { type: String, enum: Object.values(RecaptchaSubscriptionPlanEnum) },
  },
  { timestamps: true }
);

recaptchaTokenSchema.index({ key: 1 }, { unique: true });
recaptchaTokenSchema.index({ customerId: 1 });

export const RecaptchaTokenModel = MainConnection.model<IRecaptchaToken>(
  "RecaptchaToken",
  recaptchaTokenSchema
);

export const RecaptchaTokenLoader = ModelLoader(RecaptchaTokenModel);
