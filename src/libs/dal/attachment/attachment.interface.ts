import { TimestampEntity } from "../../core";

export type IAttachment = TimestampEntity & {
  bucket?: string; // Thư mục
  name?: string; // Tên file
  mimetype?: string; // Loại file
  size?: number; // Kích thước
  etag?: string; // etag
  path?: string; // file path
  processing?: boolean; // Đang xử lý
};
