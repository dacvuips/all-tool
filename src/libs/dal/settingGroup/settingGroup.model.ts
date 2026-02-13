import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";

import { ISettingGroup } from "./settingGroup.interface";

const Schema = mongoose.Schema;

const settingGroupSchema = new Schema<ISettingGroup>(
  {
    slug: { type: String, required: true },
    name: { type: String, required: true },
    desc: { type: String },
    sort: { type: Number },
  },
  { timestamps: true, collation: { locale: "vi" } }
);

settingGroupSchema.index({ slug: 1 }, { unique: true });
settingGroupSchema.index({ name: "text", slug: "text" }, { weights: { name: 2, slug: 4 } } as any);

export const SettingGroupModel = MainConnection.model<ISettingGroup>(
  "SettingGroup",
  settingGroupSchema
);

export const SettingGroupLoader = ModelLoader(SettingGroupModel);
