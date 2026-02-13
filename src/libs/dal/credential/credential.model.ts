import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { ICredential } from "./credential.interface";

const Schema = mongoose.Schema;

const credentialFieldSchema = new Schema({
  value: { type: String },
  active: { type: Boolean, default: false },
});

const credentialSchema = new Schema(
  {
    chatGPT: { type: credentialFieldSchema },
    googleAIStudio: { type: credentialFieldSchema },
    ghnToken: { type: credentialFieldSchema },

    giaoHangTietKiem: { type: credentialFieldSchema },

    spx: { type: credentialFieldSchema },
    jtExpress: { type: credentialFieldSchema },
  },
  { timestamps: true }
);

// credentialSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const CredentialModel = MainConnection.model<ICredential>("Credential", credentialSchema);

export const CredentialLoader = ModelLoader(CredentialModel);
