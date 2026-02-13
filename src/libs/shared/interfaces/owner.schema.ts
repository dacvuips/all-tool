import { Schema } from "mongoose";
import { OwnerType } from "./owner.interface";

export const OwnerSchema = new Schema({
  type: { type: String, enum: Object.values(OwnerType), default: OwnerType.user },
  name: { type: String },
  email: { type: String },
  phone: { type: String },
  role: { type: String },
});
