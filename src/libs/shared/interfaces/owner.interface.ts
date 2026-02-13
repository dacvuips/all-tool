import { UserRoleEnum } from "..";

export enum OwnerType {
  user = "user",
  farmer = "farmer",
}
export type Owner = {
  _id?: string; // Mã người dùng
  type?: OwnerType;
  name?: string; // Tên
  email?: string; // Email
  phone?: string; // Điện thoại
  role?: UserRoleEnum; // Vai trò
};
