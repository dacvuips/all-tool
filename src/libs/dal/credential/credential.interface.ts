import { TimestampEntity } from "../../core";

export type CredentialField = {
  value?: string;
  active?: boolean;
};

export type ICredential = TimestampEntity & {
  ghnToken?: CredentialField;
  googleAIStudio?: CredentialField;
  chatGPT?: CredentialField;
  spx?: CredentialField;
  jtExpress?: CredentialField;
  giaoHangTietKiem?: CredentialField;
};
