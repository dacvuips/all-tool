import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ISetting, SettingResource } from "../../shared";

const Schema = mongoose.Schema;

const settingSchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(SettingResource.Type),
      required: true,
      default: SettingResource.Type.string,
    },
    name: { type: String, required: true },
    desc: { type: String },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, required: true, default: true },
    isPrivate: { type: Boolean, required: true, default: false },
    isSecret: { type: Boolean, default: false },
    sort: { type: Number },
    groupId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, collation: { locale: "vi" } }
);

settingSchema.index({ key: 1 }, { unique: true });
settingSchema.index({ name: "text", key: "text" }, { weights: { name: 2, key: 4 } } as any);

export const SettingModel = MainConnection.model<ISetting>("Setting", settingSchema);
export const SettingLoader = ModelLoader(SettingModel);
