import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IObjectToPersonify } from "./objectToPersonify.interface";

const Schema = mongoose.Schema;
const objectToPersonifySchema = new Schema(
  {
    name: { type: String, required: true },
    prompt: { type: String },
    imageUrl: { type: String },
    code: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
  },
  { timestamps: true }
);

objectToPersonifySchema.index({ code: 1 }, { unique: true });
objectToPersonifySchema.index({ isActive: 1 });
objectToPersonifySchema.index({ customerId: 1 });

export const ObjectToPersonifyModel = MainConnection.model<IObjectToPersonify>(
  "ObjectToPersonify",
  objectToPersonifySchema
);

export const ObjectToPersonifyLoader = ModelLoader(ObjectToPersonifyModel);
