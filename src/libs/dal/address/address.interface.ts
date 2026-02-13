import { TimestampEntity } from "../../core";

export type IAddress = TimestampEntity & {
  province?: string;
  provinceId?: string;
  district?: string;
  districtId?: string;
  ward?: string;
  wardId?: string;
};
