import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import { IUser, UserStatus } from "./user.interface";
import { PlaceSchema, UserRoleEnum, UserScopeEnum } from "../../shared";

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    uid: { type: String, required: true },
    email: { type: String },
    name: { type: String },
    role: { type: String, enum: Object.values(UserRoleEnum), require: true },
    phone: { type: String },
    address: { type: String },
    avatar: { type: String },
    place: { type: PlaceSchema },
    scopes: { type: [{ type: String, enum: Object.values(UserScopeEnum) }], default: [] },
    root: { type: Boolean, default: false },
    position: { type: String },
    birthday: { type: Date },
    gender: { type: String },
    authorityIds: [{ type: Schema.Types.ObjectId, ref: "Authority" }],
    authorityId: { type: String },
    code: { type: String },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.INACTIVE },
    partnerConfig: {
      type: {
        maximumOpenOrder: { type: Number, default: 0 },
        minimumWalletBalance: { type: Number, default: 0 },
        maximumOrderValue: { type: Number, default: 0 },
        isWithdrawExchangeFee: { type: Boolean, default: false },
      },
      default: {},
    },
    creditPoint: { type: Number, default: 0 },
    banks: [
      {
        bankAccount: { type: String },
        bankNumber: { type: String },
        bankName: { type: String },
      },
    ],
    logs: [
      {
        createdAt: { type: Date, required: true },
        message: { type: String, required: true },
        meta: { type: Schema.Types.Mixed },
      },
    ],
    partnerGroupId: { type: String },
    isPartnerGroupOwner: { type: Boolean },
    gameIdsPermission: [{ type: Schema.Types.String }],
  },
  { timestamps: true, collation: { locale: "vi" } }
);

userSchema.index({ uid: 1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ name: "text" }, { weights: { name: 10 } } as any);

export const UserModel = MainConnection.model<IUser>("User", userSchema);

export const UserLoader = ModelLoader(UserModel);
