import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IAiProvider } from "./aiProvider.interface";

const Schema = mongoose.Schema;

const aiProviderSchema = new Schema(
  {
    name: { type: String },
    imgUrl: { type: String },
    website: { type: String },
    active: { type: Boolean, default: true },
    key: { type: String },
  },
  { timestamps: true }
);

// aiProviderSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const AiProviderModel = MainConnection.model<IAiProvider>("AiProvider", aiProviderSchema);

export const AiProviderLoader = ModelLoader(AiProviderModel);
