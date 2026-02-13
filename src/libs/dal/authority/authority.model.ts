import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { AuthorityStatus, IAuthority } from "./authority.interface";

const Schema = mongoose.Schema;
const authoritySchema = new Schema(
  {
    name: { type: String, required: true },
    scopes: { type: [String], required: true },
    root: { type: Boolean, default: false },
    parentIds: { type: [{ type: Schema.Types.ObjectId, ref: "Authority" }] },
    creatorId: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      default: AuthorityStatus.INACTIVE,
      enum: Object.values(AuthorityStatus),
    },
    code: { type: String },
  },
  { timestamps: true }
);

authoritySchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const AuthorityModel = MainConnection.model<IAuthority>("Authority", authoritySchema);

export const AuthorityLoader = ModelLoader(AuthorityModel);
