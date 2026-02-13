import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";

import { INotification, NotificationTarget, NotificationType } from "./notification.interface";

const Schema = mongoose.Schema;
const notificationSchema = new Schema(
  {
    target: { type: String, enum: Object.values(NotificationTarget), required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop" },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    seen: { type: Boolean, default: false },
    seenAt: { type: Date },
    image: { type: String },
    sentAt: { type: Date },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    gameOrderId: { type: Schema.Types.ObjectId, ref: "GameOrder" },
    link: { type: String },
    ticketId: { type: Schema.Types.ObjectId },
    transactLink: { type: String },
    walletLink: { type: String },
  },
  { timestamps: true, collation: { locale: "vi" } }
);

notificationSchema.index({ shopId: 1 });
notificationSchema.index({ userId: 1 });
notificationSchema.index({ customerId: 1 });
notificationSchema.index({ title: "text" }, { weights: { title: 2 } });
notificationSchema.index({ sentAt: 1 });

export const NotificationStackModel = MainConnection.model("NotificationStack", notificationSchema);

export const NotificationModel = MainConnection.model<INotification>(
  "Notification",
  notificationSchema
);

export const NotificationLoader = ModelLoader(NotificationModel);
export function InsertNotification(notifies: INotification[]) {
  return Promise.all([
    NotificationModel.insertMany(notifies),
    // createNotifyJob(notifies),
    // pubsubNotify(notifies),
  ]);
}
