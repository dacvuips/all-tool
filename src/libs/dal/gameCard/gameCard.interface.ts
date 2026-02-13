import { TimestampEntity } from "../../core";
export enum GameCardStatusEnum {
  ACTIVE = "active", // kích hoạt
  INACTIVE = "inactive", // chưa kích hoạt
  USED = "used", // đã sử dụng
}

export type IGameCard = TimestampEntity & {
  productId?: string; // Mã sản phẩm
  code?: string; // encrypted
  serial?: string; // encrypted
  codeId?: string; // code id
  status?: GameCardStatusEnum; // active, inactive, used
  activeDate?: string; // active date
  inactiveAt?: Date; // when inactive
  usedAt?: Date; // when used
  orderId?: string; // order id
  importerId?: string; // user id
};
