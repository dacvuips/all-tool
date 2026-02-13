import { t } from "../../../helpers/functions/string";
import { BaseError } from "./base.error";

export const authErrorPermissionDeny = new BaseError(
  "auth-error",
  `[401] ${t("Không đủ quyền truy cập")}`,
  401
);
export const authErrorTokenExpired = new BaseError(
  "auth-error",
  `[403] ${t("Phiên làm việc hết hạn")}`,
  403
);
export const authErrorUnauthorized = new BaseError(
  "auth-error",
  `[403] ${t("Chưa xác thực tài khoản")}`,
  403
);
