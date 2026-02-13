import { i18n } from "next-i18next";
import { CONSTANTS, localStorageKey } from "../constants/constants";

export const useTimeBlockButtonForgetPassword = () => {
  const setTimeBlock = () => {
    const date = new Date().getTime();
    const expired = CONSTANTS.expiredTimeBlockButtonForgetPassword; // 5 minutes
    localStorage.setItem(
      localStorageKey.blockSendEmailForgetPassword,
      JSON.stringify(date + expired)
    );
  };

  const timeBlockRemain = () => {
    const currentTime = new Date().getTime();
    const localStorageData = localStorage.getItem(localStorageKey.blockSendEmailForgetPassword);

    if (!localStorageData) return 0;

    try {
      const expirationTime = JSON.parse(localStorageData);

      if (typeof expirationTime !== "number") {
        throw new Error(i18n.t("Lỗi khi lấy thời gian còn lại của nút gửi email quên mật khẩu"));
      }

      const timeDiff = expirationTime - currentTime;
      const remainingTime = timeDiff / 1000;

      return Math.max(0, Math.floor(remainingTime));
    } catch (error) {
      return 0;
    }
  };

  const removeTimeBlock = () => {
    localStorage.removeItem(localStorageKey.blockSendEmailForgetPassword);
  };

  return { setTimeBlock, timeBlockRemain, removeTimeBlock };
};
