import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import { IDeviceInfo } from "./deviceInfo.interface";

const Schema = mongoose.Schema;

const deviceInfoSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    farmerId: { type: Schema.Types.ObjectId },
    deviceId: { type: String },
    deviceToken: { type: String },
  },
  { timestamps: true, collation: { locale: "vi" } }
);

deviceInfoSchema.index({ userId: 1 });
deviceInfoSchema.index({ farmerId: 1 });
// deviceInfoSchema.index({ name: "text" }, { weights: { name: 2 } });

export const DeviceInfoModel = MainConnection.model<IDeviceInfo>("DeviceInfo", deviceInfoSchema);

export const DeviceInfoLoader = ModelLoader(DeviceInfoModel);
