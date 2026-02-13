import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import {
  IPopupNotify,
  PopupNotifyActionType,
  PopupNotifyStatus,
  PopupNotifyType,
} from "./popupNotify.interface";

const Schema = mongoose.Schema;

const popupNotifySchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: PopupNotifyType, required: true },
    status: { type: String, enum: PopupNotifyStatus, default: PopupNotifyStatus.INACTIVE },
    data: { type: Schema.Types.Mixed, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    priority: { type: Number },
    action: { type: String, enum: PopupNotifyActionType },
    link: { type: String },
  },
  { timestamps: true }
);

// popupNotifySchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const PopupNotifyModel = MainConnection.model<IPopupNotify>(
  "PopupNotify",
  popupNotifySchema
);

export const PopupNotifyLoader = ModelLoader(PopupNotifyModel);
