import { TimestampEntity } from "../../core";

export enum AuthorityStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}
export type IAuthority = TimestampEntity & {
  name?: string; // Tên phân quyền
  scopes?: string[]; // Phạm vi phân quyền
  root?: boolean; // Phân quyền gốc
  parentIds?: string[]; // Phân quyền cha
  creatorId?: string; // ID người tạo phân quyền
  status?: AuthorityStatus; // Trạng thái phân quyền
  code?: string; // Mã phân quyền
};
