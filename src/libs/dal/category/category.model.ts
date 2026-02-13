import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ICategory, PropertyTypeEnum } from "./category.interface";

const Schema = mongoose.Schema;

const categorySchema = new Schema(
  {
    name: { type: String, require: true },
    imgUrl: { type: String, require: true },
    description: { type: String },
    priority: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
    properties: {
      type: [
        {
          type: {
            type: String,
            enum: Object.values(PropertyTypeEnum),
          },
          key: { type: String, require: true },
          label: { type: String, require: true },
          placeholder: { type: String },
          tooltip: { type: String },
          required: { type: Boolean, default: true },
          clearable: { type: Boolean, default: true },
          options: {
            type: [
              {
                key: { type: String, require: true },
                label: { type: String, require: true },
              },
            ],
            default: [],
          },
          default: { type: Schema.Types.Boolean, default: false },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);
categorySchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const CategoryModel = MainConnection.model<ICategory>("Category", categorySchema);

export const CategoryLoader = ModelLoader(CategoryModel);
