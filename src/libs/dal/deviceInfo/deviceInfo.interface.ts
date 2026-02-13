import { TimestampEntity } from "../../core";

export type IDeviceInfo = TimestampEntity & {
  userId?: string; // Mã người dùng
  farmerId?: string; // Mã nông dân
  deviceId?: string; // Mã thiết bị
  deviceToken?: string; // Token thiết bị
};
