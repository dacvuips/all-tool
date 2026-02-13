import mongoose from "mongoose";
import { MainConnection } from "../../../../helpers/mongo";
import { ModelLoader, TimestampEntity } from "../../../../libs/core";

const Schema = mongoose.Schema;

export type IPostViewLog = TimestampEntity & {
  postId?: string; // Mã post
  userId?: string; // Mã người dùng
  view?: number; // Lượt view
};

const postViewLogSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    view: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);
postViewLogSchema.index({ postId: 1, userId: 1 }, { unique: true });
// postViewLogSchema.index({ name: "text" }, { weights: { name: 2 } });

export const PostViewLogModel = MainConnection.model<IPostViewLog>(
  "PostViewLog",
  postViewLogSchema
);

export const PostViewLogLoader = ModelLoader(PostViewLogModel);
