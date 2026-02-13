import { TimestampEntity } from "../../core";
export enum PostStatus {
  PUBLIC = "PUBLIC", // Công khai
  DRAFT = "DRAFT", // Nháp
}
export enum RoleGroup {
  CUSTOMER = "CUSTOMER", // Chỉ Khách hàng xem
  SHOP = "SHOP", //   Chỉ Cửa hàng xem
  STAFF = "STAFF", //  Chỉ Nhân viên xem
  PARTNER = "PARTNER", //  Chỉ Cộng tác viên xem
  ADMIN = "ADMIN", //  Chỉ ADMIN xem
  POPUP = "POPUP", // bài hiện pupup bên góc trái
  ALL = "ALL", //Tất cả
}
export type IPost = TimestampEntity & {
  title?: string; // Tiêu đề
  excerpt?: string; // Đoạn trích
  slug?: string; // từ khoá
  status?: PostStatus; // Trạng thái
  publishedAt?: Date; // Ngày công khai
  featureImage?: string; // Hình đại diện
  metaDescription?: string; // Mô tả meta tag
  metaTitle?: string; // Tiêu đề meta tag
  content?: string; // Nội dung html
  tagIds?: string[]; // Danh sách tag
  ogDescription?: string; // Mô tả open graph
  ogImage?: string; // Hình ảnh open graph
  ogTitle?: string; // Tiêu đề open graph
  twitterDescription?: string; // Mô tả twitter
  twitterImage?: string; // Hình ảnh twitter
  twitterTitle?: string; // Tiêu đề twitter
  priority?: number; // Độ ưu tiên
  view?: number; // Số lượt view
  topicIds?: string[]; // Danh sách chủ đề
  roleGroup?: RoleGroup[]; // Nhóm vai trò
  // attachmentIds?: string[]; // Danh sách file đính kèm
};
