import mongoose from "mongoose";
import { ModelLoader, TimestampEntity } from "../../../../libs/core";
import { MainConnection } from "../../../../helpers/mongo";

const Schema = mongoose.Schema;

export type IPostTag = TimestampEntity & {
  name?: string; // Tên tag
  slug?: string; // Từ khoá
  description?: string; // Mô tả
  accentColor?: string; // Mã màu
  featureImage?: string; // Hình ảnh đại diện
};

const postTagSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String },
    accentColor: { type: String },
    featureImage: { type: String },
  },
  { timestamps: true }
);

postTagSchema.index({ name: "text", slug: "text" }, { weights: { name: 2, slug: 1 } });
postTagSchema.index({ slug: 1 }, { unique: true });

export const PostTagModel = MainConnection.model<IPostTag>("PostTag", postTagSchema);

export const PostTagLoader = ModelLoader(PostTagModel);
