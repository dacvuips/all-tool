import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ICategory } from "./category.interface";

const Schema = mongoose.Schema;

const categorySchema = new Schema(
  {
    name: { type: String, require: true },
    imgUrl: { type: String, require: true },
    description: { type: String },
    priority: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  },
  { timestamps: true }
);
categorySchema.index({ name: "text" }, { weights: { name: 2 } } as any);
categorySchema.index({ parentId: 1, priority: 1 });

export const CategoryModel = MainConnection.model<ICategory>("Category", categorySchema);

export const CategoryLoader = ModelLoader(CategoryModel);
