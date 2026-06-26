import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ApiMediaSubscriptionPlanEnum, IApiMediaToken } from "./apiMediaToken.interface";

const Schema = mongoose.Schema;

const apiMediaTokenSchema = new Schema(
  {
    key: { type: String, required: true },
    requestQuantity: { type: Number, default: 0 },
    expiredDate: { type: Date },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    active: { type: Boolean, default: true },
    usedQuantity: { type: Number, default: 0 },
    subscriptionPlan: { type: String, enum: Object.values(ApiMediaSubscriptionPlanEnum) },
    streamCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

apiMediaTokenSchema.index({ key: 1 }, { unique: true });
apiMediaTokenSchema.index({ customerId: 1 });

export const ApiMediaTokenModel = MainConnection.model<IApiMediaToken>(
  "ApiMediaToken",
  apiMediaTokenSchema
);

export const ApiMediaTokenLoader = ModelLoader(ApiMediaTokenModel);
