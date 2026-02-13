import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IThread, ThreadChannel, ThreadStatus } from "./thread.interface";

const Schema = mongoose.Schema;

const threadSchema = new Schema(
  {
    channel: { type: String, enum: Object.values(ThreadChannel) },
    snippet: { type: String, default: "" },
    lastMessageAt: { type: Date },
    messageId: { type: Schema.Types.ObjectId },
    shopId: { type: Schema.Types.ObjectId },
    customerId: { type: Schema.Types.ObjectId },
    staffId: { type: Schema.Types.ObjectId },
    gameOrderId: { type: Schema.Types.ObjectId },
    shopProductId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: Object.values(ThreadStatus), default: ThreadStatus.new },
    seenCustomer: { type: Boolean, default: false },
    seenShop: { type: Boolean, default: false },
    seenStaff: { type: Boolean, default: false },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// threadSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const ThreadModel = MainConnection.model<IThread>("Thread", threadSchema);

export const ThreadLoader = ModelLoader(ThreadModel);
