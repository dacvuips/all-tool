import { t } from "../../../helpers/functions/string";
import { validateJSON } from "../../../helpers/validateJSON";

export function validatePassword(password: string) {
  validateJSON(password, {
    type: "string",
    minLength: 6,
    errorMessage: t("mật khẩu phải có ít nhất 6 ký tự"),
  });
}

export function validateEmail(email: string) {
  validateJSON(email, {
    type: "string",
    format: "email",
    errorMessage: t("email không đúng định dạng"),
  });
}
export function validateVietnamesePhoneNumber(number: string) {
  if (!/^((\+84|0|84)[3|5|7|8|9])+([0-9]{8})$/.test(number)) {
    throw Error(t("Số điện thoại không đúng định dạng"));
  }
  return true;
}
