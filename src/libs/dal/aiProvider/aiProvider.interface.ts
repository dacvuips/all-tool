import { TimestampEntity } from "../../core";

export type IAiProvider = TimestampEntity & {
  name?: string;
  imgUrl?: string;
  website?: string;
  active?: boolean;
  key?: string;
};
