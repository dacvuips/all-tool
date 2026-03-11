import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { CustomerStatusEnum } from "../../../libs/shared/interfaces/customer.interface";
import { ICustomer } from "./customer.interface";

const Schema = mongoose.Schema;

const customerSchema = new Schema(
  {
    code: { type: String, require: true },
    name: { type: String, require: true },
    uid: { type: String, require: true },
    phoneNumber: { type: String, require: true },
    email: { type: String },
    address: { type: String },
    avatarUrl: { type: String },
    status: {
      type: String,
      enum: Object.values(CustomerStatusEnum),
      default: CustomerStatusEnum.ACTIVE,
    },
    passwordHash: { type: String },
    birthday: { type: Date },

    times: {
      type: {
        registedAt: { type: Date },
        lastLoginAt: { type: Date },
        lastOrderAt: { type: Date },
        emailVerifiedAt: { type: Date },
        passwordChangedAt: { type: Date },
      },
    },
    rewardPoint: { type: Number, default: 0 },
    creditBalance: { type: Number, default: 0 },
    bankVerifiedId: { type: String },
    hasReward: { type: Boolean, default: false },
    intro: {
      type: {
        order: Boolean,
        card: Boolean,
      },
    },
    province: { type: String },
    district: { type: String },
    ward: { type: String },
  },
  { timestamps: true }
);

customerSchema.index({ code: 1 }, { unique: true });
customerSchema.index({ uid: 1 }, { unique: true });
customerSchema.index(
  { phoneNumber: 1 },
  { unique: true, partialFilterExpression: { phoneNumber: { $type: "string" } } }
);
customerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);
customerSchema.index({ name: "text", phoneNumber: "text", email: "text", code: "text" }, {
  weights: { name: 2, phoneNumber: 2, email: 2, code: 2 },
} as any);

export const CustomerModel = MainConnection.model<ICustomer>("Customer", customerSchema);

export const CustomerLoader = ModelLoader(CustomerModel);
