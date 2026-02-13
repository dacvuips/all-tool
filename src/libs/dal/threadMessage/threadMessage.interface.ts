import { Schema } from "mongoose";
import { TimestampEntity } from "../../core";
export enum ThreadMessageType {
  general = "general", // Chung
}
export type ThreadSender = {
  role?: string; // Loại người dùng
  staffId?: string; // Mã quản lý
  shopId?: string; // Mã cửa hàng
  customerId?: string; // Mã khách hàng
};

export type IThreadMessage = TimestampEntity & {
  threadId?: string; // Mã cuộc trao đổi
  type?: ThreadMessageType; // Loại tin nhắn
  text?: string; // Tin nhắn
  attachment?: any; // Dữ liệu đính kèm
  sender?: ThreadSender; // Người gửi
  seen?: boolean; // Đã xem
  seenAt?: Date; // Ngày xem
  isUnsend?: boolean; // Đã thu hồi
};
