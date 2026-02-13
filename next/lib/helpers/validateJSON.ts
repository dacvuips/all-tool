import { i18n } from "next-i18next";

export function validateVietnamesePhoneNumber(number: string) {
  if (!/^((\+84|0|84)[3|5|7|8|9])+([0-9]{8})$/.test(number)) {
    return i18n.t("Số điện thoại không đúng định dạng");
  }
}

export function validateEmail(email: string) {
  const regex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (!regex.test(String(email).toLowerCase())) {
    return i18n.t("Sai định dạng email");
  }
}
