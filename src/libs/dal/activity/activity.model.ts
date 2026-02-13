import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IActivity } from "./activity.interface";
const Schema = mongoose.Schema;

const activitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, require: true },
    username: { type: String },
    message: { type: String },
  },
  { timestamps: true, collation: { locale: "vi" } }
);

activitySchema.index({ username: "text", message: "text" }, {
  weights: { username: 2, message: 4 },
} as any);

export const ActivityModel = MainConnection.model<IActivity>("Activity", activitySchema);

export const ActivityLoader = ModelLoader(ActivityModel);
