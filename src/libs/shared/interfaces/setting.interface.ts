import { TimestampEntity } from "../../core";
import { SettingResource } from "./settingResource";

export type ISetting = TimestampEntity & {
  type?: SettingResource.Type;
  name?: string;
  desc?: string;
  key?: string;
  value?: any;
  isActive?: boolean;
  isPrivate?: boolean;
  isSecret?: boolean;
  groupId?: string;

  sort?: number;
};
