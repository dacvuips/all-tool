import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IThreadMessage } from "./threadMessage.interface";
import { ThreadSenderSchema } from "../../../graphql/modules/threadMessage/threadSender.graphql";

const Schema = mongoose.Schema;

const threadMessageSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, default: "general" },
    text: { type: String },
    attachment: { type: Schema.Types.Mixed, default: {} },
    sender: { type: ThreadSenderSchema, required: true },
    seen: { type: Boolean, default: false },
    seenAt: { type: String },
    isUnsend: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// threadMessageSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const ThreadMessageModel = MainConnection.model<IThreadMessage>(
  "ThreadMessage",
  threadMessageSchema
);

export const ThreadMessageLoader = ModelLoader(ThreadMessageModel);
