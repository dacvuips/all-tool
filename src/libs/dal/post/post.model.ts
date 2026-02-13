import mongoose from "mongoose";
import { IPost, PostStatus, RoleGroup } from "./post.interface";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";

const Schema = mongoose.Schema;
const postSchema = new Schema(
  {
    title: { type: String, required: true },
    excerpt: { type: String },
    slug: { type: String, required: true },
    status: { type: String, enum: Object.values(PostStatus), default: PostStatus.DRAFT },
    publishedAt: { type: Date },
    featureImage: { type: String },
    metaDescription: { type: String },
    metaTitle: { type: String },
    content: { type: String, required: true },
    tagIds: { type: [{ type: Schema.Types.ObjectId, ref: "PostTag" }] },
    ogDescription: { type: String },
    ogImage: { type: String },
    ogTitle: { type: String },
    twitterDescription: { type: String },
    twitterImage: { type: String },
    twitterTitle: { type: String },
    priority: { type: Number, default: 0 },
    view: { type: Number, default: 0 },
    topicIds: { type: [String], default: [] },
    roleGroup: {
      type: [String],
      enum: Object.values(RoleGroup),
      default: RoleGroup.ALL,
      required: true,
    },
    // attachmentIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

postSchema.index({ title: "text", slug: "text" }, { weights: { title: 2, slug: 1 } });
postSchema.index({ slug: 1 }, { unique: true });
postSchema.index({ priority: 1 });

export const PostModel = MainConnection.model<IPost>("Post", postSchema);

export const PostLoader = ModelLoader(PostModel);
