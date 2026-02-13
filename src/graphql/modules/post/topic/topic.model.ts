import mongoose from "mongoose";
import { ModelLoader, TimestampEntity } from "../../../../libs/core";
import { MainConnection } from "../../../../helpers/mongo";

const Schema = mongoose.Schema;

export type ITopic = TimestampEntity & {
  name?: string; // Tên chủ đề
  slug?: string; // slug
  image?: string; // Hình ảnh
  group?: string; // nhóm
};

const topicSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    image: { type: String },
    group: { type: String },
  },
  { timestamps: true }
);

topicSchema.index({ slug: 1 }, { unique: true });
topicSchema.index({ name: "text" }, { weights: { name: 2 } });

export const TopicModel = MainConnection.model<ITopic>("Topic", topicSchema);

export const TopicLoader = ModelLoader(TopicModel);
