import { TimestampEntity } from "../../core";

export type ICounter = TimestampEntity & {
  name?: string;
  value?: number;
};
