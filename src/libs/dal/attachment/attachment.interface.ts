import { TimestampEntity } from "../../core";
import { Owner } from "../../shared/interfaces/owner.interface";

export type IAttachment = TimestampEntity & {
  owner?: Owner; // Người tạo file
  bucket?: string; // Thư mục
  name?: string; // Tên file
  mimetype?: string; // Loại file
  size?: number; // Kích thước
  etag?: string; // etag
  path?: string; // file path
  processing?: boolean; // Đang xử lý
};
