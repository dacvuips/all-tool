import { TimestampEntity } from "../../core";

export type IIntroduce = TimestampEntity & {
  /** ID người giới thiệu (customer đã có tài khoản, chia sẻ code) */
  referrerId: string;
  /** ID người được giới thiệu (customer mới đăng ký, nhập code) */
  refereeId: string;
  /** Trạng thái khoá */
  blocked: boolean;
};
