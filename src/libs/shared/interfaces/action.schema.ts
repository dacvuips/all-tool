import { Schema } from "mongoose";
import { ActionType } from "./action.interface";

export const ActionSchema = new Schema({
  type: { type: String, enum: Object.values(ActionType) },
  link: { type: String },
  postId: { type: Schema.Types.ObjectId },
});
