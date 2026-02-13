import { BaseError } from "../../../libs/core";

export namespace WorkSheet.Error {
  export const fileEmpty = new BaseError("excel-reader-error", "File import không có dữ liệu", 400);
  export const formatInvalid = new BaseError("excel-reader-error", "File import không hợp lệ", 400);
}
