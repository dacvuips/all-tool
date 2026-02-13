import { TimestampEntity } from "../../core";

export type ISettingGroup = TimestampEntity & {
  slug: string;
  name: string;
  desc: string;
  sort: number;
};
