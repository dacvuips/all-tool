import { TimestampEntity } from "../../core";

export type IActivity = TimestampEntity & {
  userId?: string;
  username?: string;
  message?: string;
};
