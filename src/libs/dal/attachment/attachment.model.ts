import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import { IAttachment } from "./attachment.interface";

const Schema = mongoose.Schema;

const attachmentSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "Owner" },
    bucket: { type: String, required: true },
    name: { type: String, required: true },
    mimetype: { type: String },
    size: { type: Number },
    etag: { type: String },
    path: { type: String },
    processing: { type: Boolean },
  },
  { timestamps: true }
);

attachmentSchema.index({ name: "text" }, { weights: { name: 2 } });

export const AttachmentModel = MainConnection.model<IAttachment>("Attachment", attachmentSchema);

export const AttachmentLoader = ModelLoader(AttachmentModel);
