import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { AiProviderKeyEnum } from "../product";
import { ICredential } from "./credential.interface";

const Schema = mongoose.Schema;

const credentialSchema = new Schema(
  {
    key: { type: String, enum: Object.values(AiProviderKeyEnum) },
    value: { type: String },
    active: { type: Boolean, default: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    isCustomerCredential: { type: Boolean, default: false },
    isAdminCredential: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// credentialSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const CredentialModel = MainConnection.model<ICredential>("Credential", credentialSchema);

export const CredentialLoader = ModelLoader(CredentialModel);
