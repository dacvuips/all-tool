import { t } from "../../../helpers/functions/string";
import { BaseError } from "./base.error";

export const queryErrorNotFound = new BaseError("query-error", t("Không tìm thấy dữ liệu"), 404);
