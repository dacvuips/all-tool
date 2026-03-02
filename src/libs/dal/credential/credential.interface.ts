import { TimestampEntity } from "../../core";
import { AiProviderKeyEnum } from "../aiProvider";

export type ICredential = TimestampEntity & {
  key?: AiProviderKeyEnum;
  value?: string;
  active?: boolean;
  customerId?: string;
  isCustomerCredential?: boolean;
  isAdminCredential?: boolean;
};
