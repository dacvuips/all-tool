import { TimestampEntity } from "../../core";
import { AiProviderKeyEnum } from "../product";

export type ICredential = TimestampEntity & {
  key?: AiProviderKeyEnum;
  value?: string;
  active?: boolean;
  customerId?: string;
  isCustomerCredential?: boolean;
  isAdminCredential?: boolean;
  /** Vertex AI OAuth2 – encrypted fields for auto-refresh token flow */
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthRefreshToken?: string;
  vertexProjectId?: string;
  vertexRegion?: string;
};
